/** Max tools per origin to prevent registry bloat */
export const MAX_TOOLS_PER_ORIGIN = 50;

/** Max total tools across all origins */
export const MAX_TOTAL_TOOLS = 200;

/** Tool execution timeout (ms) */
export const TOOL_EXECUTION_TIMEOUT = 30_000;

/** How often to re-verify discovered tools (ms) — 5 minutes */
export const TOOL_REVERIFICATION_INTERVAL = 5 * 60 * 1000;

/** How long to keep tools from closed tabs before pruning (ms) — 2 minutes */
export const CLOSED_TAB_GRACE_PERIOD = 2 * 60 * 1000;

/** Extension name used in MCP server identification */
export const GATEWAY_NAME = 'arcede-agent-gateway';

/** Extension version */
export const GATEWAY_VERSION = '0.1.0';

// ─── Shared Registry ───

/** Registry API base URL — injected at build time via VITE_REGISTRY_API_BASE env var */
export const REGISTRY_API_BASE: string = __REGISTRY_API_BASE__;

/** How often to re-fetch registry tools (ms) — 24 hours */
export const REGISTRY_FETCH_INTERVAL = 24 * 60 * 60 * 1000;

/** Minimum success rate to accept a community tool */
export const REGISTRY_MIN_SUCCESS_RATE = 0.6;

/** Minimum distinct contributors to trust a community tool */
export const REGISTRY_MIN_CONTRIBUTORS = 3;

/** Origins to never scan (performance / privacy) */
export const BLOCKED_ORIGINS = new Set([
  'chrome://',
  'chrome-extension://',
  'about:',
  'data:',
  'file://',
  'devtools://',
]);

/** Common DOM patterns that indicate auth-required state */
export const AUTH_REQUIRED_INDICATORS = [
  'input[type="password"]',
  'form[action*="login"]',
  'form[action*="signin"]',
  'form[action*="auth"]',
  '[data-testid="login"]',
  '.login-form',
  '#login',
];

/** Common DOM patterns that indicate authenticated state */
export const AUTH_PRESENT_INDICATORS = [
  '[aria-label*="account"]',
  '[aria-label*="profile"]',
  '[data-testid="user-menu"]',
  'img[alt*="avatar"]',
  '.user-avatar',
  '#user-menu',
];
