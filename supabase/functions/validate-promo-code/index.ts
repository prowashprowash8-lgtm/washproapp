// Edge Function : valide/consomme un code promo, avec limite de tentatives par IP.
// Déployer : supabase functions deploy validate-promo-code
// Secrets : SUPABASE_SERVICE_ROLE_KEY (ou SERVICE_ROLE_KEY)
//
// MOYENNE #9 de l'audit : use_promo_code n'est plus accessible directement à anon (voir
// promo-codes-machine-type.sql). Tout appel passe par ici, qui limite le nombre de
// tentatives par IP avant de vérifier le code — sans restreindre l'usage à un compte,
// les codes restent des pools partagés (uses_remaining) utilisables par n'importe qui.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MINUTES = 1;
const CLEANUP_OLDER_THAN_MS = 60 * 60 * 1000; // 1h

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function getServiceRoleKey(): string {
  const auto = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (auto && auto.length > 20) return auto;
  const manual = Deno.env.get('SERVICE_ROLE_KEY');
  if (manual && manual.length > 20) return manual;
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'invalid_body' }, 400);
    }

    const code = String(body.p_code ?? '').trim();
    const machineId = String(body.p_machine_id ?? '').trim();
    if (!code || !machineId) {
      return jsonResponse({ success: false, error: 'invalid' }, 400);
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = getServiceRoleKey();
    if (!supabaseUrl || !serviceRole) {
      return jsonResponse({ success: false, error: 'service_role_missing' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Nettoyage opportuniste des vieilles tentatives (évite une croissance illimitée).
    await admin
      .from('promo_code_attempts')
      .delete()
      .lt('created_at', new Date(Date.now() - CLEANUP_OLDER_THAN_MS).toISOString());

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from('promo_code_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', since);

    if (countErr) {
      return jsonResponse({ success: false, error: countErr.message }, 500);
    }

    if ((count ?? 0) >= MAX_ATTEMPTS_PER_WINDOW) {
      return jsonResponse({ success: false, error: 'too_many_attempts' }, 429);
    }

    await admin.from('promo_code_attempts').insert({ ip });

    const { data, error } = await admin.rpc('use_promo_code', {
      p_code: code,
      p_machine_id: machineId,
    });

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    return jsonResponse((data as Record<string, unknown>) ?? { success: false, error: 'invalid' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur';
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
