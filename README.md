# 🧠 AI Multi-Connector Hub (MCP)
**AI Infrastructure Operator powered by Ollama + TypeScript**

ไม่ใช่แค่ Chatbot — แต่คือ **AI System Operator** ที่ควบคุมทุก Infrastructure ผ่าน MCP Tools

---

## 🔥 Features

| Connector | Tools | ความสามารถ |
|-----------|-------|------------|
| 🗄 **Database** | `db_query`, `db_schema`, `db_migrate` | Run SQL, Schema inspection, Migration |
| 🌐 **REST API** | `api_call` | Call API with auth, transform response |
| 📁 **File System** | `fs_read`, `fs_write`, `fs_list`, `fs_scaffold` | Read/Write/Scaffold projects |
| 🧠 **Git** | `git_clone`, `git_commit`, `git_diff`, `git_branch`, `git_pr` | Full Git operations + Breaking change analysis |
| ⚡ **Redis** | `redis_get`, `redis_set`, `redis_queue`, `redis_pubsub` | Cache, Queue, Pub/Sub |

### ✨ Capabilities
- 🔄 **Tool Chaining** — AI เรียก tool หลายตัวในคำสั่งเดียว
- 🧠 **Reasoning Loop** — วิเคราะห์ก่อนเลือก tool, retry ถ้าพัง
- 📊 **Execution Timeline** — Web UI แสดง real-time tool execution
- 🔐 **Permission Layer** — RBAC: admin / operator / dev / readonly
- 💬 **Session Memory** — Context persistence ตลอด conversation
- ⚡ **Real-time WebSocket** — Socket.IO สำหรับ live updates

---

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install Ollama
# https://ollama.com

# Pull model
ollama pull llama3.1

# Start Ollama
ollama serve
```

### 2. Backend Setup
```bash
cd ai-mcp-hub

# Copy env
cp .env.example .env
# แก้ไข .env ให้ตรงกับ MySQL ของคุณ

# Install dependencies
npm install

# Start backend (dev)
npm run dev
```

**Backend จะรันที่:** `http://localhost:4000`

### 3. Web UI Setup
```bash
cd web
npm install
npm run dev
```

**Web UI จะรันที่:** `http://localhost:3001`

### 4. หรือรันทั้งคู่พร้อมกัน
```bash
npm run dev:all
```

---

## 🎮 Usage Examples

### ผ่าน Web UI
เปิด `http://localhost:3001` แล้วพิมพ์คำสั่ง:

```
หา user ที่ active มากที่สุดเดือนนี้
```
```
ดู schema ของ database แล้ว generate query หาข้อมูลสรุป
```
```
ดู git diff ล่าสุด แล้วบอกว่ามี breaking change ไหม
```
```
เช็ค Redis queue status แล้ว pop job แรกออกมา
```

### ผ่าน API
```bash
# Create session
curl -X POST http://localhost:4000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user1", "role": "operator"}'

# Chat
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "show database schema",
    "sessionId": "YOUR_SESSION_ID",
    "role": "operator"
  }'
```

---

## 🏗 Project Structure

```
ai-mcp-hub/
├── src/
│   ├── types/          # TypeScript interfaces
│   ├── config/         # Environment configuration
│   ├── connectors/
│   │   ├── database/   # MySQL connector
│   │   ├── api/        # REST API connector
│   │   ├── filesystem/ # File System connector
│   │   ├── git/        # Git connector
│   │   └── redis/      # Redis connector
│   ├── tools/
│   │   ├── definitions.ts  # MCP tool schemas
│   │   └── registry.ts     # Tool executor
│   ├── agent/
│   │   ├── ollama.ts       # Ollama API client
│   │   ├── reasoning.ts    # AI reasoning loop
│   │   └── memory.ts       # Session memory
│   ├── permissions/
│   │   └── rbac.ts         # Role-based access control
│   └── server/
│       ├── app.ts          # Express + Socket.IO
│       └── index.ts        # Entry point
└── web/                    # Next.js Dashboard
    ├── app/                # Next.js App Router
    ├── components/
    │   ├── Chat.tsx           # Chat interface
    │   ├── ExecutionTimeline.tsx  # Real-time timeline
    │   ├── Header.tsx         # Top navigation
    │   └── ToolsSidebar.tsx   # Tool browser
    └── hooks/
        └── useAgent.ts       # Agent state hook
```

---

## 🔐 Roles & Permissions

| Role | Tools | Use Case |
|------|-------|----------|
| `admin` | All 17 tools | Full system control |
| `operator` | All except `db_migrate`, `fs_scaffold`, `git_clone/commit/branch/pr` | Production ops |
| `dev` | Read + Write + Git | Development tasks |
| `readonly` | `db_schema`, `fs_read/list`, `git_diff`, `redis_get` | Monitoring only |

**Production Safe Mode (`PRODUCTION_SAFE_MODE=true`):** blocks all tools with `safeForProduction: false`

---

## 🌐 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server + Ollama health check |
| `/api/tools` | GET | List available tools (role-aware) |
| `/api/chat` | POST | Main agent chat endpoint |
| `/api/sessions` | GET/POST | List/create sessions |
| `/api/sessions/:id` | DELETE | Clear session |
| `/api/permissions/:role` | GET | Get permission summary |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `OLLAMA_MODEL` | `llama3.1` | Ollama model to use |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_NAME` | `mcp_hub` | Database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `PRODUCTION_SAFE_MODE` | `false` | Block destructive ops |
| `FS_ALLOWED_PATH` | `./workspace` | File system access boundary |

---

## 🛠 Tech Stack

- **Runtime:** Node.js + TypeScript
- **AI:** Ollama (llama3.1 / any tool-call capable model)
- **Protocol:** MCP (Model Context Protocol)
- **Backend:** Express.js + Socket.IO
- **Database:** MySQL (mysql2)
- **Cache/Queue:** Redis (ioredis)
- **Git:** simple-git
- **Web UI:** Next.js 14 + Tailwind CSS
- **Real-time:** Socket.IO WebSocket

---

## 🤖 Supported Models (Ollama)

Tool-call support จำเป็นต้องใช้ model ที่รองรับ:
- `llama3.1` ✅ (recommended)
- `llama3.2` ✅
- `mistral-nemo` ✅
- `qwen2.5` ✅
- `llama3-groq-tool-use` ✅

```bash
ollama pull llama3.1
# หรือ
ollama pull qwen2.5:7b
```
