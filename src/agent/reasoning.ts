import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ollamaChat, ollamaChatStream, OllamaChatMessage } from './ollama';
import { ToolRegistry } from '../tools/registry';
import { toolDefinitions, toOllamaTools } from '../tools/definitions';
import { mcpManager } from '../mcp/manager';
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
You have access to tools: databases, APIs, file systems, git, Redis.

LANGUAGE: Respond in the same language as the user (Thai→Thai, English→English).

TOOL CHAINING: Never pass one tool's result directly into another in the same step.
Always do STEP 1: call tool → read actual value, STEP 2: use that real value.

REAL-TIME DATA (use web_fetch_json — no API key needed):
- Gold XAU/USD    : https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD → {price_usd_per_oz, price_usd_per_gram}
- Stock (Yahoo)   : https://query1.finance.yahoo.com/v8/finance/chart/SYMBOL → {symbol, price, currency}
- BTC/ETH (Coinbase): https://api.coinbase.com/v2/prices/BTC-USD/spot → {price}
- USD→THB rate    : https://api.frankfurter.app/latest?from=USD&to=THB → {THB}
Note: 1 troy oz = 31.1035g | 1 บาททอง = 15.244g

DATABASE: This system uses only the mcp_hub database. "สร้างฐานข้อมูล X" = CREATE TABLE X in mcp_hub.
Always include: id INT NOT NULL AUTO_INCREMENT PRIMARY KEY in new tables.

SQL RULES (critical):
- Call db_schema before INSERT/UPDATE to verify column names
- Never use {placeholder} in SQL strings — use ? params with real values
- Correct: sql="INSERT INTO gold (price, recorded_at) VALUES (?, NOW())" params=[5019.37]

ENVIRONMENT:
- CWD / git path: ${cwd}
- FS allowed path: ${fsAllowed}
- Database: ${config.database.host}:${config.database.port}/${config.database.database}
- Redis: ${config.redis.host}:${config.redis.port}
- OS: ${os.platform()} (${os.arch()})
- Production safe mode: ${config.productionSafeMode ? 'ENABLED' : 'DISABLED'}

Use REAL paths, REAL data. After tool errors, report the actual error message.`;
}

export interface AgentRunOptions {
  userPrompt: string;
  sessionId?: string;
  userId?: string;
  role?: Role;
  allowedTools?: ToolName[];
  maxIterations?: number;
  onToken?: (token: string) => void;  // streaming callback for final response
}

export class ReasoningAgent {
  private registry: ToolRegistry;
  private memory: SessionMemory;

  constructor(memory: SessionMemory) {
    this.memory = memory;
    this.registry = new ToolRegistry(memory.role);
  }

  private async runMcpTool(fullName: string, args: Record<string, unknown>): Promise<ToolCall> {
    const call: ToolCall = {
      id: uuidv4(),
      toolName: fullName,
      args,
      status: 'running',
      startedAt: new Date(),
    };
    const start = Date.now();
    try {
      call.result = await mcpManager.executeTool(fullName, args);
      call.status = 'success';
    } catch (e: any) {
      call.status = 'error';
      call.error = e.message;
    }
    call.finishedAt = new Date();
    call.durationMs = Date.now() - start;
    return call;
  }

  async run(options: AgentRunOptions): Promise<ExecutionTimeline> {
    const {
      userPrompt,
      maxIterations = 6,
      allowedTools,
      onToken,
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

    const ollamaTools = [
      ...toOllamaTools(availableTools),
      ...mcpManager.toOllamaTools(),
    ];

    // Build conversation from session memory (keep last 8 msgs to limit token usage)
    const recentHistory = this.memory.messages.slice(-8);
    const messages: OllamaChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...recentHistory.map((m: AgentMessage) => ({
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
        // Emit each character progressively for streaming UX
        if (onToken && finalResponse) {
          for (const char of finalResponse) {
            onToken(char);
          }
        }
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

        // Route to external MCP server if prefixed with mcp__
        const toolCall = toolName.startsWith('mcp__')
          ? await this.runMcpTool(toolName, toolArgs)
          : await this.registry.executeTool(toolName, toolArgs);
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
