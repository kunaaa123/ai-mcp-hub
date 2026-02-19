// ============================================================
// Core Types for AI MCP Hub
// ============================================================

export type ToolName =
  | 'db_query'
  | 'db_schema'
  | 'db_migrate'
  | 'api_call'
  | 'fs_read'
  | 'fs_write'
  | 'fs_list'
  | 'fs_scaffold'
  | 'git_clone'
  | 'git_commit'
  | 'git_diff'
  | 'git_branch'
  | 'git_pr'
  | 'redis_get'
  | 'redis_set'
  | 'redis_queue'
  | 'redis_pubsub';

export type Role = 'admin' | 'operator' | 'readonly' | 'dev';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

// ─── Tool Call ───────────────────────────────────────────────
export interface ToolCall {
  id: string;
  toolName: ToolName;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: ToolStatus;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
}

// ─── Execution Timeline ──────────────────────────────────────
export interface ExecutionTimeline {
  sessionId: string;
  userPrompt: string;
  toolCalls: ToolCall[];
  finalResponse: string;
  totalDurationMs: number;
  startedAt: Date;
  finishedAt?: Date;
}

// ─── Agent Message ───────────────────────────────────────────
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

// ─── MCP Tool Definition ─────────────────────────────────────
export interface MCPTool {
  name: ToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
  permissionRequired: Role[];
  safeForProduction: boolean;
}

// ─── Connector Config ────────────────────────────────────────
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  type: 'mysql' | 'postgres' | 'sqlite';
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  contextLength: number;
  timeout: number;
}

// ─── App Config ──────────────────────────────────────────────
export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  ollama: OllamaConfig;
  productionSafeMode: boolean;
}

// ─── Session Memory ──────────────────────────────────────────
export interface SessionMemory {
  sessionId: string;
  userId: string;
  role: Role;
  messages: AgentMessage[];
  variables: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Ollama API Response ─────────────────────────────────────
export interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// ─── API Response Wrapper ────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
