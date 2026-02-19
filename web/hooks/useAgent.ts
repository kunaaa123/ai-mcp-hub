'use client';

import { useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Role = 'admin' | 'operator' | 'dev' | 'readonly';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  timeline?: ExecutionTimeline;
}

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface ExecutionTimeline {
  sessionId: string;
  userPrompt: string;
  toolCalls: ToolCall[];
  finalResponse: string;
  totalDurationMs: number;
  startedAt: string;
  finishedAt?: string;
}

export function useAgent() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTimeline, setCurrentTimeline] = useState<ExecutionTimeline | null>(null);
  const [allTimelines, setAllTimelines] = useState<ExecutionTimeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<Role>('operator');
  const socketRef = useRef<Socket | null>(null);

  const connectSocket = useCallback((sid: string) => {
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io(API_URL);
    socket.emit('join:session', sid);

    socket.on('tool:executed', (toolCall: ToolCall) => {
      setCurrentTimeline((prev) => {
        if (!prev) return prev;
        const exists = prev.toolCalls.find((t) => t.id === toolCall.id);
        if (exists) {
          return { ...prev, toolCalls: prev.toolCalls.map((t) => t.id === toolCall.id ? toolCall : t) };
        }
        return { ...prev, toolCalls: [...prev.toolCalls, toolCall] };
      });
    });

    socketRef.current = socket;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Initialize current timeline
    const liveTimeline: ExecutionTimeline = {
      sessionId: sessionId ?? '',
      userPrompt: content,
      toolCalls: [],
      finalResponse: '',
      totalDurationMs: 0,
      startedAt: new Date().toISOString(),
    };
    setCurrentTimeline(liveTimeline);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId, userId: 'user', role }),
      });

      const data = await res.json();

      if (data.success) {
        const { sessionId: newSid, response, timeline } = data.data;

        // Save session
        if (!sessionId) {
          setSessionId(newSid);
          connectSocket(newSid);
        }

        // Add assistant message
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          timeline,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setCurrentTimeline(timeline);
        setAllTimelines((prev) => [...prev, timeline]);
      } else {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ Error: ${data.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Network error: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, role, isLoading, connectSocket]);

  const clearSession = useCallback(() => {
    if (sessionId) {
      fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    }
    setSessionId(undefined);
    setMessages([]);
    setCurrentTimeline(null);
    setAllTimelines([]);
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, [sessionId]);

  return {
    sessionId,
    messages,
    currentTimeline,
    allTimelines,
    isLoading,
    role,
    setRole,
    sendMessage,
    clearSession,
  };
}
