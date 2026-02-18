// Supabase Edge Function: registry-validate
// Scheduled cron (every 6 hours): promotes, demotes, and archives tools.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req: Request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const results = { promoted: 0, demoted: 0, archived: 0 };

    try {
        // ─── Promote: pending → verified ───
        // Requires ≥ 3 distinct contributors AND ≥ 60% success rate
        const { data: promoted } = await supabase
            .from('registry_tools')
            .update({ status: 'verified', verified_at: new Date().toISOString() })
            .eq('status', 'pending')
            .gte('contributor_count', 3)
            .gte('success_rate', 0.6)
            .select('id');

        results.promoted = promoted?.length ?? 0;

        // ─── Demote: verified → stale ───
        // Success rate drops below 40%
        const { data: demotedByRate } = await supabase
            .from('registry_tools')
            .update({ status: 'stale' })
            .eq('status', 'verified')
            .lt('success_rate', 0.4)
            .gt('execution_count', 5)  // Only demote after sufficient data
            .select('id');

        // No reports in 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: demotedByAge } = await supabase
            .from('registry_tools')
            .update({ status: 'stale' })
            .eq('status', 'verified')
            .lt('updated_at', thirtyDaysAgo)
            .select('id');

        results.demoted = (demotedByRate?.length ?? 0) + (demotedByAge?.length ?? 0);

        // ─── Archive: stale → deprecated ───
        // Stale for > 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
        const { data: archived } = await supabase
            .from('registry_tools')
            .update({ status: 'deprecated' })
            .eq('status', 'stale')
            .lt('updated_at', ninetyDaysAgo)
            .select('id');

        results.archived = archived?.length ?? 0;

        console.log('[registry-validate]', results);

        return new Response(JSON.stringify({ ok: true, ...results }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[registry-validate]', err);
        return new Response(JSON.stringify({ error: 'Validation failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
