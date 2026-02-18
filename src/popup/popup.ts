/**
 * Extension Popup — Shows discovered tools, connection status, and onboarding.
 */

import { GATEWAY_VERSION } from '../shared/constants';
import type { ToolSource, AuthState } from '../shared/types';
import type { RegistrySettings } from '../registry/settings';

interface ToolInfo {
  id: string;
  name: string;
  origin: string;
  source: ToolSource;
  authState: AuthState;
}

interface RegistryState {
  tools: ToolInfo[];
  connectedClients: number;
}

async function render(): Promise<void> {
  const versionEl = document.getElementById('version')!;
  versionEl.textContent = `v${GATEWAY_VERSION}`;

  // Request registry state from service worker
  const response: RegistryState = await chrome.runtime.sendMessage({ type: 'GET_REGISTRY_STATE' });
  const tools: ToolInfo[] = response?.tools ?? [];
  const clientCount = response?.connectedClients ?? 0;

  // ─── Connection Status ───

  const statusDot = document.getElementById('status-dot')!;
  const connectionLabel = document.getElementById('connection-label')!;

  if (clientCount > 0) {
    statusDot.className = 'status-dot connected';
    connectionLabel.textContent = clientCount === 1
      ? '1 client'
      : `${clientCount} clients`;
  } else {
    statusDot.className = 'status-dot disconnected';
    connectionLabel.textContent = 'No clients';
  }

  // ─── Stats ───

  const origins = new Set(tools.map(t => t.origin));
  const nativeCount = tools.filter(t =>
    t.source === 'webmcp-native' || t.source === 'webmcp-declarative'
  ).length;

  document.getElementById('tool-count')!.textContent = String(tools.length);
  document.getElementById('origin-count')!.textContent = String(origins.size);
  document.getElementById('native-count')!.textContent = String(nativeCount);

  // ─── Tool List or Onboarding ───

  const container = document.getElementById('tools-container')!;

  if (tools.length === 0) {
    container.innerHTML = `
      <div class="onboarding">
        <div class="icon">🔌</div>
        <h2>Your AI agent gateway is active</h2>
        <p>Tools will appear here as you browse the web.</p>
        <div class="steps">
          <div class="step">
            <span class="step-num">1</span>
            <span class="step-text">Browse to any website — tools are discovered automatically from forms, search bars, and WebMCP-enabled pages</span>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span class="step-text">Connect an MCP client (Claude Desktop, Cursor, Windsurf, etc.) to start using the discovered tools</span>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <span class="step-text">Your AI agent can now interact with any website through your browser — using your existing logins</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // ─── Render Tool Cards ───

  // Group by origin
  const grouped = new Map<string, ToolInfo[]>();
  for (const tool of tools) {
    const list = grouped.get(tool.origin) ?? [];
    list.push(tool);
    grouped.set(tool.origin, list);
  }

  let html = '<div class="tools-list">';
  for (const [origin, originTools] of grouped) {
    for (const tool of originTools) {
      const sourceBadge = getSourceBadge(tool.source);

      const authBadge = tool.authState === 'authenticated'
        ? '<span class="badge auth" title="You are logged in to this site">Authenticated</span>'
        : tool.authState === 'login-required'
          ? '<span class="badge no-auth" title="Log in to this site to enable this tool">Login Required</span>'
          : '';

      html += `
        <div class="tool">
          <div class="name">${escapeHtml(tool.name)}</div>
          <div class="origin">${escapeHtml(origin)}</div>
          <div class="badges">${sourceBadge}${authBadge}</div>
        </div>
      `;
    }
  }
  html += '</div>';
  container.innerHTML = html;
}

function getSourceBadge(source: ToolSource): string {
  switch (source) {
    case 'webmcp-native':
      return '<span class="badge native" title="Tool declared by the site via JavaScript API (navigator.modelContext)">WebMCP</span>';
    case 'webmcp-declarative':
      return '<span class="badge native" title="Tool declared by the site via HTML form attributes">WebMCP</span>';
    case 'curated-bundle':
      return '<span class="badge curated" title="Verified tool definition maintained by Arcede — works even without site support">Curated</span>';
    case 'community-registry':
      return '<span class="badge community" title="Tool verified by the Arcede community — contributed by multiple users">Community</span>';
    case 'dom-fallback':
      return '<span class="badge fallback" title="Tool auto-generated from page forms and inputs — may be less reliable">DOM</span>';
    default:
      return '<span class="badge fallback">Unknown</span>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initial render
render();

// Settings panel toggle + load
initSettings();

// Re-render when tools change
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'tools_changed') {
    render();
  }
});

// ─── Settings Panel ───

async function initSettings(): Promise<void> {
  // Toggle visibility
  const toggle = document.getElementById('settings-toggle')!;
  const body = document.getElementById('settings-body')!;
  toggle.addEventListener('click', () => {
    body.classList.toggle('open');
  });

  // Load current settings
  const settings: RegistrySettings = await chrome.runtime.sendMessage({ type: 'GET_REGISTRY_SETTINGS' });

  const useCommunity = document.getElementById('setting-use-community') as HTMLInputElement;
  const contribute = document.getElementById('setting-contribute') as HTMLInputElement;

  useCommunity.checked = settings.useCommunityTools;
  contribute.checked = settings.contributeEnabled;

  // Save on change
  useCommunity.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SAVE_REGISTRY_SETTINGS',
      settings: { useCommunityTools: useCommunity.checked },
    });
  });

  contribute.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SAVE_REGISTRY_SETTINGS',
      settings: {
        contributeEnabled: contribute.checked,
        reportExecutions: contribute.checked,  // Tied together
      },
    });
  });
}
