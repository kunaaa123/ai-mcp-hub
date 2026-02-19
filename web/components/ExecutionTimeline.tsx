'use client';

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight,
  Database, Globe, FolderOpen, GitBranch, Layers, Zap
} from 'lucide-react';
import type { ExecutionTimeline as Timeline, ToolCall } from '../hooks/useAgent';

interface ExecutionTimelineProps {
  timelines: Timeline[];
  currentTimeline: Timeline | null;
  isLoading: boolean;
}

// Tool category icons
const TOOL_ICONS: Record<string, React.ReactNode> = {
  db_query:   <Database size={14} className="text-blue-400" />,
  db_schema:  <Database size={14} className="text-blue-400" />,
  db_migrate: <Database size={14} className="text-orange-400" />,
  api_call:   <Globe size={14} className="text-green-400" />,
  fs_read:    <FolderOpen size={14} className="text-yellow-400" />,
  fs_write:   <FolderOpen size={14} className="text-yellow-400" />,
  fs_list:    <FolderOpen size={14} className="text-yellow-400" />,
  fs_scaffold:<FolderOpen size={14} className="text-yellow-400" />,
  git_clone:  <GitBranch size={14} className="text-purple-400" />,
  git_commit: <GitBranch size={14} className="text-purple-400" />,
  git_diff:   <GitBranch size={14} className="text-purple-400" />,
  git_branch: <GitBranch size={14} className="text-purple-400" />,
  git_pr:     <GitBranch size={14} className="text-purple-400" />,
  redis_get:  <Layers size={14} className="text-red-400" />,
  redis_set:  <Layers size={14} className="text-red-400" />,
  redis_queue:<Layers size={14} className="text-red-400" />,
  redis_pubsub:<Layers size={14} className="text-red-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  running: 'text-blue-400',
  pending: 'text-gray-400',
  skipped: 'text-gray-500',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={14} className="text-green-400" />,
  error:   <XCircle size={14} className="text-red-400" />,
  running: <Loader2 size={14} className="text-blue-400 animate-spin" />,
  pending: <Clock size={14} className="text-gray-400" />,
  skipped: <Clock size={14} className="text-gray-500" />,
};

export function ExecutionTimeline({ timelines, currentTimeline, isLoading }: ExecutionTimelineProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);

  const displayTimeline = selectedTimeline ?? currentTimeline;

  const toggleExpand = (id: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      {displayTimeline && (
        <div className="p-3 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white">Current Run</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {displayTimeline.totalDurationMs > 0
                ? `${(displayTimeline.totalDurationMs / 1000).toFixed(2)}s`
                : isLoading ? 'Running...' : '—'}
            </span>
          </div>
          <p className="truncate" style={{ color: 'var(--text-muted)' }}>
            {displayTimeline.userPrompt}
          </p>
          <div className="flex gap-3 mt-2">
            <Stat label="Tools" value={displayTimeline.toolCalls.length} color="text-blue-400" />
            <Stat label="Success" value={displayTimeline.toolCalls.filter((t) => t.status === 'success').length} color="text-green-400" />
            <Stat label="Errors" value={displayTimeline.toolCalls.filter((t) => t.status === 'error').length} color="text-red-400" />
          </div>
        </div>
      )}

      {/* Tool Calls List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!displayTimeline && !isLoading && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Zap size={24} className="text-purple-500 mb-2" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tool executions will appear here
            </p>
          </div>
        )}

        {isLoading && displayTimeline?.toolCalls.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Loader2 size={14} className="text-purple-400 animate-spin" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              AI กำลังวิเคราะห์...
            </span>
          </div>
        )}

        {displayTimeline?.toolCalls.map((call, index) => (
          <ToolCallCard
            key={call.id}
            call={call}
            index={index}
            expanded={expandedCalls.has(call.id)}
            onToggle={() => toggleExpand(call.id)}
          />
        ))}
      </div>

      {/* History */}
      {allTimelinesSection(timelines, setSelectedTimeline, selectedTimeline, currentTimeline)}
    </div>
  );
}

function allTimelinesSection(
  timelines: Timeline[],
  onSelect: (t: Timeline | null) => void,
  selected: Timeline | null,
  current: Timeline | null
) {
  if (timelines.length === 0) return null;
  return (
    <div className="border-t p-2" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
        History ({timelines.length})
      </p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
            !selected ? 'bg-purple-500/10 text-purple-300' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Current
        </button>
        {[...timelines].reverse().map((t, i) => (
          <button
            key={t.startedAt + i}
            onClick={() => onSelect(t)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate ${
              selected === t ? 'bg-purple-500/10 text-purple-300' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.toolCalls.length} tools — {t.userPrompt.slice(0, 30)}...
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tool Call Card ──────────────────────────────────────────
function ToolCallCard({
  call, index, expanded, onToggle,
}: {
  call: ToolCall;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const icon = TOOL_ICONS[call.toolName] ?? <Zap size={14} className="text-gray-400" />;

  return (
    <div
      className="rounded-lg overflow-hidden cursor-pointer transition-all hover:opacity-90"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
          {index + 1}
        </span>
        {icon}
        <span className="text-xs font-mono font-medium flex-1 truncate text-white">
          {call.toolName}
        </span>
        <span className="flex items-center gap-1">
          {STATUS_ICONS[call.status]}
          {call.durationMs !== undefined && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {call.durationMs}ms
            </span>
          )}
          {expanded
            ? <ChevronDown size={12} className="text-gray-500" />
            : <ChevronRight size={12} className="text-gray-500" />
          }
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Args */}
          <div>
            <p className="text-xs font-medium pt-2 mb-1" style={{ color: 'var(--text-muted)' }}>
              Arguments
            </p>
            <pre className="text-xs rounded p-2 overflow-x-auto leading-relaxed"
              style={{ background: 'var(--bg-primary)', color: '#a5f3fc' }}>
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {call.result !== undefined && (
            <div>
              <p className="text-xs font-medium mb-1 text-green-400">Result</p>
              <pre className="text-xs rounded p-2 overflow-x-auto max-h-48 leading-relaxed"
                style={{ background: 'var(--bg-primary)', color: '#86efac' }}>
                {JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {call.error && (
            <div>
              <p className="text-xs font-medium mb-1 text-red-400">Error</p>
              <pre className="text-xs rounded p-2 overflow-x-auto"
                style={{ background: 'var(--bg-primary)', color: '#fca5a5' }}>
                {call.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat pill ───────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`font-bold ${color}`}>{value}</span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </span>
  );
}
