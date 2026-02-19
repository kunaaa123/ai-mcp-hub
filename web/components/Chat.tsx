'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import type { ChatMessage } from '../hooks/useAgent';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (message: string) => void;
}

// Quick-prompt examples
const QUICK_PROMPTS = [
  'Show database schema',
  'Check Redis queue status',
  'List files in current directory',
  'Get git diff and check for breaking changes',
  'Call GET https://httpbin.org/json',
];

export function ChatInterface({ messages, isLoading, onSend }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center glow-purple"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)' }}>
              <Bot size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">AI System Operator</h2>
              <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
                ฉันสามารถจัดการ Database, API, File System, Git, และ Redis ผ่าน MCP Tools
                พิมพ์คำสั่ง หรือเลือก Quick Prompt ด้านล่าง
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => onSend(p)}
                  className="px-3 py-1.5 text-xs rounded-full border transition-colors hover:border-purple-500 hover:text-purple-300"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)' }}>
              <Bot size={16} className="text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-none px-4 py-3 text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex gap-1 items-center">
                <span style={{ color: 'var(--text-muted)' }} className="text-xs">AI กำลังคิด</span>
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400 inline-block ml-1" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 items-end">
          <div className="flex-1 rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder="สั่ง AI ทำอะไรก็ได้... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
              rows={1}
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm bg-transparent resize-none outline-none text-white placeholder-gray-600"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{
              background: isLoading || !input.trim()
                ? 'var(--bg-card)'
                : 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
            }}
          >
            {isLoading
              ? <Loader2 size={18} className="animate-spin text-gray-400" />
              : <Send size={18} className="text-white" />
            }
          </button>
        </div>
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
          Powered by Ollama · MCP Tools · TypeScript
        </p>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser
            ? 'var(--bg-card)'
            : 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
          border: isUser ? '1px solid var(--border)' : 'none',
        }}
      >
        {isUser
          ? <User size={15} style={{ color: 'var(--text-muted)' }} />
          : <Bot size={15} className="text-white" />
        }
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'rounded-tr-none' : 'rounded-tl-none'
        }`}
        style={{
          background: isUser ? '#7c3aed22' : 'var(--bg-card)',
          border: `1px solid ${isUser ? '#7c3aed44' : 'var(--border)'}`,
          color: 'var(--text-primary)',
        }}
      >
        <FormattedContent content={message.content} />
        {message.timeline && message.timeline.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            ✅ {message.timeline.toolCalls.length} tool{message.timeline.toolCalls.length !== 1 ? 's' : ''} executed
            · {message.timeline.totalDurationMs}ms
          </div>
        )}
        <div className="text-xs mt-1 opacity-40">
          {new Date(message.timestamp).toLocaleTimeString('th-TH')}
        </div>
      </div>
    </div>
  );
}

// ─── Formatted Content (handles code blocks) ─────────────────
function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0]?.trim() ?? '';
          const code = lines.slice(1).join('\n');
          return (
            <pre key={i} className="rounded-lg p-3 text-xs overflow-x-auto"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              {lang && <div className="text-purple-400 mb-1 uppercase tracking-wider">{lang}</div>}
              <code className="text-green-400">{code}</code>
            </pre>
          );
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </div>
  );
}
