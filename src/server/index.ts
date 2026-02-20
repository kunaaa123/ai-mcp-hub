import { createApp } from './app';
import config from '../config';
import { ensureModel } from '../agent/ollama';
import { mcpManager } from '../mcp/manager';

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🧠 AI Multi-Connector Hub (MCP)            ║');
  console.log('║   Powered by Ollama + TypeScript             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Check Ollama availability
  try {
    await ensureModel();
    console.log(`[Ollama] ✅ Connected — model: ${config.ollama.model}`);
  } catch (err: any) {
    console.warn(`[Ollama] ⚠️  ${err.message}`);
    console.warn('[Ollama] Make sure Ollama is running: ollama serve');
  }

  // Start server FIRST — don't block on MCP connections
  const { httpServer } = createApp();

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] ❌ Port ${config.port} is already in use.`);
      console.error(`[Server] Run: npx kill-port ${config.port}  then restart.`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(config.port, () => {
    console.log('');
    console.log(`[Server] ✅ Running on http://localhost:${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
    console.log(`[Server] Production Safe Mode: ${config.productionSafeMode}`);
    console.log('');
    console.log('[Endpoints]');
    console.log(`  GET  http://localhost:${config.port}/health`);
    console.log(`  GET  http://localhost:${config.port}/api/tools`);
    console.log(`  POST http://localhost:${config.port}/api/chat`);
    console.log(`  GET  http://localhost:${config.port}/api/sessions`);
    console.log(`  POST http://localhost:${config.port}/api/sessions`);
    console.log(`  GET  http://localhost:${config.port}/api/mcp/servers`);
    console.log(`  POST http://localhost:${config.port}/api/mcp/servers`);
    console.log(`  GET  http://localhost:${config.port}/api/mcp/tools`);
    console.log('');
    console.log('[Web UI] http://localhost:3001');
    console.log('');

    // Connect MCP servers in background — don't block HTTP readiness
    mcpManager.connectAll().catch((err) => {
      console.error('[MCP] Fatal error during connectAll:', err);
    });
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
