# Future Platform — Agents & RAG

## AI Agent System

### Agent Types
- **Sales:** Product recommendations, order assistance, upselling
- **Support:** FAQ handling, ticket creation, troubleshooting
- **Leads:** Lead qualification, appointment scheduling
- **Logistics:** Order tracking, shipping status
- **Custom:** User-defined agents with custom system prompts

### Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-5-mini (default), gpt-5.2, gpt-5.2-pro, gpt-5-nano, gpt-4.1 |
| Google | Gemini 3 Pro (1M context), Gemini 2.5 Flash |
| Anthropic | Claude 3.5 Sonnet |

### Agent Configuration
Each agent has:
- `system_prompt` — personality and instructions
- `model_version` — which LLM to use
- `temperature` — creativity control (0.0–1.0)
- `enabled_tools` — which tools the agent can use (HTTP, function, integration)
- `channels` — which channels the agent handles (whatsapp, instagram, facebook)
- `metadata` — additional context (website_url, business_hours, etc.)

### Agent Execution Flow
```
User message arrives
    → Smart Buffer (5s debounce, combines rapid messages)
    → Dedup Guard (skip if already replied)
    → Fetch agent config for tenant
    → Build conversation history (last N messages)
    → RAG context injection (semantic search on knowledge base)
    → LangChain agent execution (tools + memory)
    → Response streamed or buffered
    → Multi-bubble splitting (long responses split into natural parts)
    → Delivery via Universal Relay
```

### Tools
Agents can use custom tools defined per-tenant:
- **HTTP tools:** Call external APIs
- **Function tools:** Execute predefined functions
- **Integration tools:** Connect to TiendaNube, calendars, etc.

## Knowledge Base (RAG)

### Pipeline
```
Upload PDF/DOCX/TXT/CSV
    → Text extraction (PyPDF, docx2txt)
    → Chunking (RecursiveCharacterTextSplitter)
    → Embedding (OpenAI text-embedding-3-small)
    → Storage in PostgreSQL pgvector
    → Tenant-isolated collections
```

### Semantic Search
When the agent processes a message:
1. Query is embedded using the same model
2. pgvector finds top-K similar chunks (cosine similarity)
3. Relevant context injected into the agent's prompt
4. Agent generates response with knowledge grounding

### Shadow RAG
Conversation messages are passively indexed into the vector store (`is_shadow_indexed` flag). This enables semantic search across historical conversations without manual upload.

### Document Management
- Upload via UI (Knowledge page)
- Organize by collections
- Delete with cascade (removes embeddings)
- Per-tenant isolation

## Agent Memory
- `ConversationBufferMemory` with Redis persistence
- `RedisChatMessageHistory` for conversation context
- Message history loaded per conversation, not per session
