import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { ToolCall, ToolName, Role } from '../types';
import { toolDefinitions } from './definitions';
import { callApi } from '../connectors/api/rest';
import { scaffoldProject } from '../connectors/filesystem/fs';
import { cloneRepo, commitChanges, createBranch, getDiff, analyzeBreakingChanges, listBranches, pushBranch, getLog, getStatus } from '../connectors/git/git';
import { webSearch, webScrape, fetchJson } from '../connectors/web/scraper';
import { mcpManager } from '../mcp/manager';

// ============================================================
// Tool Registry — executes MCP tools
// ============================================================

export class ToolRegistry {
  private userRole: Role;

  constructor(userRole: Role = 'operator') {
    this.userRole = userRole;
  }

  private canUseTool(toolName: ToolName): boolean {
    const tool = toolDefinitions.find((t) => t.name === toolName);
    if (!tool) return false;
    return tool.permissionRequired.includes(this.userRole);
  }

  async executeTool(toolName: ToolName, args: Record<string, unknown>): Promise<ToolCall> {
    const call: ToolCall = {
      id: uuidv4(),
      toolName,
      args,
      status: 'pending',
      startedAt: new Date(),
    };

    if (!this.canUseTool(toolName)) {
      call.status = 'error';
      call.error = `Permission denied: role '${this.userRole}' cannot use tool '${toolName}'`;
      call.finishedAt = new Date();
      call.durationMs = 0;
      return call;
    }

    call.status = 'running';
    const start = Date.now();

    try {
      call.result = await this.dispatch(toolName, args);
      call.status = 'success';
    } catch (err: any) {
      call.status = 'error';
      call.error = err.message ?? String(err);
    }

    call.finishedAt = new Date();
    call.durationMs = Date.now() - start;
    return call;
  }

  private async dispatch(toolName: ToolName, args: Record<string, unknown>): Promise<unknown> {
    // Helper: resolve git repo path — fallback to CWD if AI gives wrong/missing path
    const resolveRepoPath = (provided: unknown): string => {
      if (provided && typeof provided === 'string') {
        const p = path.resolve(provided);
        if (fs.existsSync(path.join(p, '.git'))) return p;
        if (fs.existsSync(p)) return p;
      }
      // Fallback to project root (where server runs)
      return process.cwd();
    };

    switch (toolName) {
      // ─── Database (via external MCP mysql server) ─────────
      case 'db_query': {
        const sql = args['sql'] as string;
        // Guard against template placeholders like {gold}
        if (/\{[a-zA-Z_]+\}/.test(sql)) {
          throw new Error(
            'SQL contains placeholder like {gold}. Put the REAL value directly, e.g. VALUES (2650.50)'
          );
        }
        return mcpManager.executeTool('mcp__mysql__query', { sql, params: args['params'] });
      }
      case 'db_schema': {
        return mcpManager.executeTool('mcp__mysql__list_tables', {});
      }
      case 'db_migrate': {
        return mcpManager.executeTool('mcp__mysql__query', { sql: args['migrationSql'] });
      }

      // ─── REST API ────────────────────────────────────────
      case 'api_call': {
        return callApi({
          method: args['method'] as any,
          url: args['url'] as string,
          headers: args['headers'] ? JSON.parse(args['headers'] as string) : undefined,
          body: args['body'] ? JSON.parse(args['body'] as string) : undefined,
          auth: args['authType']
            ? {
                type: args['authType'] as any,
                token: args['authToken'] as string | undefined,
                apiKey: args['authToken'] as string | undefined,
              }
            : undefined,
          transformResponse: args['transformResponse'] as string | undefined,
        });
      }

      // ─── File System (via external MCP filesystem server) ──
      case 'fs_read': {
        return mcpManager.executeTool('mcp__filesystem__read_file', { path: args['path'] as string });
      }
      case 'fs_write': {
        return mcpManager.executeTool('mcp__filesystem__write_file', {
          path: args['path'] as string,
          content: args['content'] as string,
        });
      }
      case 'fs_list': {
        return mcpManager.executeTool('mcp__filesystem__list_directory', { path: args['path'] as string });
      }
      case 'fs_scaffold': {
        return scaffoldProject({
          name: args['template'] as any,
          outputDir: args['outputDir'] as string,
          projectName: args['projectName'] as string,
        });
      }

      // ─── Git ─────────────────────────────────────────────
      case 'git_clone': {
        return cloneRepo(args['url'] as string, args['targetDir'] as string);
      }
      case 'git_commit': {
        const files = args['files'] ? JSON.parse(args['files'] as string) : undefined;
        return commitChanges(resolveRepoPath(args['repoPath']), args['message'] as string, files);
      }
      case 'git_diff': {
        const repoPath = resolveRepoPath(args['repoPath']);
        const from = (args['from'] as string) || 'HEAD~1';
        const to = (args['to'] as string) || 'HEAD';
        const summary = await getDiff(repoPath, from, to);

        if (args['analyzeBreaking'] === 'true') {
          const breaking = await analyzeBreakingChanges(repoPath, from, to);
          return { ...summary, breakingAnalysis: breaking };
        }
        return summary;
      }
      case 'git_branch': {
        const repoPath = resolveRepoPath(args['repoPath']);
        if (args['action'] === 'create') {
          return createBranch(repoPath, args['branchName'] as string);
        }
        return listBranches(repoPath);
      }
      case 'git_pr': {
        return pushBranch(
          resolveRepoPath(args['repoPath']),
          (args['remote'] as string) || 'origin',
          args['branch'] as string | undefined
        );
      }
      case 'git_log': {
        const count = args['count'] ? parseInt(args['count'] as string) : 10;
        return getLog(resolveRepoPath(args['repoPath']), count);
      }
      case 'git_status': {
        return getStatus(resolveRepoPath(args['repoPath']));
      }

      // ─── Redis (via external MCP redis server) ───────────
      case 'redis_get': {
        return mcpManager.executeTool('mcp__redis__get', { key: args['key'] });
      }
      case 'redis_set': {
        return mcpManager.executeTool('mcp__redis__set', {
          key: args['key'],
          value: args['value'],
          ...(args['ttl'] ? { expireSeconds: parseInt(args['ttl'] as string) } : {}),
        });
      }
      case 'redis_queue': {
        const queueName = args['queueName'] as string;
        switch (args['action']) {
          case 'push':
            return mcpManager.executeTool('mcp__redis__rpush', {
              key: queueName,
              value: args['job'],
            });
          case 'pop':
            return mcpManager.executeTool('mcp__redis__lpop', { key: queueName });
          case 'status':
            return mcpManager.executeTool('mcp__redis__llen', { key: queueName });
          case 'peek':
            return mcpManager.executeTool('mcp__redis__lrange', { key: queueName, start: 0, stop: 9 });
          default:
            throw new Error(`Unknown queue action: ${args['action']}`);
        }
      }
      case 'redis_pubsub': {
        return mcpManager.executeTool('mcp__redis__publish', {
          channel: args['channel'],
          message: args['message'],
        });
      }

      case 'web_search': {
        const results = await webSearch(
          args['query'] as string,
          Math.min(Number(args['maxResults'] ?? 5), 10)
        );
        return { query: args['query'], results, total: results.length };
      }

      case 'web_scrape': {
        return webScrape(args['url'] as string, args['selector'] as string | undefined);
      }

      case 'web_fetch_json': {
        const data = await fetchJson(
          args['url'] as string,
          args['params'] as Record<string, string> | undefined
        );
        return data;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

// ─── Utility ────────────────────────────────────────────────
export function getAllToolNames(): ToolName[] {
  return toolDefinitions.map((t) => t.name as ToolName);
}
