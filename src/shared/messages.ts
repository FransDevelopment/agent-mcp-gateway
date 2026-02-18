/**
 * Chrome runtime message protocol between content scripts and service worker.
 *
 * All messages pass through chrome.runtime.sendMessage / onMessage.
 * Each message has a `type` discriminator for type-safe handling.
 */

import type { DiscoveredTool, AuthState, ToolSource } from './types';

// ─── Content Script → Service Worker ───

export interface ToolDiscoveredMessage {
  type: 'TOOL_DISCOVERED';
  origin: string;
  url: string;
  tool: DiscoveredTool;
}

export interface ToolRemovedMessage {
  type: 'TOOL_REMOVED';
  origin: string;
  toolName: string;
}

export interface PageToolsMessage {
  type: 'PAGE_TOOLS';
  origin: string;
  url: string;
  tools: DiscoveredTool[];
  authState: AuthState;
}

export interface AuthStateChangedMessage {
  type: 'AUTH_STATE_CHANGED';
  origin: string;
  authState: AuthState;
}

// ─── Service Worker → Content Script ───

export interface ExecuteToolMessage {
  type: 'EXECUTE_TOOL';
  toolName: string;
  arguments: Record<string, unknown>;
  source: ToolSource;
  selector?: string;
  requestId: string;
}

export interface DiscoverToolsMessage {
  type: 'DISCOVER_TOOLS';
}

// ─── Service Worker → Popup ───

export interface RegistryStateMessage {
  type: 'REGISTRY_STATE';
  tools: Array<{
    id: string;
    name: string;
    origin: string;
    source: 'webmcp-native' | 'dom-fallback';
    authState: AuthState;
  }>;
  connectedClients: number;
}

// ─── Union Types ───

export type ContentToBackgroundMessage =
  | ToolDiscoveredMessage
  | ToolRemovedMessage
  | PageToolsMessage
  | AuthStateChangedMessage;

export type BackgroundToContentMessage =
  | ExecuteToolMessage
  | DiscoverToolsMessage;

export type BackgroundToPopupMessage =
  | RegistryStateMessage;

export type AnyMessage =
  | ContentToBackgroundMessage
  | BackgroundToContentMessage
  | BackgroundToPopupMessage;
