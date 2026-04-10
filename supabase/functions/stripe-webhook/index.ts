// Edge Function : reçoit les webhooks Stripe
// Quand checkout.session.completed → insère dans machine_commands pour l'ESP32
// Déployer : supabase functions deploy stripe-webhook
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Configurer l'URL dans Stripe Dashboard : https://xxx.supabase.co/functions/v1/stripe-webhook

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Pas de apiVersion figée : 2024-11-20 peut être refusée (« Invalid Stripe API version »).
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentStatus = String(session.payment_status || '').trim();
    if (paymentStatus !== 'paid') {
      // Ne jamais créditer/démarrer tant que Stripe n'a pas marqué le paiement comme réglé.
      return new Response(JSON.stringify({ received: true, ignored: 'not_paid' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    const meta = session.metadata || {};
    const checkoutKind = (meta.checkout_kind || '').trim();
    const esp32Id = meta.esp32_id;
    const userId = meta.user_id;
    const machineId = meta.machine_id;
    const emplacementId = meta.emplacement_id;
    const amountCents = session.amount_total != null ? session.amount_total : 0;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Recharge portefeuille (une seule transaction Stripe → crédit interne)
    if (checkoutKind === 'wallet_recharge' && userId && userId.length > 10 && amountCents > 0) {
      const { error: rechargeErr } = await supabase.rpc('apply_wallet_recharge', {
        p_user_id: userId,
        p_amount_centimes: amountCents,
        p_stripe_session_id: session.id,
      });
      if (rechargeErr) {
        console.error('apply_wallet_recharge:', rechargeErr);
        return new Response(JSON.stringify({ error: rechargeErr.message }), { status: 500 });
      }
      console.log('Portefeuille crédité:', userId, amountCents, session.id);
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const amountEur = amountCents / 100;

    // Flux complet : transaction + commande (comme le code promo)
    if (
      esp32Id && userId && machineId && emplacementId &&
      userId.length > 10 && machineId.length > 10 && emplacementId.length > 10
    ) {
      const { data, error } = await supabase.rpc('create_transaction_and_start_machine', {
        p_user_id: userId,
        p_machine_id: machineId,
        p_emplacement_id: emplacementId,
        p_esp32_id: esp32Id,
        p_amount: amountEur,
        p_payment_method: 'card',
        p_promo_code: null,
      });
      if (error) {
        console.error('create_transaction_and_start_machine:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      console.log('Paiement carte enregistré + START:', data);
    } else if (esp32Id) {
      // Ancien flux (métadonnées incomplètes) : seulement la commande ESP
      await supabase.from('machine_commands').insert({
        esp32_id: esp32Id,
        command: 'START',
        status: 'pending',
      });
      console.log(`Commande START (legacy) pour ESP32: ${esp32Id}`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
