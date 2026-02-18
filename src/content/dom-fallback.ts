/**
 * DOM Fallback Tool Discovery
 *
 * For sites without native WebMCP support, auto-generates tool definitions
 * from interactive DOM elements (forms, search bars, action buttons).
 *
 * This is Phase 1 (basic forms). Phase 3 will add advanced SPA detection,
 * multi-step wizards, and common UI pattern recognition.
 */

import type { DiscoveredTool, JSONSchema, JSONSchemaProperty } from '../shared/types';

const domainSlug = window.location.hostname
  .replace(/^www\./, '')
  .replace(/\.[^.]+$/, '')
  .replace(/[^a-z0-9]/gi, '_')
  .toLowerCase();

/**
 * Scan the DOM for interactive elements and generate tool definitions.
 */
export function discoverDomTools(): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];

  // 1. Forms → tools (most reliable)
  tools.push(...discoverFormTools());

  // 2. Search inputs → dedicated search tools
  tools.push(...discoverSearchTools());

  // Deduplicate by name
  const seen = new Set<string>();
  return tools.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}

// ─── Form Discovery ───

function discoverFormTools(): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];
  const forms = document.querySelectorAll('form');

  for (const form of forms) {
    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    if (inputs.length === 0) continue;

    // Skip login/auth forms — these shouldn't be exposed as tools
    const action = form.getAttribute('action') ?? '';
    if (/login|signin|auth|password|register|signup/i.test(action)) continue;

    const name = generateFormToolName(form);
    const description = inferFormDescription(form);
    const inputSchema = buildSchemaFromForm(form, inputs);

    if (!name || !inputSchema.properties || Object.keys(inputSchema.properties).length === 0) continue;

    tools.push({
      name,
      description,
      inputSchema,
      source: 'dom-fallback',
      selector: uniqueSelector(form),
    });
  }

  return tools;
}

function generateFormToolName(form: HTMLFormElement): string {
  // Try to get a meaningful name from the form's context
  const action = form.getAttribute('action') ?? '';
  const id = form.id;
  const ariaLabel = form.getAttribute('aria-label');

  // From aria-label
  if (ariaLabel) {
    return slugify(ariaLabel);
  }

  // From form ID
  if (id) {
    return slugify(id.replace(/-form$/i, ''));
  }

  // From action URL
  if (action && action !== '#' && !action.startsWith('javascript:')) {
    const actionSlug = action.split('/').pop()?.split('?')[0] ?? '';
    if (actionSlug) return slugify(actionSlug);
  }

  // From submit button text
  const submit = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submit) {
    const text = submit.textContent?.trim() ?? (submit as HTMLInputElement).value;
    if (text) return slugify(text);
  }

  // From heading above the form
  const heading = form.previousElementSibling;
  if (heading && /^h[1-6]$/i.test(heading.tagName)) {
    return slugify(heading.textContent?.trim() ?? '');
  }

  return `${domainSlug}_form`;
}

function inferFormDescription(form: HTMLFormElement): string {
  const ariaLabel = form.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const submit = form.querySelector('button[type="submit"], input[type="submit"]');
  const submitText = submit?.textContent?.trim() ?? (submit as HTMLInputElement)?.value ?? '';

  const title = document.title;
  return submitText
    ? `${submitText} on ${title}`
    : `Submit form on ${title}`;
}

function buildSchemaFromForm(
  _form: HTMLFormElement,
  inputs: NodeListOf<Element>,
): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const input of inputs) {
    const name = input.getAttribute('name');
    if (!name) continue;

    const type = (input as HTMLInputElement).type ?? 'text';
    const label = findLabel(input);
    const placeholder = input.getAttribute('placeholder');

    const prop: JSONSchemaProperty = {
      type: mapInputType(type),
      description: label ?? placeholder ?? name,
    };

    // Handle select options
    if (input instanceof HTMLSelectElement) {
      const options = Array.from(input.options)
        .filter(o => o.value && o.value !== '')
        .map(o => o.value);
      if (options.length > 0 && options.length <= 20) {
        prop.enum = options;
      }
    }

    properties[name] = prop;

    if (input.hasAttribute('required')) {
      required.push(name);
    }
  }

  return { type: 'object', properties, required };
}

// ─── Search Discovery ───

function discoverSearchTools(): DiscoveredTool[] {
  const tools: DiscoveredTool[] = [];
  const searchInputs = document.querySelectorAll(
    'input[type="search"], [role="searchbox"], input[name="q"], input[name="query"], input[name="search"]'
  );

  // Only take the first search input to avoid duplicates
  const firstSearch = searchInputs[0];
  if (!firstSearch) return tools;

  tools.push({
    name: `search_${domainSlug}`,
    description: `Search on ${document.title}`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    source: 'dom-fallback',
    selector: uniqueSelector(firstSearch),
  });

  return tools;
}

// ─── Utility Functions ───

function findLabel(element: Element): string | null {
  // 1. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim();
  }

  // 3. Associated <label>
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // 4. Parent label
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    return parentLabel.textContent.trim().replace(/(input|select|textarea)/gi, '').trim();
  }

  return null;
}

function mapInputType(htmlType: string): string {
  switch (htmlType) {
    case 'number':
    case 'range':
      return 'number';
    case 'checkbox':
      return 'boolean';
    default:
      return 'string';
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

/**
 * Generate a unique CSS selector for an element.
 * Used to re-target the element during tool execution.
 */
export function uniqueSelector(element: Element): string {
  // Prefer ID
  if (element.id) return `#${CSS.escape(element.id)}`;

  // Build a path from tag + nth-child
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // Add nth-child for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        s => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}
