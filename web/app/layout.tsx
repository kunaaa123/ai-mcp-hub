import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI MCP Hub — System Operator',
  description: 'AI Multi-Connector Hub powered by Ollama and MCP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </body>
    </html>
  );
}
