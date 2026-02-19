import { EventEmitter } from 'events';
import { createPlan } from './planner';
import { ReasoningAgent } from './reasoning';
import { reviewExecution } from './reviewer';
import { getOrCreateSession } from './memory';
import { getAllToolNames } from '../tools/registry';
import { MultiAgentTimeline, AgentPlan, ReviewResult, ExecutionTimeline } from '../types';

// ============================================================
// Orchestrator Agent — coordinates Planner → Executor → Reviewer
// ============================================================

export interface OrchestratorOptions {
  userPrompt: string;
  sessionId: string;
  role?: string;
  emitter?: EventEmitter; // used to emit WebSocket-compatible events
}

export interface OrchestratorResult {
  timeline: MultiAgentTimeline;
  plan: AgentPlan;
  review: ReviewResult;
}

export class OrchestratorAgent {
  async run(options: OrchestratorOptions): Promise<OrchestratorResult> {
    const { userPrompt, sessionId, role = 'admin', emitter } = options;
    const startTime = Date.now();

    const emit = (event: string, data: unknown) => {
      if (emitter) emitter.emit(event, data);
    };

    // ──────────────────────────────────────────
    // Phase 1 — Planning
    // ──────────────────────────────────────────
    emit('agent:planning', { sessionId, prompt: userPrompt });

    const availableToolNames = getAllToolNames();
    const plan = await createPlan(userPrompt, availableToolNames);

    emit('agent:plan_ready', { sessionId, plan });

    // ──────────────────────────────────────────
    // Phase 2 — Execution
    // ──────────────────────────────────────────
    emit('agent:executing', { sessionId, plan });

    const session = getOrCreateSession(sessionId, 'orchestrator', role as import('../types').Role);
    const reasoningAgent = new ReasoningAgent(session);

    const executionTimeline: ExecutionTimeline = await reasoningAgent.run({
      userPrompt,
      sessionId,
      role: role as import('../types').Role,
    });

    // Emit tool calls after execution
    for (const call of executionTimeline.toolCalls) {
      emit('tool:executed', { sessionId, ...call });
    }

    // ──────────────────────────────────────────
    // Phase 3 — Reviewing
    // ──────────────────────────────────────────
    emit('agent:reviewing', { sessionId });

    const review = await reviewExecution(userPrompt, executionTimeline);

    emit('agent:review_done', { sessionId, review });

    // ──────────────────────────────────────────
    // Build MultiAgentTimeline
    // ──────────────────────────────────────────
    const totalDurationMs = Date.now() - startTime;

    const agentLogs = [
      {
        agentType: 'planner' as const,
        message: `Created plan: "${plan.goal}" (${plan.steps.length} steps, complexity: ${plan.complexity})`,
        timestamp: new Date(startTime).toISOString(),
      },
      {
        agentType: 'executor' as const,
        message: `Executed ${executionTimeline.toolCalls.length} tool calls`,
        timestamp: new Date(startTime + 100).toISOString(),
      },
      {
        agentType: 'reviewer' as const,
        message: `Review score: ${review.score}/10 — ${review.passed ? 'PASSED' : 'FAILED'}. ${review.feedback}`,
        timestamp: new Date().toISOString(),
      },
    ];

    const multiTimeline: MultiAgentTimeline = {
      ...executionTimeline,
      totalDurationMs,
      plan,
      review,
      agentLogs,
    };

    return { timeline: multiTimeline, plan, review };
  }
}
