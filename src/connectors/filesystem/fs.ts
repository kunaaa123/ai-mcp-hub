import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

// ============================================================
// File System Connector
// ============================================================

// Safety: restrict operations to allowed base paths
const ALLOWED_BASES = [
  process.cwd(),
  path.join(process.env['HOME'] ?? '', 'workspace'),
  process.env['FS_ALLOWED_PATH'] ?? process.cwd(),
];

function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return ALLOWED_BASES.some((base) => resolved.startsWith(path.resolve(base)));
}

function guardPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!isPathAllowed(resolved)) {
    throw new Error(`Access denied: path '${filePath}' is outside allowed directories`);
  }
  return resolved;
}

// ─── Read File ───────────────────────────────────────────────
export async function readFile(filePath: string): Promise<string> {
  const safe = guardPath(filePath);
  return fs.readFile(safe, 'utf-8');
}

// ─── Write File ──────────────────────────────────────────────
export async function writeFile(filePath: string, content: string): Promise<{ path: string; bytes: number }> {
  const safe = guardPath(filePath);
  await fs.ensureDir(path.dirname(safe));
  await fs.writeFile(safe, content, 'utf-8');
  return { path: safe, bytes: Buffer.byteLength(content, 'utf-8') };
}

// ─── List Directory ──────────────────────────────────────────
export async function listDir(dirPath: string): Promise<{
  files: string[];
  dirs: string[];
  total: number;
}> {
  const safe = guardPath(dirPath);
  const entries = await fs.readdir(safe, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  return { files, dirs, total: entries.length };
}

// ─── Search Files ────────────────────────────────────────────
export async function searchFiles(pattern: string, cwd?: string): Promise<string[]> {
  const baseCwd = cwd ? guardPath(cwd) : process.cwd();
  return glob(pattern, { cwd: baseCwd, absolute: true });
}

// ─── Parse Log File ──────────────────────────────────────────
export async function parseLogFile(
  filePath: string,
  options: { lastNLines?: number; filter?: string }
): Promise<string[]> {
  const content = await readFile(filePath);
  let lines = content.split('\n').filter((l) => l.trim().length > 0);

  if (options.filter) {
    const re = new RegExp(options.filter, 'i');
    lines = lines.filter((l) => re.test(l));
  }

  if (options.lastNLines) {
    lines = lines.slice(-options.lastNLines);
  }

  return lines;
}

// ─── Scaffold Project ────────────────────────────────────────
export interface ScaffoldTemplate {
  name: 'nextjs' | 'express-api' | 'react-vite' | 'custom';
  outputDir: string;
  projectName: string;
}

const SCAFFOLDS: Record<string, Record<string, string>> = {
  'express-api': {
    'package.json': JSON.stringify({
      name: '{{projectName}}',
      version: '1.0.0',
      scripts: { dev: 'ts-node-dev src/index.ts', build: 'tsc', start: 'node dist/index.js' },
      dependencies: { express: '^4.18.2', cors: '^2.8.5', dotenv: '^16.3.1' },
      devDependencies: { typescript: '^5.3.2', '@types/express': '^4.17.21', '@types/node': '^20.10.0', 'ts-node-dev': '^2.0.0' },
    }, null, 2),
    'src/index.ts': `import express from 'express';\nimport cors from 'cors';\nimport dotenv from 'dotenv';\n\ndotenv.config();\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get('/health', (_, res) => res.json({ status: 'ok' }));\n\nconst PORT = process.env.PORT ?? 3000;\napp.listen(PORT, () => console.log(\`Server running on :$\{PORT\}\`));\n`,
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', outDir: './dist', strict: true, esModuleInterop: true } }, null, 2),
    '.env': 'PORT=3000\nNODE_ENV=development\n',
  },
};

export async function scaffoldProject(template: ScaffoldTemplate): Promise<string[]> {
  const safe = guardPath(template.outputDir);
  const files = SCAFFOLDS[template.name] ?? {};
  const created: string[] = [];

  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(safe, relPath);
    const rendered = content.replace(/\{\{projectName\}\}/g, template.projectName);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, rendered, 'utf-8');
    created.push(fullPath);
  }

  return created;
}
