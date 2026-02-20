import fs from 'fs-extra';
import path from 'path';

// ============================================================
// File System Connector — scaffold only
// (fs_read / fs_write / fs_list are handled by external MCP
//  filesystem server via mcp-servers.json)
// ============================================================

function guardPath(filePath: string): string {
  return path.resolve(filePath);
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
    'src/index.ts': `import express from 'express';\nimport cors from 'cors';\nimport dotenv from 'dotenv';\n\ndotenv.config();\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get('/health', (_, res) => res.json({ status: 'ok' }));\n\nconst PORT = process.env.PORT ?? 3000;\napp.listen(PORT, () => console.log(\`Server running on :\${PORT}\`));\n`,
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
