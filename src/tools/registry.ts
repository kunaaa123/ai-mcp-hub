import { v4 as uuidv4 } from 'uuid';
import { ToolCall, ToolName, Role } from '../types';
import { toolDefinitions } from './definitions';
import { runQuery, getSchema, executeMigration } from '../connectors/database/mysql';
import { callApi } from '../connectors/api/rest';
import { readFile, writeFile, listDir, searchFiles, scaffoldProject } from '../connectors/filesystem/fs';
import { cloneRepo, commitChanges, createBranch, getDiff, getDiffContent, analyzeBreakingChanges, listBranches, pushBranch, getLog, getStatus } from '../connectors/git/git';
import { redisGet, redisSet, queuePush, queuePop, queueLength, queuePeek, getQueueStatus, publishMessage } from '../connectors/redis/redis';
import { webSearch, webScrape } from '../connectors/web/scraper';

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
    switch (toolName) {
      // ─── Database ────────────────────────────────────────
      case 'db_query': {
        const sql = args['sql'] as string;
        const params = args['params'] ? JSON.parse(args['params'] as string) : [];
        return runQuery(sql, params);
      }
      case 'db_schema': {
        return getSchema(args['database'] as string | undefined);
      }
      case 'db_migrate': {
        return executeMigration(args['migrationSql'] as string);
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

      // ─── File System ─────────────────────────────────────
      case 'fs_read': {
        const content = await readFile(args['path'] as string);
        return { path: args['path'], content };
      }
      case 'fs_write': {
        return writeFile(args['path'] as string, args['content'] as string);
      }
      case 'fs_list': {
        if (args['pattern']) {
          const files = await searchFiles(args['pattern'] as string, args['path'] as string);
          return { files, total: files.length };
        }
        return listDir(args['path'] as string);
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
        return commitChanges(args['repoPath'] as string, args['message'] as string, files);
      }
      case 'git_diff': {
        const repoPath = args['repoPath'] as string;
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
        const repoPath = args['repoPath'] as string;
        if (args['action'] === 'create') {
          return createBranch(repoPath, args['branchName'] as string);
        }
        return listBranches(repoPath);
      }
      case 'git_pr': {
        return pushBranch(
          args['repoPath'] as string,
          (args['remote'] as string) || 'origin',
          args['branch'] as string | undefined
        );
      }
      case 'git_log': {
        const count = args['count'] ? parseInt(args['count'] as string) : 10;
        return getLog(args['repoPath'] as string, count);
      }
      case 'git_status': {
        return getStatus(args['repoPath'] as string);
      }

      // ─── Redis ───────────────────────────────────────────
      case 'redis_get': {
        const value = await redisGet(args['key'] as string);
        return { key: args['key'], value };
      }
      case 'redis_set': {
        const ttl = args['ttl'] ? parseInt(args['ttl'] as string) : undefined;
        const result = await redisSet(args['key'] as string, args['value'] as string, ttl);
        return { key: args['key'], result };
      }
      case 'redis_queue': {
        const queueName = args['queueName'] as string;
        switch (args['action']) {
          case 'push': return queuePush(queueName, JSON.parse(args['job'] as string));
          case 'pop': return queuePop(queueName);
          case 'status': return getQueueStatus(queueName);
          case 'peek': return queuePeek(queueName, 10);
          default: throw new Error(`Unknown queue action: ${args['action']}`);
        }
      }
      case 'redis_pubsub': {
        const count = await publishMessage(args['channel'] as string, JSON.parse(args['message'] as string));
        return { channel: args['channel'], receiverCount: count };
      }

      case 'web_search': {
        const results = await webSearch(
          args['query'] as string,
          Math.min(Number(args['maxResults'] ?? 5), 10)
        );
        return { query: args['query'], results, total: results.length };
      }

      case 'web_scrape': {
        const result = await webScrape(
          args['url'] as string,
          args['selector'] as string | undefined
        );
        return result;
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
