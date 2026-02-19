import { ollamaChat } from './ollama';
import { AgentPlan, ExecutionStep, ToolName } from '../types';
import { toolDefinitions } from '../tools/definitions';
import config from '../config';

// ============================================================
// Planner Agent — Breaks user prompt into execution steps
// ============================================================

const PLANNER_SYSTEM = `You are a Planner Agent for a Thai-friendly AI system.
If the user's request is in Thai, write the "goal" and step "reason" fields in Thai.
If in English, write in English.

You are a Planner Agent for an AI Infrastructure Operator system.
Your ONLY job is to analyze a user request and create a structured execution plan.

Available tools: TOOL_LIST

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{
  "goal": "one sentence describing what we're achieving",
  "complexity": "simple|medium|complex",
  "estimatedTools": ["tool1", "tool2"],
  "steps": [
    { "stepNumber": 1, "description": "what to do in this step", "toolHint": "tool_name" },
    { "stepNumber": 2, "description": "what to do next", "toolHint": "tool_name" }
  ]
}

RULES:
- simple = 1 tool call
- medium = 2-3 tool calls  
- complex = 4+ tool calls or requires chaining results
- Only include tools that actually exist in the available tools list
- Steps should be concrete and actionable`;

export async function createPlan(
  userPrompt: string,
  availableToolNames: ToolName[]
): Promise<AgentPlan> {
  const toolList = availableToolNames.join(', ');
  const systemPrompt = PLANNER_SYSTEM.replace('TOOL_LIST', toolList);

  let response;
  try {
    response = await ollamaChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a plan for: ${userPrompt}` },
      ],
    });
  } catch {
    return fallbackPlan(userPrompt);
  }

  try {
    // Strip any markdown fences
    const raw = response.message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(raw);

    const steps: ExecutionStep[] = (parsed.steps ?? []).map((s: any, i: number) => ({
      stepNumber: s.stepNumber ?? i + 1,
      description: s.description ?? '',
      toolHint: availableToolNames.includes(s.toolHint) ? s.toolHint : undefined,
      status: 'pending' as const,
    }));

    return {
      goal: parsed.goal ?? userPrompt,
      complexity: parsed.complexity ?? 'simple',
      estimatedTools: (parsed.estimatedTools ?? []).filter((t: string) =>
        availableToolNames.includes(t as ToolName)
      ) as ToolName[],
      steps,
    };
  } catch {
    return fallbackPlan(userPrompt);
  }
}

function fallbackPlan(userPrompt: string): AgentPlan {
  return {
    goal: userPrompt,
    complexity: 'simple',
    estimatedTools: [],
    steps: [
      {
        stepNumber: 1,
        description: 'Execute the user request directly',
        status: 'pending',
      },
    ],
  };
}
