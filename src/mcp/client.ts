import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

// ============================================================
// MCP Server Client — wraps one external MCP server connection
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

export class MCPServerClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private config: MCPServerConfig;
  private connected = false;
  private tools: ExternalMCPTool[] = [];

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.client = new Client(
      { name: 'ai-mcp-hub', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args ?? [],
      env: { ...(process.env as Record<string, string>), ...(this.config.env ?? {}) },
      stderr: 'pipe',
    });

    await this.client.connect(this.transport);
    this.connected = true;

    // Discover all tools from this server
    const result = await this.client.listTools();
    this.tools = result.tools.map((t: { name: string; description?: string; inputSchema?: Record<string, unknown> }) => ({
      serverId: this.config.id,
      serverName: this.config.name,
      name: t.name,
      fullName: `mcp__${this.config.id}__${t.name}`,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
    }));
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch { /* ignore */ }
    this.connected = false;
    this.tools = [];
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.client.callTool({ name: toolName, arguments: args });
    // Return content as a readable string
    if (Array.isArray(result.content)) {
      return result.content
        .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
        .join('\n');
    }
    return result.content;
  }

  getTools(): ExternalMCPTool[] { return this.tools; }
  isConnected(): boolean { return this.connected; }
  getConfig(): MCPServerConfig { return this.config; }
}
