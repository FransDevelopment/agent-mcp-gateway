# Arcede Agent Gateway (Chrome Extension)

**Turn your browser into a universal tool server for AI agents.**

Arcede Agent Gateway is a Chrome extension that discovers interactive capabilities on any webpage (search bars, buttons, forms, navigation) and exposes them as structured **MCP Tools** to local AI agents (Claude Desktop, Cursor, Windsurf, generic MCP clients).

It enables AI agents to "browse" and interact with the web using your existing authenticated session — no API keys, no credentials, no servers.

![Arcede Agent Gateway](icons/icon-128.png)

---

## 🚀 Key Features

- **Universal Discovery**: Automatically finds tools on *any* website (DOM fallback).
- **Curated High-Quality Tools**: Bundled, verify definitions for 16+ top sites (Gmail, GitHub, Notion, Linear, etc.) with structured data return.
- **Privacy-First Architecture**:
  - **Zero Credentials**: Uses your active browser session.
  - **On-Demand Extraction**: Data is only read when you explicitly ask your agent.
  - **No Background Monitoring**: API hooks only install during tool execution.
  - **Local Only**: No data is sent to Arcede servers.
- **Data-Capable**: Returns structured data (email metadata, search results) by intercepting internal API calls or reading accessible text.
- **Standard Protocol**: Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) and Google's [WebMCP](https://github.com/google/webmcp).

---

## 🛠 Architecture

The extension consists of three main components:

### 1. Content Script (`src/content/`)
Injected into every page to discover and execute tools.
- **`detector.ts`**: Scans the DOM for interactive elements and WebMCP tags.
- **`executor.ts`**: Runs tool actions (click, type, submit).
- **`api-interceptor.ts`**: Captures the site's own internal API responses to return structured data (premium feature).
- **`a11y-extractor.ts`**: Universal fallback that reads the accessibility tree (ARIA) to return visible text.

### 2. Background Service Worker (`src/background/`)
Central coordinator and MCP server.
- **`mcp-server.ts`**: Handles JSON-RPC requests from external agents.
- **`tool-registry.ts`**: Manages the list of available tools across all tabs.
- **`session-manager.ts`**: Tracks active tabs and binds curated tools to them.

### 3. Local Bridge (`test/bridge-server.js` + `test/mcp-proxy.js`)
Connects local stdio-based agents (like Claude Desktop) to the browser extension via HTTP/SSE.
- **`bridge-server`**: HTTP server that relays requests between stdio proxy and browser.
- **`mcp-proxy`**: Stdio wrapper that Claude Desktop runs.

---

## 📦 Project Structure

```bash
src/
├── background/         # Service worker (central logic)
├── content/            # Content scripts (DOM interaction)
│   ├── api-interceptor.ts # Captures internal API responses
│   └── a11y-extractor.ts  # Universal text extraction
├── curated/            # Hand-tuned tool definitions (Gmail, GitHub, etc.)
├── popup/              # Extension popup UI (React-like vanilla TS)
├── privacy/            # Consent manager & audit log
├── shared/             # Types, constants, and message protocols
└── registry/           # Community registry client (optional)
```

---

## 🔧 Setup & Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Build
```bash
npm install
npm run build
# Output is in dist/
```

### Load in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Connect Claude Desktop / Cursor
1. Start the bridge server:
   ```bash
   node test/bridge-server.js
   ```
2. Open `http://localhost:3000` in Chrome and paste your Extension ID.
3. Configure your agent (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "arcede-browser": {
         "command": "node",
         "args": ["/absolute/path/to/arcede-agent-gateway/test/mcp-proxy.js"]
       }
     }
   }
   ```
4. Restart your agent.

---

## 🔒 Privacy & Security

**We take privacy seriously.** The design enforces strict data minimization:
1. **Consent**: You must approve data access per-site (metadata vs content).
2. **Transparency**: The popup shows a live audit log of every tool call and what data was extracted.
3. **Isolation**: API interception hooks are *only* active during the milliseconds a tool is executing. There is **no passive monitoring** of your browsing.
4. **Local Execution**: All logic runs in your browser. No data leaves your machine except to the specific AI agent you connected.

---

## 🤝 Contributing

We welcome contributions to the **Curated Tool Bundle**! If you want to add support for a new site:
1. Create a definition in `src/curated/sites/`
2. Add CSS selectors for stable elements
3. (Optional) Add an `interception` config to extract structured data from API responses

---

**Arcede Agent Gateway** — The browser interface for the agentic web.
