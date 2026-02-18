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

'use strict';

const { createInterface } = require('readline');

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

    // Handle initialize locally — respond with the protocol version Claude sent us
    // so there's no version mismatch. Claude Desktop validates this strictly.
    if (request.method === 'initialize') {
        const clientVersion = request.params?.protocolVersion ?? '2025-11-25';
        const response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: clientVersion,
                capabilities: {
                    tools: { listChanged: true },
                },
                serverInfo: {
                    name: 'arcede-agent-gateway',
                    version: '0.1.0',
                },
            },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
    }

    // Handle ping locally
    if (request.method === 'ping') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\n');
        return;
    }

    // Handle notifications (no id, no response needed)
    if (request.id === undefined || request.id === null) {
        // Forward to bridge for side effects but don't wait for response
        fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        }).catch(() => { });
        return;
    }

    // Forward everything else (tools/list, tools/call, etc.) to the bridge
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

// ─── Subscribe to push notifications from the bridge ───
// When the extension's tool list changes, the bridge pushes an event here
// so we can forward the MCP notification to Claude Desktop via stdout.

const http = require('http');

function subscribeToNotifications() {
    const req = http.get('http://localhost:3000/notify', (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
            buffer += chunk.toString();
            // Parse SSE events (lines starting with "data: ")
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data) continue;
                try {
                    const event = JSON.parse(data);
                    if (event.type === 'connected') continue; // skip handshake
                    if (event.method === 'notifications/tools/list_changed') {
                        // Forward MCP notification to Claude Desktop
                        process.stdout.write(JSON.stringify(event) + '\n');
                        process.stderr.write('[arcede-proxy] Tools list changed, notified Claude\n');
                    }
                } catch { }
            }
        });
        res.on('end', () => {
            // Reconnect after a delay
            process.stderr.write('[arcede-proxy] Notify SSE disconnected, reconnecting in 2s...\n');
            setTimeout(subscribeToNotifications, 2000);
        });
    });
    req.on('error', () => {
        // Bridge not running yet — retry
        setTimeout(subscribeToNotifications, 3000);
    });
}

subscribeToNotifications();
