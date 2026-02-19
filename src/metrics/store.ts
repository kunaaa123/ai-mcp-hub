import { SystemMetrics, ToolMetric, SessionMetric, ExecutionTimeline } from '../types';

// ============================================================
// Metrics Store — in-memory singleton
// ============================================================

interface ToolStats {
  count: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
}

class MetricsStore {
  private totalRequests = 0;
  private totalToolCalls = 0;
  private totalTokensUsed = 0;
  private totalDurationMs = 0;
  private toolStats: Map<string, ToolStats> = new Map();
  private recentSessions: SessionMetric[] = [];
  private readonly MAX_RECENT = 50;

  recordToolCall(toolName: string, durationMs: number, success: boolean): void {
    this.totalToolCalls++;

    const stats = this.toolStats.get(toolName) ?? {
      count: 0,
      successCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
    };

    stats.count++;
    stats.totalDurationMs += durationMs;
    if (success) {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }

    this.toolStats.set(toolName, stats);
  }

  recordRequest(timeline: ExecutionTimeline, sessionId: string, role = 'unknown'): void {
    this.totalRequests++;
    this.totalDurationMs += timeline.totalDurationMs;

    // Record individual tool calls
    for (const call of timeline.toolCalls) {
      this.recordToolCall(
        call.toolName,
        call.durationMs ?? 0,
        call.status === 'success'
      );
    }

    const successCount = timeline.toolCalls.filter((c) => c.status === 'success').length;
    const errorCount = timeline.toolCalls.filter((c) => c.status === 'error').length;

    const session: SessionMetric = {
      sessionId,
      role: role as import('../types').Role,
      requestCount: 1,
      toolCallCount: timeline.toolCalls.length,
      successCount,
      errorCount,
      avgDurationMs: timeline.totalDurationMs,
      lastActiveAt: new Date().toISOString(),
    };

    // Prepend and cap at MAX_RECENT
    this.recentSessions.unshift(session);
    if (this.recentSessions.length > this.MAX_RECENT) {
      this.recentSessions = this.recentSessions.slice(0, this.MAX_RECENT);
    }
  }

  getMetrics(): SystemMetrics {
    const toolMetrics: ToolMetric[] = Array.from(this.toolStats.entries()).map(
      ([toolName, stats]) => ({
        toolName,
        callCount: stats.count,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        avgDurationMs:
          stats.count > 0 ? Math.round(stats.totalDurationMs / stats.count) : 0,
      })
    );

    // Sort by most used
    toolMetrics.sort((a, b) => b.callCount - a.callCount);

    const avgResponseTimeMs =
      this.totalRequests > 0
        ? Math.round(this.totalDurationMs / this.totalRequests)
        : 0;

    const totalSuccess = Array.from(this.toolStats.values()).reduce(
      (sum, s) => sum + s.successCount,
      0
    );
    const successRate =
      this.totalToolCalls > 0
        ? Math.round((totalSuccess / this.totalToolCalls) * 100)
        : 100;

    return {
      totalRequests: this.totalRequests,
      totalToolCalls: this.totalToolCalls,
      totalTokensUsed: this.totalTokensUsed,
      avgResponseTimeMs,
      successRate,
      toolMetrics,
      recentSessions: [...this.recentSessions],
    };
  }

  reset(): void {
    this.totalRequests = 0;
    this.totalToolCalls = 0;
    this.totalTokensUsed = 0;
    this.totalDurationMs = 0;
    this.toolStats.clear();
    this.recentSessions = [];
  }
}

// Singleton export
export const metricsStore = new MetricsStore();
