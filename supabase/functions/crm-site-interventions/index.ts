// Edge Function : historique interventions CRM pour une laverie (emplacement)
// Déployer : supabase functions deploy crm-site-interventions --no-verify-jwt
//
// Secrets :
// - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto) ou SERVICE_ROLE_KEY (manuel)
// - CRM_API_BASE_URL : ex. https://ton-crm.vercel.app
// - CRM_API_KEY : clé / token (jamais côté front)
// Optionnel :
// - CRM_INTERVENTIONS_PATH_TEMPLATE : défaut "/api/sites/{crm_site_id}/interventions"
//   (remplacements : {crm_site_id}, {emplacement_id})
// - CRM_AUTH_HEADER : "Authorization" (défaut Bearer) ou "x-api-key"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getServiceRoleKey(): string {
  const auto = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (auto && auto.length > 20) return auto;
  const manual = Deno.env.get('SERVICE_ROLE_KEY');
  if (manual && manual.length > 20) return manual;
  return '';
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeInterventions(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw.map((x) => (typeof x === 'object' && x ? (x as Record<string, unknown>) : { value: x }));
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const arr = o.data ?? o.interventions ?? o.items ?? o.results;
    if (Array.isArray(arr)) return normalizeInterventions(arr);
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const sr = getServiceRoleKey();
  if (!sr) {
    return json({ ok: false, error: 'missing_service_role' }, 500);
  }

  let body: { emplacement_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const emplacementId = String(body?.emplacement_id || '').trim();
  if (!emplacementId || emplacementId.length < 10) {
    return json({ ok: false, error: 'emplacement_id_required' }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, sr);
  const { data: linkRow, error: linkErr } = await supabase
    .from('crm_laverie_links')
    .select('crm_site_id, sync_status, last_error')
    .eq('emplacement_id', emplacementId)
    .maybeSingle();

  if (linkErr) {
    return json({ ok: false, error: linkErr.message }, 500);
  }

  if (!linkRow) {
    return json({
      ok: true,
      sync_status: null,
      crm_site_id: null,
      interventions: [],
      message: 'no_crm_link_row',
    });
  }

  const crmSiteId = linkRow.crm_site_id ? String(linkRow.crm_site_id) : '';
  const syncStatus = String(linkRow.sync_status || 'pending');

  if (!crmSiteId) {
    return json({
      ok: true,
      sync_status: syncStatus,
      crm_site_id: null,
      interventions: [],
      message: 'crm_site_not_synced_yet',
      last_error: linkRow.last_error,
    });
  }

  const baseRaw = (Deno.env.get('CRM_API_BASE_URL') || '').trim().replace(/\/$/, '');
  const apiKey = (Deno.env.get('CRM_API_KEY') || '').trim();
  if (!baseRaw || !apiKey) {
    return json({
      ok: true,
      sync_status: syncStatus,
      crm_site_id: crmSiteId,
      interventions: [],
      crm_configured: false,
      message: 'crm_env_missing',
    });
  }

  const pathTmpl =
    (Deno.env.get('CRM_INTERVENTIONS_PATH_TEMPLATE') || '/api/sites/{crm_site_id}/interventions').trim();
  const path = pathTmpl
    .replace(/\{crm_site_id\}/g, encodeURIComponent(crmSiteId))
    .replace(/\{emplacement_id\}/g, encodeURIComponent(emplacementId));
  const url = path.startsWith('http') ? path : `${baseRaw}${path.startsWith('/') ? path : `/${path}`}`;

  const authMode = (Deno.env.get('CRM_AUTH_MODE') || 'bearer').toLowerCase();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authMode === 'x-api-key' || authMode === 'x_api_key') {
    headers['x-api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    if (!res.ok) {
      return json({
        ok: true,
        crm_configured: true,
        sync_status: syncStatus,
        crm_site_id: crmSiteId,
        interventions: [],
        fetch_warning: `crm_http_${res.status}`,
        upstream_body_preview: text.slice(0, 400),
      });
    }
    const interventions = normalizeInterventions(parsed);
    return json({
      ok: true,
      crm_configured: true,
      sync_status: syncStatus,
      crm_site_id: crmSiteId,
      interventions,
    });
  } catch (e) {
    return json({
      ok: false,
      sync_status: syncStatus,
      crm_site_id: crmSiteId,
      interventions: [],
      error: e instanceof Error ? e.message : 'fetch_failed',
    }, 200);
  }
});
