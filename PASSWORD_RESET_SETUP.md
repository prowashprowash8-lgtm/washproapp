# Réinitialisation du mot de passe par e-mail — WashPro

L’application appelle l’**Edge Function** `request-password-reset`, qui génère un code en base (RPC réservée au `service_role`) et envoie l’e-mail via **Resend**. L’utilisateur saisit le code reçu puis un nouveau mot de passe (RPC `reset_password_with_code`, inchangée).

## 1. SQL

Dans Supabase → **SQL Editor**, exécutez **`supabase/password-reset.sql`**.

- Table `password_reset_codes`
- Fonction **`password_reset_issue_code`** : exécutable **uniquement** par `service_role` (pas par l’app en direct)
- Fonction **`reset_password_with_code`** : toujours `anon` pour l’app

## 2. Déployer l’Edge Function

```bash
supabase functions deploy request-password-reset
```

## 3. Secrets Resend (production)

1. Compte [resend.com](https://resend.com), clé API et domaine / expéditeur validés.
2. Dans Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets** :

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set RESEND_FROM="WashPro <noreply@votredomaine.com>"
```

3. Redéployez la fonction après avoir ajouté les secrets.

Comportement : le code est **uniquement dans l’e-mail**. La réponse JSON vers l’app est `{ "success": true }` **sans** champ `code`.

## 4. Développement sans Resend (optionnel)

Sans `RESEND_API_KEY`, la fonction renvoie **503** sauf si vous activez :

```bash
supabase secrets set ALLOW_DEV_RESET_CODE=true
```

Dans ce cas **uniquement** pour le dev, la réponse peut contenir `code` et `dev: true` ; l’app n’affiche le code **que** en build de développement (`__DEV__`).

**Ne jamais activer `ALLOW_DEV_RESET_CODE` en production.**

## 5. Anti-énumération

Si l’e-mail n’existe pas, l’API renvoie quand même `{ success: true }` (pas de message du type « compte introuvable »).
