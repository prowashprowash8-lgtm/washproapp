# Configuration Stripe pour WashPro

## 1. Créer un compte Stripe

1. Allez sur [stripe.com](https://stripe.com) et créez un compte
2. Récupérez vos clés : Dashboard → Developers → API keys
   - **Secret key** (sk_test_... ou sk_live_...)
   - Pour les webhooks : **Signing secret** (whsec_...)

## 2. Déployer les Edge Functions Supabase

```bash
# Installer Supabase CLI si besoin
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref ftechtqyocgdabfkmclm

# Définir les secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Déployer les fonctions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy payment-success
```

## 3. Configurer le webhook Stripe

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL : `https://ftechtqyocgdabfkmclm.supabase.co/functions/v1/stripe-webhook`
3. Événements à écouter : `checkout.session.completed`
4. Copiez le **Signing secret** et mettez-le dans les secrets Supabase

## 4. Flux de paiement

1. L'utilisateur sélectionne une machine et clique sur **Payé**
2. L'app appelle `create-checkout` → ouvre Stripe Checkout
3. L'utilisateur paie par carte
4. Stripe envoie `checkout.session.completed` au webhook
5. Le webhook insère dans `machine_commands` → l'ESP32 active le relais

## 5. Test en mode test

Utilisez les cartes de test Stripe :
- **Succès** : 4242 4242 4242 4242
- **Refus** : 4000 0000 0000 0002
- Date : toute date future
- CVC : 3 chiffres
