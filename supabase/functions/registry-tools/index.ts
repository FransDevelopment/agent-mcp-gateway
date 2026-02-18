// Supabase Edge Function: registry-tools
// Handles: GET (fetch tools by origin) and POST (contribute tool definitions)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const url = new URL(req.url);

    try {
        // ─── GET: Fetch tools for an origin ───
        if (req.method === 'GET') {
            const origin = url.searchParams.get('origin');
            const origins = url.searchParams.get('origins'); // CSV for bulk

            if (!origin && !origins) {
                return jsonResponse({ error: 'origin or origins parameter required' }, 400);
            }

            const originList = origins
                ? origins.split(',').map(o => o.trim())
                : [origin!];

            const { data, error } = await supabase
                .from('registry_tools')
                .select('tool_name, description, input_schema, status, success_rate, contributor_count, updated_at')
                .in('origin', originList)
                .in('status', ['verified', 'pending'])
                .order('success_rate', { ascending: false });

            if (error) throw error;

            const tools = (data ?? []).map((row: Record<string, unknown>) => ({
                name: row.tool_name,
                description: row.description,
                inputSchema: row.input_schema,
                status: row.status,
                successRate: row.success_rate,
                contributorCount: row.contributor_count,
                updatedAt: row.updated_at,
            }));

            return jsonResponse({ tools });
        }

        // ─── POST: Contribute a tool definition ───
        if (req.method === 'POST') {
            const body = await req.json();
            const { origin, toolName, description, inputSchema, contributorId } = body;

            if (!origin || !toolName || !inputSchema || !contributorId) {
                return jsonResponse({ error: 'Missing required fields' }, 400);
            }

            // Rate limit: max 20 contributions per contributor per day
            const dayAgo = new Date(Date.now() - 86400000).toISOString();
            const { count: recentCount } = await supabase
                .from('registry_contributions')
                .select('*', { count: 'exact', head: true })
                .eq('contributor_id', contributorId)
                .gte('contributed_at', dayAgo);

            if ((recentCount ?? 0) >= 20) {
                return jsonResponse({ error: 'Rate limit exceeded (20/day)' }, 429);
            }

            // Validate schema: must be object type with ≤ 20 properties
            if (inputSchema.type !== 'object') {
                return jsonResponse({ error: 'Schema must be object type' }, 400);
            }
            const propCount = Object.keys(inputSchema.properties ?? {}).length;
            if (propCount > 20) {
                return jsonResponse({ error: 'Schema too large (max 20 properties)' }, 400);
            }

            // Compute schema hash for dedup
            const schemaStr = JSON.stringify(inputSchema, Object.keys(inputSchema).sort());
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(schemaStr));
            const schemaHash = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            // Upsert tool definition
            const { data: tool, error: upsertError } = await supabase
                .from('registry_tools')
                .upsert(
                    {
                        origin,
                        tool_name: toolName,
                        description: description || '',
                        input_schema: inputSchema,
                        schema_hash: schemaHash,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'origin,tool_name' }
                )
                .select('id, contributor_count')
                .single();

            if (upsertError) throw upsertError;

            // Record contribution (ignore duplicate — unique constraint on tool_id + contributor_id)
            const { error: contribError } = await supabase
                .from('registry_contributions')
                .upsert(
                    {
                        tool_id: tool.id,
                        contributor_id: contributorId,
                        schema_hash: schemaHash,
                    },
                    { onConflict: 'tool_id,contributor_id' }
                );

            if (contribError) throw contribError;

            // Update contributor count
            const { count: totalContributors } = await supabase
                .from('registry_contributions')
                .select('*', { count: 'exact', head: true })
                .eq('tool_id', tool.id);

            await supabase
                .from('registry_tools')
                .update({ contributor_count: totalContributors ?? 1 })
                .eq('id', tool.id);

            return jsonResponse({ ok: true, toolId: tool.id, contributors: totalContributors });
        }

        return jsonResponse({ error: 'Method not allowed' }, 405);
    } catch (err) {
        console.error('[registry-tools]', err);
        return jsonResponse({ error: 'Internal error' }, 500);
    }
});

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
