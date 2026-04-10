// Edge Function : notifications missions
// 1. mission_posted : appelée par le board après création → notifie les utilisateurs des laveries
// 2. submission : webhook sur mission_submissions INSERT → notifie les admins
// Déployer : supabase functions deploy mission-notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendExpoPush(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;
  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('Expo push error:', await res.text());
  }
}

interface MissionPostedPayload {
  type: 'mission_posted';
  mission_id: string;
  emplacement_ids: string[];
  titre: string;
}

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    mission_id: string;
    user_id: string | null;
    emplacement_id: string;
    status: string;
    photo_urls?: string[];
  };
  schema: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => null);

    // Cas 1 : appels directs depuis le board (mission postée)
    if (body?.type === 'mission_posted') {
      const { mission_id, emplacement_ids, titre } = body as MissionPostedPayload;
      if (!mission_id || !emplacement_ids?.length || !titre) {
        return new Response(
          JSON.stringify({ error: 'mission_id, emplacement_ids, titre requis' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { data: txData } = await supabase
        .from('transactions')
        .select('user_id')
        .in('emplacement_id', emplacement_ids)
        .not('user_id', 'is', null);

      const userIds = [...new Set((txData ?? []).map((t) => t.user_id).filter(Boolean))];
      if (userIds.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, notified: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', userIds);

      const tokenList = (tokens ?? []).map((t) => t.expo_push_token).filter(Boolean);
      await sendExpoPush(
        tokenList,
        'WashPro - Nouvelle mission',
        titre
      );

      return new Response(
        JSON.stringify({ ok: true, notified: tokenList.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Cas 2 : webhook sur mission_submissions INSERT (soumission utilisateur)
    if (body?.type === 'INSERT' && body?.table === 'mission_submissions') {
      const payload = body as WebhookPayload;
      const record = payload.record;

      const { data: mission } = await supabase
        .from('missions')
        .select('titre')
        .eq('id', record.mission_id)
        .single();

      const { data: adminTokens } = await supabase
        .from('mission_alert_tokens')
        .select('expo_push_token');

      const tokenList = (adminTokens ?? []).map((t) => t.expo_push_token).filter(Boolean);
      const missionTitre = mission?.titre ?? 'Mission';
      const nbPhotos = record.photo_urls?.length ?? 0;

      await sendExpoPush(
        tokenList,
        'WashPro - Nouvelle soumission',
        `${missionTitre} : ${nbPhotos} photo(s) envoyée(s)`
      );

      return new Response(
        JSON.stringify({ ok: true, notified: tokenList.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Payload non reconnu' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
