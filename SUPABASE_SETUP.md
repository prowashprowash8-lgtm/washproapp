# Configuration Supabase pour WashPro

## 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte
2. Créez un nouveau projet
3. Notez l’URL du projet et la clé `anon` (Settings → API)

## 2. Configurer les variables d'environnement

Copiez le fichier d'exemple et renseignez vos identifiants :

```bash
cp .env.example .env
```

Éditez `.env` avec vos valeurs :

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Table profiles (authentification sans Supabase Auth)

**L'authentification se fait uniquement via la table `profiles`** — pas de Supabase Auth, pas de confirmation email.

Exécutez le fichier **`supabase/profiles-auth.sql`** dans **Supabase** → **SQL Editor** (copiez tout le contenu du fichier).

Le fichier crée :
- La table `profiles` (id, email, password_hash, first_name, last_name, created_at)
- Les fonctions `sign_up` et `sign_in` pour l'inscription et la connexion

**Quand un utilisateur s'inscrit** : il est automatiquement enregistré dans la table `profiles`.

**Pour voir tous les utilisateurs** : Supabase Dashboard → **Table Editor** → **profiles**.

Si vous avez déjà une table profiles : exécutez **`supabase/profiles-ensure.sql`** à la place.

**Réinitialisation du mot de passe** : exécutez **`supabase/password-reset.sql`**. Le code à 6 chiffres s'affiche à l'écran après la demande (aucune config email nécessaire).

## 4. Tables emplacements et machines (laveries)

Si vous avez déjà la table `emplacement`, assurez-vous qu’elle contient au moins une colonne `nom` (ou `name`) pour le nom de la laverie.

Si les tables n’existent pas, exécutez **`supabase/emplacement-machines.sql`** dans le SQL Editor. Cela crée :
- `machines` : id, emplacement_id, name, type, statut, price, price_per_hour
- `emplacements.esp32_id` : ID de l'ESP32 (ex: WASH_PRO_001) pour les commandes relais

Exécutez aussi **`supabase/machine-commands.sql`** pour la table des commandes ESP32.

Pour les codes promo : exécutez **`supabase/promo-codes.sql`**, puis insérez des codes :
```sql
insert into promo_codes (code, uses_remaining) values ('GRATUIT', 100);
```

## 5. Suivi des transactions par utilisateur

Exécutez **`supabase/transactions.sql`** dans le SQL Editor. Cela crée :
- La table `transactions` : chaque paiement/démarrage machine est enregistré avec l'utilisateur
- Des colonnes `user_id` et `transaction_id` dans `machine_commands` pour tracer qui a démarré quoi
- Une RPC `create_transaction_and_start_machine` : enregistre la transaction et envoie la commande ESP32
- Une RPC `refund_transaction` : pour rembourser une transaction (depuis le dashboard Supabase)

**Voir l'activité des utilisateurs** : Supabase Dashboard → Table Editor → `transactions`.

**Rembourser** : exécuter dans le SQL Editor :
```sql
select refund_transaction('uuid-de-la-transaction', 'Erreur machine');
```

## 6. Paiement Stripe (optionnel)

Voir **`STRIPE_SETUP.md`** pour configurer les paiements via Stripe.

## 7. Lancer l'app

```bash
npx expo start --web
```

Sans fichier `.env` configuré, l’écran "Configuration requise" s’affichera.
