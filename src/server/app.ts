import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { ReasoningAgent } from '../agent/reasoning';
import { OrchestratorAgent } from '../agent/orchestrator';
import { metricsStore } from '../metrics/store';
import { getOrCreateSession, createSession, clearSession, listSessions, getHistorySummary } from '../agent/memory';
import { getRoleFromHeader, getPermissionSummary, isValidRole } from '../permissions/rbac';
import { toolDefinitions } from '../tools/definitions';
import { checkOllamaHealth } from '../agent/ollama';
import { ApiResponse, Role, ExecutionTimeline } from '../types';

// ============================================================
// Express API Server
// ============================================================

export function createApp() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // ─── Logging Middleware ─────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Helper to send responses
  const ok = <T>(res: Response, data: T): void => {
    res.json({ success: true, data, timestamp: new Date() } satisfies ApiResponse<T>);
  };
  const fail = (res: Response, message: string, status = 400): void => {
    res.status(status).json({ success: false, error: message, timestamp: new Date() } satisfies ApiResponse);
  };

  // ─── Health Check ───────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const ollama = await checkOllamaHealth();
    ok(res, {
      status: 'ok',
      environment: config.nodeEnv,
      productionSafeMode: config.productionSafeMode,
      ollama,
    });
  });

  // ─── Tools API ──────────────────────────────────────────────
  app.get('/api/tools', (req, res) => {
    const role = getRoleFromHeader(req.headers.authorization);
    const tools = toolDefinitions
      .filter((t) => t.permissionRequired.includes(role))
      .map((t) => ({
        name: t.name,
        description: t.description,
        safeForProduction: t.safeForProduction,
        permissionRequired: t.permissionRequired,
      }));
    ok(res, { role, tools, total: tools.length });
  });

  // ─── Sessions API ───────────────────────────────────────────
  app.get('/api/sessions', (_req, res) => {
    ok(res, listSessions());
  });

  app.post('/api/sessions', (req, res) => {
    const { userId = 'anonymous', role = 'operator' } = req.body;
    if (!isValidRole(role)) return fail(res, `Invalid role: ${role}`);
    const session = createSession(userId, role as Role);
    ok(res, { sessionId: session.sessionId, role: session.role });
  });

  app.delete('/api/sessions/:sessionId', (req, res) => {
    const deleted = clearSession(req.params['sessionId']!);
    ok(res, { deleted });
  });

  app.get('/api/sessions/:sessionId', (req, res) => {
    const summary = getHistorySummary(req.params['sessionId']!);
    ok(res, summary);
  });

  // ─── Chat API (Main Agent Endpoint) ─────────────────────────
  app.post('/api/chat', async (req, res) => {
    const {
      message,
      sessionId,
      userId = 'anonymous',
      role = 'operator',
      mode = 'single', // 'single' | 'multi'
    } = req.body;

    if (!message) return fail(res, 'message is required');
    if (!isValidRole(role)) return fail(res, `Invalid role: ${role}`);

    // Get or create session
    const session = getOrCreateSession(sessionId, userId, role as Role);

    // Emit real-time events via WebSocket
    const emitUpdate = (event: string, data: unknown) => {
      io.to(session.sessionId).emit(event, data);
    };

    try {
      emitUpdate('agent:start', { sessionId: session.sessionId, message, mode });

      if (mode === 'multi') {
        // ── Multi-Agent Mode ──────────────────────────────────
        const emitter = new EventEmitter();

        // Proxy emitter events to socket
        const proxyEvents = [
          'agent:planning', 'agent:plan_ready',
          'agent:executing', 'agent:reviewing',
          'agent:review_done', 'tool:executed',
        ];
        for (const event of proxyEvents) {
          emitter.on(event, (data) => emitUpdate(event, data));
        }

        const orchestrator = new OrchestratorAgent();
        const result = await orchestrator.run({
          userPrompt: message,
          sessionId: session.sessionId,
          role,
          emitter,
        });

        // Record metrics
        metricsStore.recordRequest(result.timeline, session.sessionId, role);

        emitUpdate('agent:done', {
          sessionId: session.sessionId,
          response: result.timeline.finalResponse,
          totalDurationMs: result.timeline.totalDurationMs,
          mode: 'multi',
          plan: result.plan,
          review: result.review,
        });

        ok(res, {
          sessionId: session.sessionId,
          response: result.timeline.finalResponse,
          timeline: result.timeline,
          plan: result.plan,
          review: result.review,
          mode: 'multi',
        });
      } else {
        // ── Single Agent Mode ─────────────────────────────────
        const agent = new ReasoningAgent(session);

        const timeline: ExecutionTimeline = await agent.run({
          userPrompt: message,
          sessionId: session.sessionId,
          userId,
          role: role as Role,
        });

        // Record metrics
        metricsStore.recordRequest(timeline, session.sessionId, role);

        // Emit each tool call for real-time timeline
        for (const call of timeline.toolCalls) {
          emitUpdate('tool:executed', call);
        }

        emitUpdate('agent:done', {
          sessionId: session.sessionId,
          response: timeline.finalResponse,
          totalDurationMs: timeline.totalDurationMs,
          mode: 'single',
        });

        ok(res, {
          sessionId: session.sessionId,
          response: timeline.finalResponse,
          timeline,
          mode: 'single',
        });
      }
    } catch (error: any) {
      emitUpdate('agent:error', { error: error.message });
      fail(res, error.message, 500);
    }
  });

  // ─── Metrics API ────────────────────────────────────────────
  app.get('/api/metrics', (_req, res) => {
    ok(res, metricsStore.getMetrics());
  });

  app.delete('/api/metrics', (_req, res) => {
    metricsStore.reset();
    ok(res, { reset: true });
  });

  // ─── Permissions API ────────────────────────────────────────
  app.get('/api/permissions/:role', (req, res) => {
    const role = req.params['role'];
    if (!isValidRole(role)) return fail(res, `Invalid role: ${role}`);
    ok(res, getPermissionSummary(role));
  });

  // ─── Socket.IO ──────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join:session', (sessionId: string) => {
      socket.join(sessionId);
      console.log(`[Socket] ${socket.id} joined session: ${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return { app, httpServer, io };
}
