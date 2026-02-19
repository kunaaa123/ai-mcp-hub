import { Role, ToolName, MCPTool } from '../types';
import { toolDefinitions } from '../tools/definitions';

// ============================================================
// Role-Based Access Control (RBAC)
// ============================================================

export const ROLE_HIERARCHY: Record<Role, number> = {
  readonly: 0,
  dev: 1,
  operator: 2,
  admin: 3,
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  readonly: 'Can only read data (db_schema, fs_read, fs_list, git_diff, redis_get)',
  dev: 'Can read/write files, run queries, git operations — no destructive DB ops',
  operator: 'Full tool access except schema migrations. Production-safe by default.',
  admin: 'Unrestricted access to all tools including migrations and destructive operations.',
};

// ─── Check Permission ────────────────────────────────────────
export function canUseToolWithRole(role: Role, toolName: ToolName): boolean {
  const tool = toolDefinitions.find((t) => t.name === toolName);
  if (!tool) return false;
  return tool.permissionRequired.includes(role);
}

// ─── Get Available Tools for Role ────────────────────────────
export function getAvailableTools(
  role: Role,
  productionSafeMode = false
): MCPTool[] {
  return toolDefinitions.filter((tool) => {
    if (!tool.permissionRequired.includes(role)) return false;
    if (productionSafeMode && !tool.safeForProduction) return false;
    return true;
  });
}

// ─── Validate Role ───────────────────────────────────────────
export function isValidRole(role: string): role is Role {
  return ['admin', 'operator', 'dev', 'readonly'].includes(role);
}

// ─── Get Role Level ──────────────────────────────────────────
export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role];
}

// ─── Simple API Key → Role mapping (demo) ───────────────────
const API_KEY_ROLES: Record<string, Role> = {
  'admin-key-secret': 'admin',
  'operator-key-secret': 'operator',
  'dev-key-secret': 'dev',
  'readonly-key-secret': 'readonly',
};

export function getRoleFromApiKey(apiKey: string): Role | null {
  return API_KEY_ROLES[apiKey] ?? null;
}

export function getRoleFromHeader(authHeader?: string): Role {
  if (!authHeader) return 'readonly';
  const key = authHeader.replace('Bearer ', '').trim();
  return getRoleFromApiKey(key) ?? 'readonly';
}

// ─── Permission Summary ──────────────────────────────────────
export function getPermissionSummary(role: Role): {
  role: Role;
  level: number;
  description: string;
  allowedTools: string[];
  blockedTools: string[];
} {
  const allowed = getAvailableTools(role).map((t) => t.name);
  const blocked = toolDefinitions
    .filter((t) => !t.permissionRequired.includes(role))
    .map((t) => t.name);

  return {
    role,
    level: getRoleLevel(role),
    description: ROLE_DESCRIPTIONS[role],
    allowedTools: allowed,
    blockedTools: blocked,
  };
}
