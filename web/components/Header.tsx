'use client';

import { Brain, RefreshCw, Shield, Wifi } from 'lucide-react';
import type { Role } from '../hooks/useAgent';

interface HeaderProps {
  sessionId: string | undefined;
  role: Role;
  onRoleChange: (role: Role) => void;
  onClearSession: () => void;
  isLoading: boolean;
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'text-red-400 border-red-400/40 bg-red-400/5',
  operator: 'text-purple-400 border-purple-400/40 bg-purple-400/5',
  dev: 'text-blue-400 border-blue-400/40 bg-blue-400/5',
  readonly: 'text-gray-400 border-gray-400/40 bg-gray-400/5',
};

const ROLES: Role[] = ['admin', 'operator', 'dev', 'readonly'];

export function Header({ sessionId, role, onRoleChange, onClearSession, isLoading }: HeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)' }}
        >
          <Brain size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">AI MCP Hub</h1>
          <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
            System Operator · Ollama
          </p>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-3">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Running...
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Wifi size={12} className="text-green-400" />
            Ready
          </div>
        )}

        {sessionId && (
          <code
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {sessionId.slice(0, 8)}...
          </code>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {/* Role Selector */}
        <div className="flex items-center gap-1.5">
          <Shield size={13} style={{ color: 'var(--text-muted)' }} />
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            className={`text-xs px-2 py-1 rounded border bg-transparent outline-none cursor-pointer ${ROLE_COLORS[role]}`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-gray-900 text-white">
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Session */}
        <button
          onClick={onClearSession}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-gray-500"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Clear session"
        >
          <RefreshCw size={12} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}
