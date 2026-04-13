// Edge Function : crée une session Stripe Checkout
// Déployer : supabase functions deploy create-checkout
// Secrets : STRIPE_SECRET_KEY
//
// Appel REST direct (fetch) — le SDK Stripe en Deno provoque souvent
// « An error occurred with our connection to Stripe » (client HTTP incompatible).

const STRIPE_CHECKOUT_SESSIONS = 'https://api.stripe.com/v1/checkout/sessions';
// Ne pas envoyer Stripe-Version : une date invalide provoque « Invalid Stripe API version ».
// Stripe utilise alors la version par défaut du compte (Dashboard → Développeurs → version API).

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

/**
 * Clé secrète Stripe : sk_… (standard) ou rk_… (restreinte). Jamais pk_… (publique).
 * Nettoie guillemets, espaces, caractères invisibles souvent copiés depuis le navigateur.
 */
function normalizeStripeSecret(raw: string): string {
  let key = raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, '').trim();
  }
  key = key.replace(/\s+/g, '');
  return key;
}

function getStripeSecretKey(): string {
  const raw = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const key = normalizeStripeSecret(raw);

  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY est vide. Dans Supabase → Edge Functions → Secrets, crée un secret nommé exactement STRIPE_SECRET_KEY, colle la clé sk_… depuis Stripe, enregistre, puis : supabase functions deploy create-checkout'
    );
  }

  if (key.startsWith('pk_')) {
    throw new Error(
      'Tu as collé la clé PUBLIQUE (pk_). Il faut la clé SECRÈTE : même page Stripe, ligne « Clé secrète », Révéler, copier sk_live_… ou sk_test_…'
    );
  }

  const ok = key.startsWith('sk_') || key.startsWith('rk_');
  if (!ok) {
    const hint = key.length >= 4 ? ` (reçu : commence par « ${key.slice(0, 4)}… »)` : '';
    throw new Error(
      `Clé Stripe : format incorrect${hint}. Il faut sk_ ou rk_ (Stripe → Développeurs → Clés API → clé secrète uniquement). Vérifie qu’aucun espace ni guillemet n’est resté.`
    );
  }

  return key;
}

/** Stripe Checkout exige des URLs https ; washproapp:// est remplacé. */
function safeCancelUrl(cancelUrl: string | undefined, fallbackHttps: string) {
  const u = (cancelUrl || '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  return fallbackHttps;
}

/** Création de session via API REST (x-www-form-urlencoded). */
async function createCheckoutSessionFetch(params: {
  amountCents: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<string> {
  const key = getStripeSecretKey();
  const form = new URLSearchParams();
  form.append('mode', 'payment');
  form.append('payment_method_types[0]', 'card');
  form.append('line_items[0][price_data][currency]', 'eur');
  form.append('line_items[0][price_data][unit_amount]', String(params.amountCents));
  form.append('line_items[0][price_data][product_data][name]', params.productName);
  form.append('line_items[0][quantity]', '1');
  form.append('success_url', params.successUrl);
  form.append('cancel_url', params.cancelUrl);
  for (const [k, v] of Object.entries(params.metadata)) {
    form.append(`metadata[${k}]`, String(v ?? ''));
    // Sans cela, le PaymentIntent n’a souvent pas les clés → refund.created ignorait les remboursements portefeuille
    form.append(`payment_intent_data[metadata][${k}]`, String(v ?? ''));
  }

  const res = await fetch(STRIPE_CHECKOUT_SESSIONS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const json = (await res.json()) as { url?: string; error?: { message?: string; type?: string } };

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!json.url) {
    throw new Error('Réponse Stripe sans URL de checkout');
  }
  return json.url;
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
      return jsonResponse({ error: 'Corps JSON invalide' });
    }

    const {
      amount,
      machineName,
      esp32_id,
      user_id,
      machine_id,
      emplacement_id,
      success_url,
      cancel_url,
      checkout_kind,
    } = body as {
      amount?: number;
      machineName?: string;
      esp32_id?: string;
      user_id?: string;
      machine_id?: string;
      emplacement_id?: string;
      success_url?: string;
      cancel_url?: string;
      checkout_kind?: string;
    };

    const supabaseOrigin = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    const defaultHttps = supabaseOrigin
      ? `${supabaseOrigin}/functions/v1/payment-success`
      : 'https://washproapp.com/success';

    const amountCents = Math.round(Number(amount) * 100) || 100;
    const isWallet = String(checkout_kind || '').trim() === 'wallet_recharge';
    const uid = String(user_id || '').trim();
    if (isWallet && uid.length < 10) {
      return jsonResponse({ error: 'user_id requis pour la recharge portefeuille' }, 400);
    }

    const productName = isWallet
      ? 'Recharge portefeuille WashPro'
      : machineName || 'Machine laverie';
    // IMPORTANT: on force le retour sur l'URL serveur du projet courant pour
    // éviter les erreurs liées à un .env client obsolète/caché.
    const successUrl = defaultHttps;
    const cancelUrl = safeCancelUrl(cancel_url ? String(cancel_url) : undefined, defaultHttps);

    const metadata: Record<string, string> = isWallet
      ? {
          checkout_kind: 'wallet_recharge',
          user_id: uid,
          esp32_id: '',
          machine_id: '',
          emplacement_id: '',
        }
      : {
          checkout_kind: '',
          esp32_id: String(esp32_id || ''),
          user_id: uid,
          machine_id: String(machine_id || ''),
          emplacement_id: String(emplacement_id || ''),
        };

    const url = await createCheckoutSessionFetch({
      amountCents,
      productName,
      successUrl,
      cancelUrl,
      metadata,
    });

    return jsonResponse({ url });
  } catch (err) {
    console.error(err);
    const msg =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
        ? (err as Error).message
        : 'Erreur Stripe';
    return jsonResponse({ error: msg });
  }
});
