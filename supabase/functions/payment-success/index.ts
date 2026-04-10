// Retour Stripe : redirige vers l'app mobile.
// Le navigateur Stripe n'envoie pas de JWT Supabase ; cette fonction est publique.
const APP_SUCCESS_URL = 'washproapp://payment-success?status=ok';

Deno.serve((_req) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: APP_SUCCESS_URL,
      'Cache-Control': 'no-store',
    },
  });
});
