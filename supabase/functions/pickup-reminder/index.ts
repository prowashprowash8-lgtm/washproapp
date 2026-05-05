// Edge Function : pickup-reminder
// Permet à un utilisateur authentifié d'envoyer un rappel push à
// l'utilisateur de la dernière transaction d'une machine donnée
// pour qu'il vienne récupérer son linge.
//
// Déployer : supabase functions deploy pickup-reminder

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderPayload {
  machine_id?: string;
  sender_user_id?: string;
}

interface RpcRow {
  ok: boolean;
  reason: string | null;
  recipient_user_id: string | null;
  recipient_name: string | null;
  machine_label: string | null;
  emplacement_label: string | null;
  reminder_id: string | null;
  expo_push_tokens: string[] | null;
}

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<{ sent: number; failed: number }> {
  const cleanTokens = tokens.filter((t) => typeof t === 'string' && t.length > 0);
  if (cleanTokens.length === 0) return { sent: 0, failed: 0 };

  const messages = cleanTokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error('Expo push error:', await res.text());
      return { sent: 0, failed: cleanTokens.length };
    }
    return { sent: cleanTokens.length, failed: 0 };
  } catch (err) {
    console.error('Expo push exception:', err);
    return { sent: 0, failed: cleanTokens.length };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // L'app n'utilise pas Supabase Auth standard (auth custom via RPC sign_in
    // + bcrypt + localStorage). Il n'y a donc pas de JWT utilisateur exploitable.
    // On lit l'identifiant du sender directement dans le body, et la RPC
    // `request_pickup_reminder` (côté SQL) valide :
    //   - l'existence du sender et du recipient dans `profiles`
    //   - l'anti auto-notification
    //   - le cooldown de 5 minutes
    // L'apikey anon (vérifié par Supabase Functions Gateway) est requise
    // pour appeler la fonction, ce qui bloque les appels totalement anonymes.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const body = (await req.json().catch(() => ({}))) as ReminderPayload;
    const machineId = body?.machine_id;
    const senderUserId = body?.sender_user_id;
    if (!machineId || typeof machineId !== 'string') {
      return new Response(JSON.stringify({ error: 'missing_machine_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!senderUserId || typeof senderUserId !== 'string') {
      return new Response(JSON.stringify({ error: 'missing_sender' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client service-role pour exécuter la RPC (qui retourne aussi les tokens push)
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: rpcData, error: rpcError } = await adminClient.rpc('request_pickup_reminder', {
      p_machine_id: machineId,
      p_sender_user_id: senderUserId,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(JSON.stringify({ error: 'rpc_failed', detail: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row: RpcRow | undefined = Array.isArray(rpcData) ? rpcData[0] : (rpcData as RpcRow | undefined);
    if (!row) {
      return new Response(JSON.stringify({ error: 'rpc_empty' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!row.ok) {
      const status = row.reason === 'cooldown'
        ? 429
        : row.reason === 'cannot_notify_self'
          ? 403
          : row.reason === 'no_recent_transaction'
            ? 409
            : row.reason === 'machine_not_found' || row.reason === 'recipient_not_found'
              ? 404
              : 400;
      return new Response(JSON.stringify({ ok: false, reason: row.reason }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = (row.expo_push_tokens || []).filter((t) => typeof t === 'string' && t.length > 0);
    const machineLabel = row.machine_label || 'votre machine';
    const placeLabel = row.emplacement_label ? ` à ${row.emplacement_label}` : '';

    const pushResult = await sendExpoPush(
      tokens,
      'WashPro — Votre linge est prêt',
      `Quelqu'un signale que ${machineLabel}${placeLabel} a fini son cycle. Merci de venir récupérer votre linge !`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        reminder_id: row.reminder_id,
        recipient_name: row.recipient_name,
        push_sent: pushResult.sent,
        push_failed: pushResult.failed,
        had_tokens: tokens.length > 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('pickup-reminder fatal:', err);
    return new Response(JSON.stringify({ error: 'fatal', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
