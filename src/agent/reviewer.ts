import { ollamaChat } from './ollama';
import { ReviewResult, ExecutionTimeline } from '../types';

// ============================================================
// Reviewer Agent — Reviews execution results for quality
// ============================================================

const REVIEWER_SYSTEM = `You are a Reviewer Agent for an AI Infrastructure Operator system.
Your ONLY job is to review whether a task was completed correctly and completely.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{
  "passed": true,
  "score": 8,
  "feedback": "The task was completed successfully. All database queries returned valid results.",
  "issues": [],
  "suggestions": ["Consider adding error handling for edge cases"]
}

SCORING GUIDE:
- 9-10: Perfect execution, all steps done correctly
- 7-8: Good execution, minor issues or room for improvement
- 5-6: Partial success, some steps failed or incomplete
- 3-4: Poor execution, major issues
- 1-2: Failed, incorrect results or significant errors

REVIEW CRITERIA:
1. Did the AI actually use tools (not just make up results)?
2. Were tool results real and meaningful?
3. Was the user's original request fulfilled?
4. Were there any errors that were not handled?
5. Was the response clear and actionable?`;

export async function reviewExecution(
  userPrompt: string,
  timeline: ExecutionTimeline
): Promise<ReviewResult> {
  const toolSummary = timeline.toolCalls.map((c) => ({
    tool: c.toolName,
    status: c.status,
    durationMs: c.durationMs,
    hasResult: c.result !== undefined,
    hasError: c.error !== undefined,
  }));

  const reviewInput = `
USER REQUEST: ${userPrompt}

EXECUTION SUMMARY:
- Tools called: ${timeline.toolCalls.length}
- Successful: ${timeline.toolCalls.filter((c) => c.status === 'success').length}
- Failed: ${timeline.toolCalls.filter((c) => c.status === 'error').length}
- Total duration: ${timeline.totalDurationMs}ms

TOOL CALLS:
${JSON.stringify(toolSummary, null, 2)}

AI FINAL RESPONSE:
${timeline.finalResponse}

Review whether this execution was successful and complete.`;

  let response;
  try {
    response = await ollamaChat({
      messages: [
        { role: 'system', content: REVIEWER_SYSTEM },
        { role: 'user', content: reviewInput },
      ],
    });
  } catch {
    return fallbackReview(timeline);
  }

  try {
    const raw = response.message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(raw);

    return {
      passed: Boolean(parsed.passed),
      score: Math.min(10, Math.max(0, Number(parsed.score) || 5)),
      feedback: parsed.feedback ?? '',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return fallbackReview(timeline);
  }
}

function fallbackReview(timeline: ExecutionTimeline): ReviewResult {
  const errorCount = timeline.toolCalls.filter((c) => c.status === 'error').length;
  const successCount = timeline.toolCalls.filter((c) => c.status === 'success').length;
  const passed = errorCount === 0 || successCount > errorCount;
  const score = passed ? (errorCount === 0 ? 8 : 6) : 4;

  return {
    passed,
    score,
    feedback: passed
      ? `Execution completed with ${successCount} successful tool calls.`
      : `Execution had ${errorCount} errors out of ${timeline.toolCalls.length} tool calls.`,
    issues: errorCount > 0
      ? [`${errorCount} tool call(s) failed during execution`]
      : [],
    suggestions: [],
  };
}
