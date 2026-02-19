import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import readline from 'readline';

// ============================================================
// MCP Server Client — MCP JSON-RPC over stdio (no SDK needed)
// ============================================================

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface ExternalMCPTool {
  serverId: string;
  serverName: string;
  name: string;        // original tool name
  fullName: string;    // mcp__<serverId>__<toolName>
  description: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcResponse {
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export class MCPServerClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private config: MCPServerConfig;
  private tools: ExternalMCPTool[] = [];
  private connected = false;
  private pending = new Map<number | string, {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }>();
  private idCounter = 1;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.proc = spawn(this.config.command, this.config.args ?? [], {
      env: { ...process.env as Record<string, string>, ...(this.config.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    // Read line-delimited JSON from stdout
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error.message));
            else p.resolve(msg.result);
          }
        }
      } catch { /* ignore malformed lines */ }
    });

    this.proc.on('exit', () => { this.connected = false; });

    // MCP handshake
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ai-mcp-hub', version: '1.0.0' },
    });

    // Send initialized notification (no response expected)
    this.notify('notifications/initialized', {});

    this.connected = true;

    // Discover tools
    const result = await this.request('tools/list', {}) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    };
    const rawTools = result?.tools ?? [];
    this.tools = rawTools.map((t) => ({
      serverId: this.config.id,
      serverName: this.config.name,
      name: t.name,
      fullName: `mcp__${this.config.id}__${t.name}`,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
    }));
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.proc?.kill();
    this.proc = null;
    this.tools = [];
    for (const [, p] of this.pending) p.reject(new Error('Disconnected'));
    this.pending.clear();
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.request('tools/call', { name: toolName, arguments: args }) as {
      content?: Array<{ type: string; text?: string }>;
    };
    if (Array.isArray(result?.content)) {
      return result.content
        .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
        .join('\n');
    }
    return result;
  }

  private request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc) { reject(new Error('Not connected')); return; }
      const id = this.idCounter++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.proc.stdin.write(msg + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  private notify(method: string, params: unknown): void {
    if (!this.proc) return;
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  getTools(): ExternalMCPTool[] { return this.tools; }
  isConnected(): boolean { return this.connected; }
  getConfig(): MCPServerConfig { return this.config; }
}
