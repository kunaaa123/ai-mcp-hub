import { MCPTool, ToolName } from '../types';

// ============================================================
// MCP Tool Definitions (all connectors)
// ============================================================

export const toolDefinitions: MCPTool[] = [
  // ─── Database Tools ───────────────────────────────────────
  {
    name: 'db_query',
    description:
      'Execute a SQL query on the MySQL database. CRITICAL: NEVER use template placeholders like {gold} or {price} in SQL. After fetching data from web_fetch_json, extract the REAL number and put it directly in SQL. Example for inserting gold price: sql="INSERT INTO gold (price_usd, recorded_at) VALUES (2650.50, NOW())" — put the actual fetched number, not a variable name.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL query. Use real values like 2650.50 directly, or use ? placeholders with params array. NEVER use {variable} syntax.' },
        params: { type: 'string', description: 'JSON array of parameters for ? placeholders: e.g. [2650.50] or ["text", 42]. Each element maps to one ? in order.' },
      },
      required: ['sql'],
    },
    permissionRequired: ['admin', 'operator', 'dev'],
    safeForProduction: true,
  },
  {
    name: 'db_schema',
    description: 'Inspect the database schema: tables, columns, types, and constraints.',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Database name to inspect (optional, uses default)' },
      },
      required: [],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'db_migrate',
    description: 'Execute a SQL migration script. Supports multiple statements separated by semicolons. Runs in a transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        migrationSql: { type: 'string', description: 'SQL migration statements to execute' },
      },
      required: ['migrationSql'],
    },
    permissionRequired: ['admin'],
    safeForProduction: false,
  },

  // ─── REST API Tools ───────────────────────────────────────
  {
    name: 'api_call',
    description: 'Call an external REST API. Supports GET, POST, PUT, PATCH, DELETE with auth (Bearer, API Key, Basic).',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        url: { type: 'string', description: 'Full URL to call' },
        headers: { type: 'string', description: 'JSON object of request headers' },
        body: { type: 'string', description: 'JSON string of request body (for POST/PUT/PATCH)' },
        authType: { type: 'string', description: 'Auth type', enum: ['none', 'bearer', 'api_key', 'basic'] },
        authToken: { type: 'string', description: 'Bearer token or API key value' },
        transformResponse: { type: 'string', description: 'Dot-notation path to extract from response, e.g. "data.users"' },
      },
      required: ['method', 'url'],
    },
    permissionRequired: ['admin', 'operator', 'dev'],
    safeForProduction: true,
  },

  // ─── File System Tools ────────────────────────────────────
  {
    name: 'fs_read',
    description: 'Read the contents of a file from the file system.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file' },
      },
      required: ['path'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'fs_write',
    description: 'Write or overwrite a file. Creates directories if they do not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
    permissionRequired: ['admin', 'operator', 'dev'],
    safeForProduction: true,
  },
  {
    name: 'fs_list',
    description: 'List files and directories in a given path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
        pattern: { type: 'string', description: 'Optional glob pattern to filter files, e.g. "**/*.ts"' },
      },
      required: ['path'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'fs_scaffold',
    description: 'Scaffold a new project from a template (express-api, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: 'Template name', enum: ['express-api', 'nextjs', 'react-vite'] },
        outputDir: { type: 'string', description: 'Directory where the project will be created' },
        projectName: { type: 'string', description: 'Name of the new project' },
      },
      required: ['template', 'outputDir', 'projectName'],
    },
    permissionRequired: ['admin', 'dev'],
    safeForProduction: false,
  },

  // ─── Git Tools ────────────────────────────────────────────
  {
    name: 'git_clone',
    description: 'Clone a Git repository to a local directory.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Repository URL to clone' },
        targetDir: { type: 'string', description: 'Local directory to clone into' },
      },
      required: ['url', 'targetDir'],
    },
    permissionRequired: ['admin', 'dev'],
    safeForProduction: false,
  },
  {
    name: 'git_commit',
    description: 'Stage and commit changes to a Git repository.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
        message: { type: 'string', description: 'Commit message' },
        files: { type: 'string', description: 'JSON array of specific files to stage. Leave empty to stage all.' },
      },
      required: ['repoPath', 'message'],
    },
    permissionRequired: ['admin', 'dev'],
    safeForProduction: false,
  },
  {
    name: 'git_diff',
    description: 'Get git diff between commits or current state. Includes breaking change analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
        from: { type: 'string', description: 'From commit/branch (default: HEAD~1)' },
        to: { type: 'string', description: 'To commit/branch (default: HEAD)' },
        analyzeBreaking: { type: 'string', description: 'Set to "true" to analyze for breaking changes' },
      },
      required: ['repoPath'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'git_branch',
    description: 'Create a new branch or list existing branches in a repository.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
        action: { type: 'string', description: 'Action to perform', enum: ['create', 'list'] },
        branchName: { type: 'string', description: 'Branch name (required for create)' },
      },
      required: ['repoPath', 'action'],
    },
    permissionRequired: ['admin', 'dev'],
    safeForProduction: false,
  },
  {
    name: 'git_pr',
    description: 'Push current branch and prepare pull request info.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
        remote: { type: 'string', description: 'Remote name (default: origin)' },
        branch: { type: 'string', description: 'Branch to push' },
      },
      required: ['repoPath'],
    },
    permissionRequired: ['admin', 'dev'],
    safeForProduction: false,
  },
  {
    name: 'git_log',
    description: 'Get git commit history. Shows hash, message, author, and date for recent commits.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
        count: { type: 'string', description: 'Number of commits to show (default: 10)' },
      },
      required: ['repoPath'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'git_status',
    description: 'Get the current git working tree status: staged, unstaged, and untracked files.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string', description: 'Path to the git repository' },
      },
      required: ['repoPath'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },

  // ─── Redis Tools ──────────────────────────────────────────
  {
    name: 'redis_get',
    description: 'Get a value from Redis by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Redis key to get' },
      },
      required: ['key'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'redis_set',
    description: 'Set a value in Redis with optional TTL.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Redis key' },
        value: { type: 'string', description: 'Value to store' },
        ttl: { type: 'string', description: 'Time-to-live in seconds (optional)' },
      },
      required: ['key', 'value'],
    },
    permissionRequired: ['admin', 'operator', 'dev'],
    safeForProduction: true,
  },
  {
    name: 'redis_queue',
    description: 'Manage Redis queues: push jobs, pop jobs, check queue status.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Queue action', enum: ['push', 'pop', 'status', 'peek'] },
        queueName: { type: 'string', description: 'Name of the queue' },
        job: { type: 'string', description: 'JSON object for the job (required for push)' },
      },
      required: ['action', 'queueName'],
    },
    permissionRequired: ['admin', 'operator', 'dev'],
    safeForProduction: true,
  },
  {
    name: 'redis_pubsub',
    description: 'Publish a message to a Redis pub/sub channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name to publish to' },
        message: { type: 'string', description: 'JSON message to publish' },
      },
      required: ['channel', 'message'],
    },
    permissionRequired: ['admin', 'operator'],
    safeForProduction: true,
  },
  // ─── Web Tools ──────────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the web using DuckDuckGo. Returns top results with title, URL, and snippet. Use this to find current information, news, prices, documentation, or anything on the internet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g. "Node.js best practices 2025")' },
        maxResults: { type: 'number', description: 'Max number of results to return (default: 5, max: 10)' },
      },
      required: ['query'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
  {
    name: 'web_fetch_json',
    description: 'Fetch raw JSON data from any public HTTP/HTTPS API endpoint. Use this for real-time data like gold price, crypto price, weather, exchange rates, etc. Known free APIs: gold+metals=https://metals.live/api/latest (returns {gold,silver,platinum...} in USD/oz), crypto=https://api.coinbase.com/v2/prices/BTC-USD/spot, exchange rates=https://api.frankfurter.app/latest',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full API URL to call (must start with http:// or https://)' },
        params: { type: 'object', description: 'Optional query parameters as key-value object' },
      },
      required: ['url'],
    },
    permissionRequired: ['admin', 'operator', 'dev', 'readonly'],
    safeForProduction: true,
  },
];

export function getToolByName(name: ToolName): MCPTool | undefined {
  return toolDefinitions.find((t) => t.name === name);
}

// Convert to Ollama-compatible tool format
export function toOllamaTools(tools: MCPTool[]): object[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}
