import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MCPServerClient, MCPServerConfig, ExternalMCPTool } from './client';

// ============================================================
// MCP Server Manager — manages multiple external MCP servers
// ============================================================

const CONFIG_FILE = path.join(process.cwd(), 'mcp-servers.json');

export interface MCPServerStatus extends MCPServerConfig {
  connected: boolean;
  toolCount: number;
  error?: string;
}

class MCPServerManager {
  private clients: Map<string, MCPServerClient> = new Map();
  private configs: MCPServerConfig[] = [];
  private errors: Map<string, string> = new Map();

  constructor() {
    this.loadConfigs();
  }

  // ─── Persistence ─────────────────────────────────────────
  private loadConfigs(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as MCPServerConfig[];
        this.configs = Array.isArray(data) ? data : [];
        console.log(`[MCP] Loaded ${this.configs.length} server config(s)`);
      }
    } catch (e: any) {
      console.warn('[MCP] Could not load mcp-servers.json:', e.message);
    }
  }

  private saveConfigs(): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.configs, null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[MCP] Failed to save configs:', e.message);
    }
  }

  // ─── Connection ──────────────────────────────────────────
  async connectAll(): Promise<void> {
    for (const config of this.configs) {
      if (config.enabled) {
        await this.connectServer(config);
      }
    }
  }

  private async connectServer(config: MCPServerConfig): Promise<void> {
    // Disconnect existing client if any
    const existing = this.clients.get(config.id);
    if (existing) {
      await existing.disconnect().catch(() => {});
      this.clients.delete(config.id);
    }

    try {
      const client = new MCPServerClient(config);
      await client.connect();
      this.clients.set(config.id, client);
      this.errors.delete(config.id);
      console.log(`[MCP] ✅ ${config.name} — ${client.getTools().length} tools ready`);
    } catch (e: any) {
      this.errors.set(config.id, e.message);
      console.error(`[MCP] ❌ Failed to connect '${config.name}': ${e.message}`);
    }
  }

  // ─── CRUD ────────────────────────────────────────────────
  async addServer(input: Omit<MCPServerConfig, 'id'>): Promise<MCPServerConfig> {
    const config: MCPServerConfig = { ...input, id: uuidv4() };
    this.configs.push(config);
    this.saveConfigs();
    if (config.enabled) {
      await this.connectServer(config);
    }
    return config;
  }

  async removeServer(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect().catch(() => {});
      this.clients.delete(id);
    }
    this.errors.delete(id);
    this.configs = this.configs.filter((c) => c.id !== id);
    this.saveConfigs();
  }

  async updateServer(id: string, updates: Partial<Omit<MCPServerConfig, 'id'>>): Promise<MCPServerConfig> {
    const idx = this.configs.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`MCP server '${id}' not found`);
    this.configs[idx] = { ...this.configs[idx]!, ...updates };
    this.saveConfigs();
    // Reconnect if enabled
    if (this.configs[idx]!.enabled) {
      await this.connectServer(this.configs[idx]!);
    } else {
      const client = this.clients.get(id);
      if (client) {
        await client.disconnect().catch(() => {});
        this.clients.delete(id);
      }
    }
    return this.configs[idx]!;
  }

  async reconnectServer(id: string): Promise<void> {
    const config = this.configs.find((c) => c.id === id);
    if (!config) throw new Error(`MCP server '${id}' not found`);
    await this.connectServer(config);
  }

  // ─── Tools ───────────────────────────────────────────────
  getAllTools(): ExternalMCPTool[] {
    const tools: ExternalMCPTool[] = [];
    for (const client of this.clients.values()) {
      if (client.isConnected()) tools.push(...client.getTools());
    }
    return tools;
  }

  /** Convert external MCP tools to Ollama-compatible tool format */
  toOllamaTools(): object[] {
    return this.getAllTools().map((t) => ({
      type: 'function',
      function: {
        name: t.fullName,
        description: `[${t.serverName}] ${t.description}`,
        parameters: t.inputSchema,
      },
    }));
  }

  // ─── Execution ───────────────────────────────────────────
  async executeTool(fullName: string, args: Record<string, unknown>): Promise<unknown> {
    // fullName format: mcp__<serverId>__<toolName>
    const withoutPrefix = fullName.slice('mcp__'.length);
    const firstDouble = withoutPrefix.indexOf('__');
    if (firstDouble === -1) throw new Error(`Invalid MCP tool name: ${fullName}`);
    const serverId = withoutPrefix.slice(0, firstDouble);
    const toolName = withoutPrefix.slice(firstDouble + 2);

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      throw new Error(`MCP server '${serverId}' is not connected`);
    }
    return client.callTool(toolName, args);
  }

  // ─── Status ──────────────────────────────────────────────
  getStatus(): MCPServerStatus[] {
    return this.configs.map((c) => {
      const client = this.clients.get(c.id);
      return {
        ...c,
        connected: client?.isConnected() ?? false,
        toolCount: client?.getTools().length ?? 0,
        error: this.errors.get(c.id),
      };
    });
  }
}

// Singleton
export const mcpManager = new MCPServerManager();
