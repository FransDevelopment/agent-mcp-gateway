#!/usr/bin/env node
/**
 * Arcede MCP stdio proxy — bridges Claude Desktop to the local bridge server.
 *
 * Claude Desktop speaks MCP over stdio. This script reads from stdin,
 * forwards each JSON-RPC request to the bridge server over HTTP,
 * and writes the response back to stdout.
 *
 * Usage (configured in Claude Desktop's claude_desktop_config.json):
 *   "command": "node",
 *   "args": ["/path/to/test/mcp-proxy.js"]
 */

import { createInterface } from 'readline';

const BRIDGE_URL = 'http://localhost:3000/mcp';

const rl = createInterface({ input: process.stdin });

rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request;
    try {
        request = JSON.parse(trimmed);
    } catch {
        return;
    }

    try {
        const res = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        const response = await res.json();
        process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
        const errorResponse = {
            jsonrpc: '2.0',
            id: request.id ?? null,
            error: { code: -32603, message: `Bridge error: ${err.message}` },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
});
