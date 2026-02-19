'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatInterface } from '../components/Chat';
import { ExecutionTimeline } from '../components/ExecutionTimeline';
import { Header } from '../components/Header';
import { ToolsSidebar } from '../components/ToolsSidebar';
import { useAgent } from '../hooks/useAgent';

export default function Home() {
  const {
    sessionId,
    messages,
    currentTimeline,
    allTimelines,
    isLoading,
    role,
    setRole,
    sendMessage,
    clearSession,
  } = useAgent();

  const [activePanel, setActivePanel] = useState<'timeline' | 'tools'>('timeline');

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <Header
        sessionId={sessionId}
        role={role}
        onRoleChange={setRole}
        onClearSession={clearSession}
        isLoading={isLoading}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
          />
        </div>

        {/* Right: Sidebar */}
        <div
          className="flex flex-col w-[480px] border-l overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
        >
          {/* Panel Tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setActivePanel('timeline')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'timeline'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Execution Timeline
            </button>
            <button
              onClick={() => setActivePanel('tools')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'tools'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Available Tools
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activePanel === 'timeline' ? (
              <ExecutionTimeline
                timelines={allTimelines}
                currentTimeline={currentTimeline}
                isLoading={isLoading}
              />
            ) : (
              <ToolsSidebar role={role} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
