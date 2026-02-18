#!/usr/bin/env node
/**
 * Arcede Agent Gateway — Local MCP Bridge
 *
 * Bridges Claude Desktop (stdio MCP) ↔ Chrome extension (chrome.runtime.sendMessage).
 *
 * How it works:
 *   1. This script runs a local HTTP server on localhost:3000
 *   2. A companion page (bridge.html) runs in Chrome on localhost:3000
 *   3. The page has permission to call chrome.runtime.sendMessage to the extension
 *   4. Claude Desktop connects to this bridge via stdio using the mcp-bridge wrapper
 *
 * Usage:
 *   node test/bridge-server.js
 *   Then open http://localhost:3000 in Chrome (with the extension installed)
 *   Then configure Claude Desktop to use the bridge (see README)
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// In-flight MCP requests waiting for extension responses
const pending = new Map(); // id → { resolve, reject }
let sseClients = []; // SSE connections from bridge.html

const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ─── Serve bridge.html ───
    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(__dirname, 'bridge.html'), 'utf8'));
        return;
    }

    // ─── SSE: bridge.html subscribes to receive MCP requests ───
    if (req.method === 'GET' && url.pathname === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        res.write('data: {"type":"connected"}\n\n');
        sseClients.push(res);
        req.on('close', () => {
            sseClients = sseClients.filter(c => c !== res);
        });
        return;
    }

    // ─── POST /mcp: receive request from Claude Desktop proxy ───
    if (req.method === 'POST' && url.pathname === '/mcp') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const request = JSON.parse(body);
            const id = request.id ?? `auto-${Date.now()}`;

            // Forward to bridge.html via SSE
            const event = JSON.stringify({ id, request });
            for (const client of sseClients) {
                client.write(`data: ${event}\n\n`);
            }

            // Wait for response from bridge.html
            const timeout = setTimeout(() => {
                pending.delete(id);
                res.writeHead(504);
                res.end(JSON.stringify({ error: 'Extension response timeout' }));
            }, 30000);

            pending.set(id, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    pending.delete(id);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    });
                    res.end(JSON.stringify(response));
                },
            });
        });
        return;
    }

    // ─── POST /response: bridge.html sends back extension response ───
    if (req.method === 'POST' && url.pathname === '/response') {
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        res.end('ok');

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, response } = JSON.parse(body);
            pending.get(id)?.resolve(response);
        });
        return;
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
        res.end();
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\n🌉 Arcede Bridge running on http://localhost:${PORT}`);
    console.log(`\n1. Open http://localhost:${PORT} in Chrome (with the extension installed)`);
    console.log(`2. Copy the Extension ID shown in chrome://extensions`);
    console.log(`3. Paste it into the bridge page`);
    console.log(`4. Configure Claude Desktop (see test/claude-desktop-config.json)\n`);
});
