// Supabase Edge Function: registry-report
// Handles: POST to report tool execution success/failure

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    try {
        const { origin, toolName, success, reporterId } = await req.json();

        if (!origin || !toolName || typeof success !== 'boolean' || !reporterId) {
            return jsonResponse({ error: 'Missing required fields: origin, toolName, success, reporterId' }, 400);
        }

        // Rate limit: max 100 reports per reporter per day
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { count: recentCount } = await supabase
            .from('registry_execution_reports')
            .select('*', { count: 'exact', head: true })
            .eq('reporter_id', reporterId)
            .gte('reported_at', dayAgo);

        if ((recentCount ?? 0) >= 100) {
            return jsonResponse({ error: 'Rate limit exceeded (100 reports/day)' }, 429);
        }

        // Look up the tool
        const { data: tool, error: lookupError } = await supabase
            .from('registry_tools')
            .select('id')
            .eq('origin', origin)
            .eq('tool_name', toolName)
            .single();

        if (lookupError || !tool) {
            return jsonResponse({ error: 'Tool not found in registry' }, 404);
        }

        // Insert report (trigger auto-recalculates success_rate)
        const { error: insertError } = await supabase
            .from('registry_execution_reports')
            .insert({
                tool_id: tool.id,
                reporter_id: reporterId,
                success,
            });

        if (insertError) throw insertError;

        return jsonResponse({ ok: true });
    } catch (err) {
        console.error('[registry-report]', err);
        return jsonResponse({ error: 'Internal error' }, 500);
    }
});

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
