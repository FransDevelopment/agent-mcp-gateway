# Chrome Web Store — Submission Materials

## Store Listing Copy

### Short Description (132 chars max)
Turn any website into AI-ready tools. Discover, manage, and expose browser capabilities to AI agents — no API keys or credentials needed.

### Detailed Description
Agent MCP Gateway turns your browser into a universal tool server for AI agents.

When you browse the web, the extension automatically discovers interactive capabilities on every page — search forms, action buttons, navigation elements — and exposes them as structured tools that any MCP-compatible AI agent can use.

**How it works:**
• Browse the web normally — tools are discovered automatically
• Connect an AI agent (Claude Desktop, Cursor, Windsurf, or any MCP client)
• Your agent can now interact with websites through your browser session

**Key features:**
• Zero credentials — uses your existing browser logins, no API keys or tokens stored
• Privacy-first — data only flows when you ask your agent to act, never monitored in the background
• Universal — works on any website, with curated support for 16+ popular sites
• Open standard — built on the MCP protocol and Google's WebMCP specification
• Data controls — choose exactly what level of data your agent can access (metadata, content, or full)

**Supported sites (curated):**
Gmail, GitHub, Notion, Linear, Slack, Stripe, Google Drive, Google Calendar, YouTube, Twitter/X, Reddit, Jira, HubSpot, Figma, Trello, and Vercel. Works on any website via automatic tool discovery.

**How is this different from other browser extensions?**
Most browser AI tools either take screenshots (slow, privacy concerns) or require you to share API credentials with third-party servers. Arcede stays in your browser — your sessions, your data, your control. When a site implements Google's WebMCP standard natively, Arcede uses that directly for the best experience.

### Category
Developer Tools

### Language
English

---

## Permission Justifications

### `<all_urls>` (Host Permissions)
**Why:** The extension discovers interactive tools (forms, buttons, search inputs) on any website the user visits. Content scripts must run on all origins to detect both native WebMCP tools and DOM-based capabilities. Without this permission, the extension could only work on a hardcoded list of domains, defeating the "universal tool discovery" value proposition.

**What we access:** DOM structure (form elements, ARIA attributes, semantic HTML). We do NOT read page content, cookies, or network traffic unless the user explicitly triggers a tool call through their AI agent.

### `tabs`
**Why:** The extension needs to track which browser tabs have active tools so it can route AI agent requests to the correct tab. When a tab is closed, the extension removes the associated tools from the registry. Tab IDs are used internally only — tab URLs and titles are not collected or transmitted.

### `scripting`
**Why:** When the extension is installed or updated, content scripts must be re-injected into already-open tabs to begin tool discovery. The `scripting` permission allows programmatic injection via `chrome.scripting.executeScript()`. This is only used during install/update — subsequent tab loads use the standard content script registration in the manifest.

### `storage`
**Why:** The extension stores user preferences locally:
- Privacy policy settings (metadata/content/attachment toggles)
- Community registry opt-in/out preferences
- Per-origin consent records

All data is stored locally via `chrome.storage.local`. Nothing is synced to external servers.

---

## Privacy Policy URL
https://arcede.com/privacy

---

## Single Purpose Description
Discovers interactive capabilities on web pages and exposes them as structured tools to MCP-compatible AI agents, enabling AI assistants to interact with websites through the user's authenticated browser session.
