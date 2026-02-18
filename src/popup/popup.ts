/**
 * Extension Popup — Shows tools, privacy controls, and settings.
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

// ─── Tab Navigation ───

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(`panel-${tab.getAttribute('data-tab')}`)!;
    panel.classList.add('active');
  });
});

// ─── Render ───

async function render(): Promise<void> {
  const versionEl = document.getElementById('version')!;
  versionEl.textContent = `v${GATEWAY_VERSION}`;

  const response: RegistryState = await chrome.runtime.sendMessage({ type: 'GET_REGISTRY_STATE' });
  const tools: ToolInfo[] = response?.tools ?? [];
  const clientCount = response?.connectedClients ?? 0;

  // Connection Status
  const statusDot = document.getElementById('status-dot')!;
  const connectionLabel = document.getElementById('connection-label')!;

  if (clientCount > 0) {
    statusDot.className = 'status-dot connected';
    connectionLabel.textContent = clientCount === 1 ? '1 client' : `${clientCount} clients`;
  } else {
    statusDot.className = 'status-dot disconnected';
    connectionLabel.textContent = 'No clients';
  }

  // Stats
  const origins = new Set(tools.map(t => t.origin));
  const nativeCount = tools.filter(t =>
    t.source === 'webmcp-native' || t.source === 'webmcp-declarative'
  ).length;

  document.getElementById('tool-count')!.textContent = String(tools.length);
  document.getElementById('origin-count')!.textContent = String(origins.size);
  document.getElementById('native-count')!.textContent = String(nativeCount);

  // Tool List or Onboarding
  const container = document.getElementById('tools-container')!;

  if (tools.length === 0) {
    container.innerHTML = `
      <div class="onboarding">
        <div class="icon">🔌</div>
        <h2>Your agent gateway is active</h2>
        <p>Tools appear as you browse the web.</p>
        <div class="steps">
          <div class="step">
            <span class="step-num">1</span>
            <span class="step-text">Browse to any website — tools are discovered automatically</span>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span class="step-text">Connect an MCP client (Claude Desktop, Cursor, etc.)</span>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <span class="step-text">Your AI agent can interact with sites using your existing logins</span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Render Tool Cards grouped by origin
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
        ? '<span class="badge auth">Authenticated</span>'
        : tool.authState === 'login-required'
          ? '<span class="badge no-auth">Login Required</span>'
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
    case 'webmcp-declarative':
      return '<span class="badge native">WebMCP</span>';
    case 'curated-bundle':
      return '<span class="badge curated">Curated</span>';
    case 'community-registry':
      return '<span class="badge community">Community</span>';
    case 'dom-fallback':
      return '<span class="badge fallback">DOM</span>';
    default:
      return '<span class="badge fallback">Unknown</span>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Privacy Controls ───

async function initPrivacy(): Promise<void> {
  // Load current privacy policy from storage
  const result = await chrome.storage.local.get('privacyPolicy');
  const policy = result.privacyPolicy ?? {
    allowMetadata: true,
    allowContent: false,
    allowAttachments: false,
  };

  const metadata = document.getElementById('privacy-metadata') as HTMLInputElement;
  const content = document.getElementById('privacy-content') as HTMLInputElement;
  const attachments = document.getElementById('privacy-attachments') as HTMLInputElement;

  metadata.checked = policy.allowMetadata;
  content.checked = policy.allowContent;
  attachments.checked = policy.allowAttachments;

  const savePolicy = () => {
    chrome.storage.local.set({
      privacyPolicy: {
        allowMetadata: metadata.checked,
        allowContent: content.checked,
        allowAttachments: attachments.checked,
      },
    });
  };

  metadata.addEventListener('change', savePolicy);
  content.addEventListener('change', savePolicy);
  attachments.addEventListener('change', savePolicy);
}

// ─── Settings Panel ───

async function initSettings(): Promise<void> {
  const settings: RegistrySettings = await chrome.runtime.sendMessage({ type: 'GET_REGISTRY_SETTINGS' });

  const useCommunity = document.getElementById('setting-use-community') as HTMLInputElement;
  const contribute = document.getElementById('setting-contribute') as HTMLInputElement;

  useCommunity.checked = settings.useCommunityTools;
  contribute.checked = settings.contributeEnabled;

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
        reportExecutions: contribute.checked,
      },
    });
  });
}

// ─── Initialize ───

render();
initPrivacy();
initSettings();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'tools_changed') {
    render();
  }
});
