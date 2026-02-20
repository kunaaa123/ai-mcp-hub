'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database, Globe, FolderOpen, GitBranch, Layers, Lock, ShieldCheck, Search, RefreshCw } from 'lucide-react';
import type { Role } from '../hooks/useAgent';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ToolInfo {
  name: string;
  description: string;
  safeForProduction: boolean;
  permissionRequired: string[];
}

const CATEGORY_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  db:    { label: 'Database', icon: <Database size={14} />, color: 'text-blue-400' },
  api:   { label: 'REST API', icon: <Globe size={14} />, color: 'text-green-400' },
  fs:    { label: 'File System', icon: <FolderOpen size={14} />, color: 'text-yellow-400' },
  git:   { label: 'Git', icon: <GitBranch size={14} />, color: 'text-purple-400' },
  redis: { label: 'Redis', icon: <Layers size={14} />, color: 'text-red-400' },
  web:   { label: 'Web', icon: <Search size={14} />, color: 'text-cyan-400' },
  other: { label: 'Other', icon: <Globe size={14} />, color: 'text-gray-400' },
};

function getCategory(toolName: string): string {
  if (toolName.startsWith('db_')) return 'db';
  if (toolName.startsWith('api_')) return 'api';
  if (toolName.startsWith('fs_')) return 'fs';
  if (toolName.startsWith('git_')) return 'git';
  if (toolName.startsWith('redis_')) return 'redis';
  if (toolName.startsWith('web_')) return 'web';
  return 'other';
}

interface ToolsSidebarProps {
  role: Role;
}

export function ToolsSidebar({ role }: ToolsSidebarProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>('db');
  const [error, setError] = useState(false);

  const roleTokens: Record<Role, string> = {
    admin: 'admin-key-secret',
    operator: 'operator-key-secret',
    dev: 'dev-key-secret',
    readonly: 'readonly-key-secret',
  };

  const fetchTools = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`${API_URL}/api/tools`, {
      headers: { Authorization: `Bearer ${roleTokens[role]}` },
    })
      .then((r) => r.json())
      .then((d) => { setTools(d.data?.tools ?? []); setError(false); })
      .catch(() => { setTools([]); setError(true); })
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Loading tools...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Backend offline</p>
        <button
          onClick={fetchTools}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, ToolInfo[]> = {};
  for (const tool of tools) {
    const cat = getCategory(tool.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(tool);
  }

  return (
    <div className="p-3 space-y-2">
      <div className="px-1 pb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-white">{tools.length} tools available</p>
        <div className="flex items-center gap-2">
          <button onClick={fetchTools} title="Refresh tools"
            className="opacity-50 hover:opacity-100 transition-opacity">
            <RefreshCw size={11} style={{ color: 'var(--text-muted)' }} />
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Role: <span className="text-purple-400">{role}</span>
          </span>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, catTools]) => {
        const meta = CATEGORY_MAP[cat] ?? { label: cat, icon: null, color: 'text-gray-400' };
        const isExpanded = expandedCat === cat;

        return (
          <div key={cat} className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
              style={{ background: 'var(--bg-card)' }}
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
            >
              <span className={meta.color}>{meta.icon}</span>
              <span className="text-xs font-medium text-white flex-1">{meta.label}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                {catTools.length}
              </span>
            </button>

            {isExpanded && (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {catTools.map((tool) => (
                  <div key={tool.name} className="px-3 py-2"
                    style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-xs font-mono text-purple-300">{tool.name}</code>
                      <div className="flex items-center gap-1">
                        {tool.safeForProduction
                          ? <span title="Production safe"><ShieldCheck size={11} className="text-green-400" /></span>
                          : <span title="Not production safe"><Lock size={11} className="text-orange-400" /></span>
                        }
                      </div>
                    </div>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {tool.description.split('.')[0]}.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
