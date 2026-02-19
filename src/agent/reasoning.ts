import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ollamaChat, OllamaChatMessage } from './ollama';
import { ToolRegistry } from '../tools/registry';
import { toolDefinitions, toOllamaTools } from '../tools/definitions';
import { ExecutionTimeline, ToolCall, ToolName, Role, AgentMessage } from '../types';
import type { SessionMemory } from './memory';
import config from '../config';

// ============================================================
// AI Reasoning Loop — Orchestrates Ollama + MCP Tools
// ============================================================

function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const fsAllowed = process.env['FS_ALLOWED_PATH']
    ? path.resolve(process.env['FS_ALLOWED_PATH'])
    : cwd;

  return `You are an AI System Operator — a powerful AI infrastructure agent.
You have access to tools that let you interact with databases, APIs, file systems, git repositories, and Redis.

LANGUAGE RULES (highest priority):
- If the user writes in Thai → always respond in Thai
- If the user writes in English → respond in English
- You may mix Thai explanation with English code/commands when it helps clarity
- Be friendly and natural in whatever language the user uses

REAL-TIME DATA — use web_fetch_json for live prices (no API key needed):
- ราคาทอง/เงิน/แพลทินัม : GET https://metals.live/api/latest  → returns [{gold: USD/oz, silver: ..., platinum: ...}]
- ราคา BTC             : GET https://api.coinbase.com/v2/prices/BTC-USD/spot
- ราคา ETH             : GET https://api.coinbase.com/v2/prices/ETH-USD/spot
- อัตราแลกเปลี่ยน       : GET https://api.frankfurter.app/latest?from=USD&to=THB
- หากต้องการราคาเป็นบาท: ดึงทั้ง metals + exchange rate แล้วคำนวณเอง (1 troy oz = 31.1035 grams)

ENVIRONMENT CONTEXT (use these real values in tool arguments):
- Current Working Directory: ${cwd}
- File System Allowed Path: ${fsAllowed}
- Default Git Repository Path: ${cwd}
- OS: ${os.platform()} (${os.arch()})
- Database: ${config.database.host}:${config.database.port}/${config.database.database}
- Redis: ${config.redis.host}:${config.redis.port}

OPERATING RULES:
1. ALWAYS use the real paths above — NEVER use placeholder paths like /path/to/repo or /example.
2. For git tools, use repoPath: "${cwd}" unless the user specifies a different path.
3. For fs tools, use paths relative to "${fsAllowed}" or absolute paths.
4. THINK before acting. Analyze the task, choose the right tools.
5. Use tools when needed. Chain multiple calls if required.
6. After each tool call, analyze the REAL result before continuing.
7. If a tool fails with an error, report the REAL error — do NOT fabricate output.
8. When done, provide a clear summary of what was actually accomplished.

PRODUCTION SAFE MODE: ${config.productionSafeMode ? 'ENABLED — destructive operations are blocked' : 'DISABLED — all operations available'}

You are NOT just a chatbot. You are an AI Infrastructure Operator that gets things done with REAL data.`;
}

export interface AgentRunOptions {
  userPrompt: string;
  sessionId?: string;
  userId?: string;
  role?: Role;
  allowedTools?: ToolName[];
  maxIterations?: number;
}

export class ReasoningAgent {
  private registry: ToolRegistry;
  private memory: SessionMemory;

  constructor(memory: SessionMemory) {
    this.memory = memory;
    this.registry = new ToolRegistry(memory.role);
  }

  async run(options: AgentRunOptions): Promise<ExecutionTimeline> {
    const {
      userPrompt,
      maxIterations = 10,
      allowedTools,
    } = options;

    const timeline: ExecutionTimeline = {
      sessionId: this.memory.sessionId,
      userPrompt,
      toolCalls: [],
      finalResponse: '',
      totalDurationMs: 0,
      startedAt: new Date(),
    };

    const startTime = Date.now();

    // Filter tools based on role and allowedTools option
    const availableTools = toolDefinitions.filter((t) => {
      if (!t.permissionRequired.includes(this.memory.role)) return false;
      if (config.productionSafeMode && !t.safeForProduction) return false;
      if (allowedTools && !allowedTools.includes(t.name)) return false;
      return true;
    });

    const ollamaTools = toOllamaTools(availableTools);

    // Build conversation from session memory
    const messages: OllamaChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...this.memory.messages.map((m: AgentMessage) => ({
        role: m.role as OllamaChatMessage['role'],
        content: m.content,
      })),
      { role: 'user', content: userPrompt },
    ];

    // Add to session memory
    this.memory.messages.push({
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    });

    let iteration = 0;
    let finalResponse = '';

    // ─── Reasoning Loop ──────────────────────────────────────
    while (iteration < maxIterations) {
      iteration++;
      console.log(`[Agent] Iteration ${iteration}/${maxIterations}`);

      let response;
      try {
        response = await ollamaChat({ messages, tools: ollamaTools });
      } catch (err: any) {
        finalResponse = `AI Error: ${err.message}`;
        break;
      }

      const assistantMessage = response.message;

      // If no tool calls, this is the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        finalResponse = assistantMessage.content;
        messages.push({ role: 'assistant', content: finalResponse });
        break;
      }

      // Add assistant message with tool calls to conversation
      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? '',
        tool_calls: assistantMessage.tool_calls,
      });

      // ─── Execute Tool Calls ──────────────────────────────
      for (const toolCallRequest of assistantMessage.tool_calls) {
        const toolName = toolCallRequest.function.name as ToolName;
        const toolArgs = toolCallRequest.function.arguments;

        console.log(`[Agent] Calling tool: ${toolName}`, toolArgs);

        const toolCall = await this.registry.executeTool(toolName, toolArgs);
        timeline.toolCalls.push(toolCall);

        // Format tool result for conversation
        const resultContent = toolCall.status === 'success'
          ? JSON.stringify(toolCall.result, null, 2)
          : `ERROR: ${toolCall.error}`;

        messages.push({
          role: 'tool',
          content: resultContent,
        });
      }

      // Check if done
      if (response.done_reason === 'stop' && (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0)) {
        break;
      }
    }

    if (!finalResponse) {
      finalResponse = `Completed ${timeline.toolCalls.length} tool operations. Check the execution timeline for details.`;
    }

    timeline.finalResponse = finalResponse;
    timeline.finishedAt = new Date();
    timeline.totalDurationMs = Date.now() - startTime;

    // Save to session memory
    this.memory.messages.push({
      role: 'assistant',
      content: finalResponse,
      toolCalls: timeline.toolCalls,
      timestamp: new Date(),
    });
    this.memory.updatedAt = new Date();

    return timeline;
  }
}
