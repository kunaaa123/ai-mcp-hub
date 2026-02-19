'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';

// ============================================================
// Types (mirrored from backend)
// ============================================================
interface ToolMetric {
  toolName: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
}

interface SessionMetric {
  sessionId: string;
  role: string;
  requestCount: number;
  toolCallCount: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  lastActiveAt: string;
}

interface SystemMetrics {
  totalRequests: number;
  totalToolCalls: number;
  totalTokensUsed: number;
  avgResponseTimeMs: number;
  successRate: number;
  toolMetrics: ToolMetric[];
  recentSessions: SessionMetric[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ============================================================
// Helper Components
// ============================================================

function StatCard({
  label,
  value,
  sub,
  color = 'var(--accent)',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        minWidth: 160,
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ToolBar({
  tool,
  maxCount,
}: {
  tool: ToolMetric;
  maxCount: number;
}) {
  const width = maxCount > 0 ? (tool.callCount / maxCount) * 100 : 0;
  const successRate =
    tool.callCount > 0 ? Math.round((tool.successCount / tool.callCount) * 100) : 100;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
          fontSize: 12,
        }}
      >
        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {tool.toolName}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {tool.callCount} calls · {successRate}% ok · {tool.avgDurationMs}ms avg
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--bg-primary)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: '100%',
            background:
              successRate >= 80
                ? 'var(--success, #22c55e)'
                : successRate >= 50
                ? 'var(--warning, #f59e0b)'
                : 'var(--error, #ef4444)',
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Main Metrics Page
// ============================================================

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      const json = await res.json();
      if (json.success) {
        setMetrics(json.data);
        setError(null);
      } else {
        setError(json.error ?? 'Failed to fetch metrics');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  const resetMetrics = async () => {
    if (!confirm('Reset all metrics? This cannot be undone.')) return;
    await fetch(`${API_BASE}/api/metrics`, { method: 'DELETE' });
    await fetchMetrics();
  };

  // Initial load + auto-refresh every 10s
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const maxToolCount =
    metrics?.toolMetrics.reduce((m, t) => Math.max(m, t.callCount), 0) ?? 1;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans, sans-serif)',
        padding: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          <ArrowLeft size={16} />
          Back to Chat
        </Link>

        <h1
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: 700,
            margin: 0,
            color: 'var(--accent)',
          }}
        >
          System Metrics
        </h1>

        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Auto-refresh every 10s · Last: {lastRefresh.toLocaleTimeString()}
        </span>

        <button
          onClick={fetchMetrics}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>

        <button
          onClick={resetMetrics}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: '#ef4444',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          <Trash2 size={14} />
          Reset
        </button>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 60 }}>
          Loading metrics...
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#1f0707',
            border: '1px solid #ef4444',
            borderRadius: 10,
            padding: '12px 16px',
            color: '#ef4444',
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 32,
            }}
          >
            <StatCard label="Total Requests" value={metrics.totalRequests} />
            <StatCard label="Total Tool Calls" value={metrics.totalToolCalls} />
            <StatCard
              label="Success Rate"
              value={`${metrics.successRate}%`}
              color={
                metrics.successRate >= 80
                  ? '#22c55e'
                  : metrics.successRate >= 50
                  ? '#f59e0b'
                  : '#ef4444'
              }
            />
            <StatCard
              label="Avg Response Time"
              value={`${metrics.avgResponseTimeMs}ms`}
              sub="per request"
            />
            <StatCard
              label="Tools Used"
              value={metrics.toolMetrics.length}
              sub={`of all available tools`}
            />
          </div>

          {/* Tool Metrics */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px 0' }}>
              Tool Usage
            </h2>
            {metrics.toolMetrics.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                No tool calls recorded yet. Start a chat to see data here.
              </div>
            ) : (
              metrics.toolMetrics.map((t) => (
                <ToolBar key={t.toolName} tool={t} maxCount={maxToolCount} />
              ))
            )}
          </div>

          {/* Recent Sessions */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px 0' }}>
              Recent Sessions
            </h2>
            {metrics.recentSessions.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                No sessions recorded yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>Session</th>
                    <th style={{ padding: '4px 8px' }}>Role</th>
                    <th style={{ padding: '4px 8px' }}>Tool Calls</th>
                    <th style={{ padding: '4px 8px' }}>Success</th>
                    <th style={{ padding: '4px 8px' }}>Errors</th>
                    <th style={{ padding: '4px 8px' }}>Duration</th>
                    <th style={{ padding: '4px 8px' }}>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentSessions.map((s, i) => (
                    <tr
                      key={i}
                      style={{
                        borderTop: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                        {s.sessionId.slice(0, 8)}...
                      </td>
                      <td style={{ padding: '6px 8px' }}>{s.role}</td>
                      <td style={{ padding: '6px 8px' }}>{s.toolCallCount}</td>
                      <td style={{ padding: '6px 8px', color: '#22c55e' }}>
                        {s.successCount}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          color: s.errorCount > 0 ? '#ef4444' : 'var(--text-secondary)',
                        }}
                      >
                        {s.errorCount}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{s.avgDurationMs}ms</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                        {new Date(s.lastActiveAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
