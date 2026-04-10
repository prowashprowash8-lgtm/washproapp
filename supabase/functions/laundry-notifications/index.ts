// Edge Function : notifications de fin de cycle laverie
// Cron : exécuter toutes les minutes (Supabase Dashboard → Edge Functions → Cron)
// Envoie :
//   - T-10 min : "Votre linge sera prêt dans 10 minutes !"
//   - Fin : "Le cycle est terminé, vous pouvez récupérer votre linge."
// Déployer : supabase functions deploy laundry-notifications

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Libérer les machines dont le temps est écoulé
    await supabase.rpc('release_expired_machines');

    // 2. Transactions avec estimated_end_time dans ~10 min (fenêtre 9-11 min)
    const in10Min = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const in9Min = new Date(Date.now() + 9 * 60 * 1000).toISOString();
    const in11Min = new Date(Date.now() + 11 * 60 * 1000).toISOString();

    const { data: tx10 } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('status', 'completed')
      .not('estimated_end_time', 'is', null)
      .gte('estimated_end_time', in9Min)
      .lte('estimated_end_time', in11Min);

    if (tx10?.length) {
      const userIds = [...new Set(tx10.map((t) => t.user_id))];
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', userIds);
      const tokenList = (tokens || []).map((t) => t.expo_push_token).filter(Boolean);
      await sendExpoPush(
        tokenList,
        'WashPro',
        'Votre linge sera prêt dans 10 minutes !'
      );
    }

    // 3. Transactions dont estimated_end_time vient de passer (dernière minute)
    const now = new Date().toISOString();
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: txEnd } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('status', 'completed')
      .not('estimated_end_time', 'is', null)
      .lte('estimated_end_time', now)
      .gte('estimated_end_time', oneMinAgo);

    if (txEnd?.length) {
      const userIds = [...new Set(txEnd.map((t) => t.user_id))];
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .in('user_id', userIds);
      const tokenList = (tokens || []).map((t) => t.expo_push_token).filter(Boolean);
      await sendExpoPush(
        tokenList,
        'WashPro',
        'Le cycle est terminé, vous pouvez récupérer votre linge.'
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
