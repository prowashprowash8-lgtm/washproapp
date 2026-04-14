// Edge Function : reçoit les webhooks Stripe
// - checkout.session.completed → recharge portefeuille ou paiement machine + START
// - refund.created → débite le portefeuille si la recharge était checkout_kind=wallet_recharge
// Déployer : supabase functions deploy stripe-webhook
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Service role : variable auto SUPABASE_SERVICE_ROLE_KEY OU secret manuel SERVICE_ROLE_KEY (préfixe SUPABASE_ interdit pour les secrets custom)
// Stripe Dashboard → Webhooks : inclure « refund.created » (et checkout.session.completed)

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Pas de apiVersion figée : 2024-11-20 peut être refusée (« Invalid Stripe API version »).
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function getServiceRoleKey(): string {
  const auto = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (auto && auto.length > 20) return auto;
  const manual = Deno.env.get('SERVICE_ROLE_KEY');
  if (manual && manual.length > 20) return manual;
  return '';
}

/**
 * Le payload webhook `checkout.session.completed` est souvent minimal : les métadonnées
 * peuvent être vides sur la Session mais présentes sur le PaymentIntent (voir create-checkout).
 * Sans fusion, la recharge portefeuille est ignorée alors que Stripe a bien encaissé.
 */
async function getSessionWithMergedMetadata(sessionId: string): Promise<{
  session: Stripe.Checkout.Session;
  meta: Record<string, string>;
}> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });
  const meta: Record<string, string> = {};
  for (const [k, v] of Object.entries(session.metadata || {})) {
    meta[k] = String(v ?? '');
  }
  const pi = session.payment_intent;
  if (pi && typeof pi === 'object' && 'metadata' in pi) {
    for (const [k, v] of Object.entries((pi as Stripe.PaymentIntent).metadata || {})) {
      if (!meta[k] || meta[k] === '') meta[k] = String(v ?? '');
    }
  }
  return { session, meta };
}

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
    const thin = event.data.object as Stripe.Checkout.Session;
    const paymentStatus = String(thin.payment_status || '').trim();
    if (paymentStatus !== 'paid') {
      // Ne jamais créditer/démarrer tant que Stripe n'a pas marqué le paiement comme réglé.
      return new Response(JSON.stringify({ received: true, ignored: 'not_paid' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let session = thin;
    let meta: Record<string, string> = { ...(thin.metadata || {}) };
    try {
      const loaded = await getSessionWithMergedMetadata(thin.id);
      session = loaded.session;
      meta = loaded.meta;
    } catch (e) {
      console.error('checkout.sessions.retrieve (merge meta):', e);
    }

    const checkoutKind = (meta.checkout_kind || '').trim();
    const esp32Id = meta.esp32_id;
    const userId = meta.user_id;
    const machineId = meta.machine_id;
    const emplacementId = meta.emplacement_id;
    const amountCents = session.amount_total != null ? session.amount_total : 0;

    const serviceRole = getServiceRoleKey();
    if (!serviceRole) {
      console.error(
        'stripe-webhook: clé service role absente. Ajoute le secret SERVICE_ROLE_KEY (valeur = clé service_role du dashboard API) ou vérifie l’injection auto.'
      );
      return new Response(JSON.stringify({ error: 'missing_service_role' }), { status: 500 });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRole);

    // Recharge portefeuille — ne pas tomber silencieusement dans le flux machine si meta incomplète
    if (checkoutKind === 'wallet_recharge') {
      if (!userId || userId.length <= 10 || !amountCents || amountCents <= 0) {
        console.error('wallet_recharge: métadonnées incomplètes après fusion', {
          sessionId: session.id,
          userId: userId || '',
          amountCents,
          metaKeys: Object.keys(meta),
        });
        return new Response(
          JSON.stringify({
            received: true,
            ignored: 'wallet_incomplete_metadata',
            hint: 'Vérifie create-checkout (metadata) et que la même clé Stripe test/live est utilisée partout.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const piRaw = session.payment_intent;
      const paymentIntentId =
        typeof piRaw === 'string'
          ? piRaw
          : piRaw && typeof piRaw === 'object' && 'id' in (piRaw as Stripe.PaymentIntent)
            ? (piRaw as Stripe.PaymentIntent).id
            : null;
      let rechargeErr = (
        await supabase.rpc('apply_wallet_recharge', {
          p_user_id: userId,
          p_amount_centimes: amountCents,
          p_stripe_session_id: session.id,
          p_stripe_payment_intent_id: paymentIntentId,
        })
      ).error;
      if (
        rechargeErr &&
        (rechargeErr.message?.includes('Could not find') ||
          rechargeErr.message?.includes('function public.apply_wallet_recharge') ||
          rechargeErr.code === 'PGRST202')
      ) {
        rechargeErr = (
          await supabase.rpc('apply_wallet_recharge', {
            p_user_id: userId,
            p_amount_centimes: amountCents,
            p_stripe_session_id: session.id,
          })
        ).error;
      }
      if (rechargeErr) {
        console.error('apply_wallet_recharge:', rechargeErr);
        return new Response(JSON.stringify({ error: rechargeErr.message }), { status: 500 });
      }
      console.log('Portefeuille crédité:', userId, amountCents, session.id);
      return new Response(JSON.stringify({ received: true, wallet: true }), {
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

  // Remboursement Stripe (Dashboard ou API) : aligner le solde portefeuille interne
  if (event.type === 'refund.created') {
    const refund = event.data.object as Stripe.Refund;
    const amountCents = refund.amount;
    const chargeRef = refund.charge;
    const chargeId =
      typeof chargeRef === 'string'
        ? chargeRef
        : chargeRef && typeof chargeRef === 'object'
          ? (chargeRef as Stripe.Charge).id
          : null;

    if (!chargeId || !amountCents) {
      return new Response(JSON.stringify({ received: true, ignored: 'refund_no_charge' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const sr = getServiceRoleKey();
    if (!sr) {
      console.error('stripe-webhook refund: service role manquante');
      return new Response(JSON.stringify({ error: 'missing_service_role' }), { status: 500 });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, sr);

    try {
      const charge = await stripe.charges.retrieve(chargeId, { expand: ['payment_intent'] });
      const piRef = charge.payment_intent;
      let paymentIntent: Stripe.PaymentIntent;

      if (typeof piRef === 'string') {
        paymentIntent = await stripe.paymentIntents.retrieve(piRef);
      } else if (piRef && typeof piRef === 'object') {
        paymentIntent = piRef as Stripe.PaymentIntent;
      } else {
        return new Response(JSON.stringify({ received: true, ignored: 'refund_no_pi' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const meta = paymentIntent.metadata || {};
      let userIdToDebit = '';
      if (String(meta.checkout_kind || '').trim() === 'wallet_recharge') {
        const u = String(meta.user_id || '').trim();
        if (u.length >= 10) userIdToDebit = u;
      }
      // Repli : beaucoup de sessions Checkout n’exposent pas checkout_kind/user_id sur le PaymentIntent
      if (!userIdToDebit) {
        const { data: wtRow } = await supabase
          .from('wallet_transactions')
          .select('user_id')
          .eq('type', 'recharge')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();
        const uid = wtRow && typeof wtRow === 'object' && 'user_id' in wtRow
          ? String((wtRow as { user_id: string }).user_id || '')
          : '';
        if (uid.length >= 10) userIdToDebit = uid;
      }
      if (!userIdToDebit) {
        return new Response(JSON.stringify({ received: true, ignored: 'refund_not_wallet' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const { error: refundErr } = await supabase.rpc('apply_wallet_stripe_refund', {
        p_user_id: userIdToDebit,
        p_amount_centimes: amountCents,
        p_stripe_refund_id: refund.id,
      });

      if (refundErr) {
        console.error('apply_wallet_stripe_refund:', refundErr);
        return new Response(JSON.stringify({ error: refundErr.message }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      console.log('Portefeuille débité (remboursement Stripe):', userIdToDebit, amountCents, refund.id);
      return new Response(JSON.stringify({ received: true, wallet_debit: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (e) {
      console.error('refund.created handler:', e);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : 'refund_handler_error' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
