// Edge Function : demande de réinitialisation — envoi du code par e-mail (Resend)
// Déployer : supabase functions deploy request-password-reset
//
// Secrets (Dashboard → Edge Functions → Secrets) :
// - RESEND_API_KEY
// - RESEND_FROM  (ex. "WashPro <noreply@votredomaine.com>")
// Optionnel dev sans Resend : ALLOW_DEV_RESET_CODE=true  → réponse JSON peut contenir code + dev:true
//
// Variables auto : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('request-password-reset:', e);
    return jsonResponse({ error: `Erreur interne: ${msg}` }, 500);
  }
});

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Configuration Supabase manquante (SUPABASE_URL / SERVICE_ROLE_KEY)' }, 500);
  }

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const email = String(body.email || '').trim();
  if (!email) {
    return jsonResponse({ error: 'Email requis' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('password_reset_issue_code', {
    p_email: email,
  });

  if (error) {
    // PostgREST : détail utile si la RPC n’existe pas ou refus de permission
    const detail = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(' — ');
    console.error('RPC password_reset_issue_code:', error);
    return jsonResponse(
      {
        error: detail || 'Erreur RPC password_reset_issue_code',
        detail: (error as { details?: string }).details ?? null,
        help: 'Si la fonction est absente : exécutez supabase/password-reset.sql sur ce projet (GRANT service_role).',
      },
      500
    );
  }

  let payload: { success?: boolean; code?: string } = {};
  if (data != null && typeof data === 'object') {
    payload = data as { success?: boolean; code?: string };
  } else if (typeof data === 'string') {
    try {
      payload = JSON.parse(data) as { success?: boolean; code?: string };
    } catch {
      payload = {};
    }
  }

  const code = payload.code != null && payload.code !== '' ? String(payload.code) : '';

  if (!code) {
    return jsonResponse({ success: true });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const resendFrom = Deno.env.get('RESEND_FROM') || 'WashPro <onboarding@resend.dev>';
  const allowDev = Deno.env.get('ALLOW_DEV_RESET_CODE') === 'true';

  if (!resendKey) {
    if (allowDev) {
      return jsonResponse({ success: true, code, dev: true });
    }
    return jsonResponse(
      {
        error:
          'Envoi e-mail non configuré. Ajoutez RESEND_API_KEY dans les secrets Supabase, ou ALLOW_DEV_RESET_CODE=true pour le développement.',
      },
      503
    );
  }

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [email],
      subject: 'WashPro — Réinitialisation du mot de passe',
      html: `
        <p>Bonjour,</p>
        <p>Votre code de réinitialisation : <strong style="font-size:1.25rem;letter-spacing:0.1em">${code}</strong></p>
        <p>Il est valable 15 minutes.</p>
        <p>Si vous n’avez pas demandé cette réinitialisation, vous pouvez ignorer ce message.</p>
        <p>— WashPro</p>
      `,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text();
    console.error('Resend error:', sendRes.status, detail);
    let hint = detail;
    try {
      const j = JSON.parse(detail) as { message?: string; name?: string };
      if (j?.message) hint = j.message;
    } catch {
      /* garder le texte brut */
    }
    return jsonResponse(
      {
        error: `Échec envoi e-mail (Resend ${sendRes.status}). Vérifiez RESEND_API_KEY, RESEND_FROM et le domaine Resend.`,
        detail: hint || detail,
      },
      502
    );
  }

  return jsonResponse({ success: true });
}
