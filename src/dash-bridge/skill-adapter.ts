/**
 * Dash Skill Adapter
 *
 * Converts WebMCP RegisteredTools into Dash's SkillDefinition format.
 * This module runs server-side in the Dash backend, converting tool
 * definitions received from the extension into skills the handler can call.
 *
 * NOTE: This file is designed to be imported by Dash (apps/dash),
 * not bundled into the extension. It lives here for co-location
 * with the extension code, and Dash imports it directly.
 */

import type { RegisteredTool, JSONSchema, JSONSchemaProperty } from '../shared/types';

// ─── Dash Types (mirrored to avoid circular dependency) ───
// These match the interfaces in apps/dash/lib/dash/skills/types.ts

interface DashSkillParameter {
  name: string;
  type: 'string' | 'string[]' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

interface DashSkillDefinition {
  id: string;
  name: string;
  category: string;
  requiredConnector: string;
  requiredScopes: string[];
  description: string;
  parameters: DashSkillParameter[];
  tier: number;
  statusHint?: string;
}

// ─── Conversion ───

/**
 * Convert a RegisteredTool from the extension into a Dash SkillDefinition.
 * The `execute` function is NOT included here — it must be wired up in the
 * Dash handler to route through the WebSocket bridge to the extension.
 */
export function webmcpToolToDashSkill(tool: RegisteredTool): DashSkillDefinition {
  const originSlug = tool.origin
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase();

  return {
    id: `webmcp.${originSlug}__${tool.name}`,
    name: `${tool.name} (${new URL(tool.origin).hostname})`,
    category: 'webmcp',
    requiredConnector: 'webmcp-gateway',
    requiredScopes: [],
    description: `[WebMCP: ${tool.origin}] ${tool.description}`,
    parameters: jsonSchemaToSkillParams(tool.inputSchema),
    tier: inferTier(tool),
    statusHint: tool.source === 'webmcp-native'
      ? 'Using native WebMCP'
      : 'Using DOM interaction',
  };
}

/**
 * Convert JSON Schema properties to Dash's SkillParameter format.
 */
function jsonSchemaToSkillParams(schema: JSONSchema): DashSkillParameter[] {
  if (!schema.properties) return [];

  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: mapJsonSchemaType(prop.type),
    description: prop.description ?? name,
    required: schema.required?.includes(name) ?? false,
    default: prop.default,
  }));
}

function mapJsonSchemaType(jsonType: string): DashSkillParameter['type'] {
  switch (jsonType) {
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'string[]';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

/**
 * Infer the Dash tier (permission level) from the tool's characteristics.
 *
 * Tier 1 = Read-only (search, query, list)
 * Tier 2 = Organize (label, move, sort)
 * Tier 3 = Modify (update, edit)
 * Tier 4 = Create (new items)
 * Tier 5 = Delete (remove, destroy)
 */
function inferTier(tool: RegisteredTool): number {
  const name = tool.name.toLowerCase();
  const desc = tool.description.toLowerCase();
  const combined = `${name} ${desc}`;

  if (/delete|remove|destroy|trash|purge/i.test(combined)) return 5;
  if (/create|add|new|insert|compose|post|publish/i.test(combined)) return 4;
  if (/update|edit|modify|change|rename|set/i.test(combined)) return 3;
  if (/move|label|tag|sort|organize|archive|categorize/i.test(combined)) return 2;

  // Default: read-only (search, get, list, view, fetch)
  return 1;
}

/**
 * Batch convert multiple tools.
 */
export function convertToolsToDashSkills(tools: RegisteredTool[]): DashSkillDefinition[] {
  return tools.map(webmcpToolToDashSkill);
}
