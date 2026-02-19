import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, Role } from '../types';

// ============================================================
// Session Memory — In-process store (upgradable to Redis)
// ============================================================

export interface SessionMemory {
  sessionId: string;
  userId: string;
  role: Role;
  messages: AgentMessage[];
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const sessions = new Map<string, SessionMemory>();

// ─── Create Session ──────────────────────────────────────────
export function createSession(userId: string, role: Role = 'operator'): SessionMemory {
  const sessionId = uuidv4();
  const session: SessionMemory = {
    sessionId,
    userId,
    role,
    messages: [],
    variables: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(sessionId, session);
  return session;
}

// ─── Get Session ─────────────────────────────────────────────
export function getSession(sessionId: string): SessionMemory | undefined {
  return sessions.get(sessionId);
}

// ─── Get or Create ───────────────────────────────────────────
export function getOrCreateSession(
  sessionId: string | undefined,
  userId: string,
  role: Role = 'operator'
): SessionMemory {
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
  }
  return createSession(userId, role);
}

// ─── Clear Session ───────────────────────────────────────────
export function clearSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// ─── Set Variable ────────────────────────────────────────────
export function setVariable(sessionId: string, key: string, value: unknown): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.variables[key] = value;
    session.updatedAt = new Date();
  }
}

// ─── Get History Summary ─────────────────────────────────────
export function getHistorySummary(sessionId: string): {
  messageCount: number;
  toolCallCount: number;
  lastActivity: Date | undefined;
} {
  const session = sessions.get(sessionId);
  if (!session) return { messageCount: 0, toolCallCount: 0, lastActivity: undefined };

  const toolCallCount = session.messages.reduce(
    (acc, m) => acc + (m.toolCalls?.length ?? 0),
    0
  );

  return {
    messageCount: session.messages.length,
    toolCallCount,
    lastActivity: session.updatedAt,
  };
}

// ─── List All Sessions ───────────────────────────────────────
export function listSessions(): Array<{
  sessionId: string;
  userId: string;
  role: Role;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}> {
  return Array.from(sessions.values()).map((s) => ({
    sessionId: s.sessionId,
    userId: s.userId,
    role: s.role,
    messageCount: s.messages.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}
