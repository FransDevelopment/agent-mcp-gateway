# Agent MCP Gateway

**The universal interface for the agentic web.**

Arcede Agent Gateway transforms your browser into a secure, privacy-first tool server for AI agents. It discovers interactive capabilities on any webpage—search bars, buttons, forms, navigation—and exposes them as structured **MCP Tools** to any AI agent you choose.

Whether you are using our premier agent interface at **[dash.arcede.com](https://dash.arcede.com)** or your own custom local agent, this gateway bridges the gap between AI and the live web.

![Arcede Agent Gateway](icons/icon-128.png)

---

## 🚀 The Vision: Agent-Agnostic Web Access

Most AI agents are trapped in their own silos, unable to see or effect change on the web without fragile scrapers or giving up your credentials to third-party servers.

**Arcede solves this.**

- **Your Browser, Your Session**: Agents interact through *your* active browser session. If you are logged in, your agent is logged in.
- **Universal Compatibility**: Built on the open [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), meaning **any** MCP-compliant agent can connect.
- **Zero-Setup Tools**: No API keys required. The gateway auto-discovers tools on the fly.

---

## ⚡ Primary Integration: Arcede Dash

The fastest way to experience the agentic web is with **[Arcede Dash](https://dash.arcede.com)**.

1.  **Install the Extension**: Get it from the Chrome Web Store.
2.  **Go to Dash**: Navigate to `dash.arcede.com` and connect.
3.  **Start Automating**: Your Dash agent instantly has access to every tool discovered in your other browser tabs.

---

## 🔌 Connecting Other Agents

While designed for Dash, this gateway is fully **agent-agnostic**. You can connect local IDE agents, terminal scripts, or custom bots.

### Supported Clients
- **Arcede Dash** (Web-Native)
- **Claude Desktop** (Local)
- **Cursor / Windsurf** (IDE)
- **Custom MCP Clients** (Python/Node/Go)

### Local Connection Guide
To connect a local agent (like Claude Desktop or a Python script), you need to run the local bridge server:

1.  **Clone & Run Bridge**:
    ```bash
    git clone https://github.com/nickarced/arcede-agent-gateway
    cd arcede-agent-gateway
    node test/bridge-server.js
    ```
2.  **Open Bridge Client**: Go to `http://localhost:3000` and enter your Extension ID.
3.  **Configure Your Agent**: Point your agent's MCP config to the proxy script:
    ```json
    {
      "mcpServers": {
        "arcede-browser": {
          "command": "node",
          "args": ["/path/to/arcede-agent-gateway/test/mcp-proxy.js"]
        }
      }
    }
    ```

---

## 🛠 Features & Capabilities

- **Smart Discovery**: Automatically identifies forms and interactive elements on *any* website (DOM fallback).
- **Curated Definitions**: High-reliability, verified tool definitions for 16+ major platforms:
  - **Productivity**: Notion, Linear, Jira, Trello
  - **Communication**: Gmail, Slack, Discord
  - **Dev**: GitHub, Vercel
  - **Social**: Twitter/X, Reddit
- **Data-Capable**: Returns structured data (e.g., search results, email metadata) by intercepting internal API calls or reading accessible text.
- **Privacy Controls**: You decide what data leaves the browser. Granular toggles for metadata, content, and attachments.

---

## 🔒 Privacy Architecture

Arcede is designed with a **zero-trust** architecture for maximum privacy:

1.  **Local Execution**: All logic runs in your browser.
2.  **No Server Relay**: Data flows directly from your browser to your connected agent. We (Arcede) never see your browsing data.
3.  **On-Demand Access**: Tools are only active when *you* explicitly prompt your agent. No background monitoring or tracking.
4.  **Audit Log**: The extension popup provides a real-time log of every tool execution and data access event.

---

## 📦 Project Structure

```bash
src/
├── background/         # Service worker (central coordination)
├── content/            # Tool discovery & execution (in-page)
├── curated/            # Hand-tuned definitions for top sites
├── popup/              # Privacy controls & audit log
└── privacy/            # Consent manager
```

---

**Arcede Agent Gateway** — The bridge between your browser and your AI.
