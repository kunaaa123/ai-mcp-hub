# 🧠 AI Multi-Connector Hub
**AI Infrastructure Operator powered by Ollama + TypeScript + MCP External Servers**

ไม่ใช่แค่ Chatbot — แต่คือ **AI System Operator** ที่ query ฐานข้อมูล, อ่านเขียนไฟล์, รัน Git, เรียก API, และเชื่อมต่อ External MCP Servers ได้โดยตรง

---

## ✨ Features

- 🔄 **Tool Chaining** — AI เรียก tool หลายตัวต่อเนื่องในคำตอบเดียว
- 🧠 **Reasoning Loop** — วิเคราะห์ก่อนเลือก tool, retry อัตโนมัติ (max 6 iterations)
- 📡 **Real-time Streaming** — ตัวอักษรไหลแบบ real-time ผ่าน Socket.IO
- 🔌 **External MCP Servers** — เชื่อมต่อ MCP Server ภายนอกผ่าน `mcp-servers.json`
- 💬 **Session Memory** — จำ context ตลอด conversation (last 8 messages)
- 🔐 **RBAC Permissions** — admin / operator / dev / readonly

---

## 🛠 Built-in Tools (22 tools)

| หมวด | Tools |
|------|-------|
| 🗄 **Database** (MySQL) | `db_query`, `db_schema`, `db_migrate` |
| 🌐 **REST API** | `api_call` |
| 📁 **Filesystem** | `fs_read`, `fs_write`, `fs_list`, `fs_scaffold` |
| 🧠 **Git** | `git_clone`, `git_commit`, `git_diff`, `git_branch`, `git_pr`, `git_log`, `git_status` |
| ⚡ **Redis** | `redis_get`, `redis_set`, `redis_queue`, `redis_pubsub` |
| 🔍 **Web** | `web_search`, `web_fetch_json` |

นอกจากนี้ยังมีเครื่องมือจาก **External MCP Servers** ที่เปิดใช้ใน `mcp-servers.json` ทั้งหมด (prefix `mcp__<serverId>__<toolName>`)

---

## 🚀 Quick Start

### Prerequisites
```bash
# Install Ollama → https://ollama.com
ollama pull llama3.1
ollama serve
```

### 1. Backend
```bash
git clone https://github.com/kunaaa123/ai-mcp-hub.git
cd ai-mcp-hub

cp .env.example .env
# แก้ไข .env (DB, Redis, Ollama URL)

npm install
npm run dev
# → http://localhost:4000
```

### 2. Frontend
```bash
cd web
npm install
npm run dev -- -p 3001
# → http://localhost:3001
```

### หรือรันพร้อมกัน
```bash
npm run dev:all
```

---

## 🔌 External MCP Servers

เชื่อมต่อ MCP Server ภายนอก (Filesystem, GitHub, Database, Brave Search ฯลฯ) ผ่าน JSON config:

```bash
cp mcp-servers.example.json mcp-servers.json
```

แก้ไข `mcp-servers.json` เปิด server ที่ต้องการ:
```json
{
  "id": "brave-search",
  "name": "Brave Search",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": { "BRAVE_API_KEY": "your_key_here" },
  "enabled": true
}
```

Restart backend — AI จะเห็น tools จาก server นั้นทันที

### Servers ที่รองรับ (ดูตัวอย่างใน `mcp-servers.example.json`)

| หมวด | Servers |
|------|---------|
| Web | Brave Search, Web Fetch |
| Dev | GitHub, Filesystem |
| Database | PostgreSQL, SQLite, MySQL, MongoDB, Redis |
| Productivity | Google Drive, Slack |

### จัดการ via REST API (ไม่ต้อง restart)

```bash
# ดูทุก server + status
GET  /api/mcp/servers

# เพิ่ม server ใหม่
POST /api/mcp/servers
{"name":"My DB","command":"npx","args":[...],"enabled":true}

# เปิด/ปิด / update
PATCH /api/mcp/servers/:id

# reconnect
POST /api/mcp/servers/:id/reconnect

# ลบ
DELETE /api/mcp/servers/:id

# ดู tools ทั้งหมดจาก external servers
GET /api/mcp/tools
```

---

## 📚 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server + Ollama health check |
| GET | `/api/tools` | Built-in tools (role-aware) |
| POST | `/api/chat` | Main agent chat |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session history |
| DELETE | `/api/sessions/:id` | Clear session |
| GET | `/api/metrics` | Tool execution metrics |
| DELETE | `/api/metrics` | Clear metrics |
| GET | `/api/mcp/servers` | External MCP servers + status |
| GET | `/api/mcp/tools` | Tools from external servers |
| POST | `/api/mcp/servers` | Add external server |
| PATCH | `/api/mcp/servers/:id` | Update/toggle server |
| POST | `/api/mcp/servers/:id/reconnect` | Reconnect server |
| DELETE | `/api/mcp/servers/:id` | Remove server |
| GET | `/api/permissions/:role` | Permission summary |

### ตัวอย่าง Chat Request
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "หา user ที่ active มากที่สุดเดือนนี้",
    "sessionId": "session-id",
    "role": "operator"
  }'
```

---

## 🔐 Roles & Permissions

| Role | สิทธิ์ |
|------|--------|
| `admin` | ทุก tool |
| `operator` | ทุก tool ยกเว้น `db_migrate`, `fs_scaffold`, `git_clone/commit/branch/pr` |
| `dev` | Read + Write + Git |
| `readonly` | `db_schema`, `fs_read/list`, `git_diff`, `redis_get` |

`PRODUCTION_SAFE_MODE=true` — บล็อก tools ทำลายข้อมูลทั้งหมด

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend port |
| `OLLAMA_MODEL` | `llama3.1` | Ollama model |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama URL |
| `OLLAMA_CONTEXT_LENGTH` | `4096` | Context window size |
| `OPERATOR_API_KEY` | — | Auth key สำหรับ API |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_NAME` | `mcp_hub` | Database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `FS_ALLOWED_PATH` | `./workspace` | Filesystem boundary |
| `PRODUCTION_SAFE_MODE` | `false` | Block destructive ops |

---

## 🏗 Project Structure

```
ai-mcp-hub/
├── src/
│   ├── agent/
│   │   ├── ollama.ts        # Ollama API client + streaming
│   │   ├── reasoning.ts     # AI reasoning loop (max 6 iterations)
│   │   └── memory.ts        # Session memory (last 8 messages)
│   ├── mcp/
│   │   ├── client.ts        # JSON-RPC 2.0 over stdio (no SDK)
│   │   └── manager.ts       # Multi-server manager + persistence
│   ├── tools/
│   │   ├── definitions.ts   # Tool schemas (22 built-in tools)
│   │   └── registry.ts      # Tool executor
│   ├── connectors/
│   │   ├── database/        # MySQL connector
│   │   ├── api/             # REST API connector
│   │   ├── filesystem/      # Filesystem connector
│   │   ├── git/             # Git connector
│   │   └── redis/           # Redis connector
│   ├── config/              # Environment config
│   ├── metrics/             # Execution metrics
│   ├── permissions/         # RBAC
│   ├── types/               # TypeScript types
│   └── server/
│       ├── app.ts           # Express routes + Socket.IO
│       └── index.ts         # Entry point
├── web/                     # Next.js 14 frontend
│   ├── app/
│   ├── components/
│   │   ├── Chat.tsx              # Chat UI + streaming
│   │   ├── ExecutionTimeline.tsx # Real-time tool execution
│   │   ├── Header.tsx
│   │   └── ToolsSidebar.tsx
│   └── hooks/
│       └── useAgent.ts      # Agent state + streaming
├── mcp-servers.json         # External MCP servers config (gitignored)
├── mcp-servers.example.json # Template (committed)
└── workspace/               # Filesystem tool working directory
```

---

## 🤖 Supported Ollama Models

ต้องใช้ model ที่รองรับ tool-call:

```bash
ollama pull llama3.1       # recommended
ollama pull llama3.2
ollama pull qwen2.5:7b
ollama pull mistral-nemo
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| AI | Ollama (llama3.1) |
| Backend | Express.js + Socket.IO |
| Database | MySQL (mysql2) |
| Cache/Queue | Redis (ioredis) |
| Git | simple-git |
| MCP Protocol | JSON-RPC 2.0 over stdio |
| Frontend | Next.js 14 + Tailwind CSS |
| Real-time | Socket.IO WebSocket (streaming tokens) |
