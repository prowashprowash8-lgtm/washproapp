# Diagnostic Supabase – WashPro

## ✅ Ce qui semble OK

- **Connexion** : Le dashboard Supabase est accessible
- **Tables présentes** : profiles, emplacements, machines, promo_codes, password_reset_codes, etc.
- **Variables d'environnement** : EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans `.env`

---

## ⚠️ Problème identifié : table `promo_codes`

**Votre schéma actuel** (d’après la capture) :
- `id`, `code`, `type`, `value`, `max_uses`

**Schéma attendu par l’app** (voir `supabase/promo-codes.sql`) :
- `id`, `code`, `uses_remaining`, `created_at`

L’app utilise la fonction RPC `use_promo_code` qui lit la colonne `uses_remaining`.  
Si cette colonne n’existe pas, les codes promo ne fonctionneront pas.

### Correction

Dans Supabase → **SQL Editor**, exécutez :

```sql
-- Si votre table a un schéma différent, migrer vers le schéma attendu
-- Option 1 : Ajouter uses_remaining et migrer les données
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS uses_remaining integer;
UPDATE promo_codes SET uses_remaining = COALESCE(max_uses, 100) WHERE uses_remaining IS NULL;
-- Puis recréer la fonction use_promo_code (voir supabase/promo-codes.sql)
```

**Ou** recréer la table avec le bon schéma (⚠️ perte des données existantes) :

```sql
DROP TABLE IF EXISTS promo_codes CASCADE;
-- Puis exécuter tout le contenu de supabase/promo-codes.sql
```

---

## Tables marquées "UNRESTRICTED"

Les tables `laveries`, `machines`, `machine_commands` sont sans RLS (Row Level Security).

- **Si les données sont publiques** (ex. liste des laveries) : c’est acceptable.
- **Si elles contiennent des infos sensibles** : activez RLS et définissez des politiques.

---

## Checklist de vérification

| Élément | Vérification |
|--------|----------------|
| **Connexion / Inscription** | Tester création de compte et connexion |
| **RPC sign_in / sign_up** | Supabase → Database → Functions → `sign_in`, `sign_up` existent |
| **RPC use_promo_code** | Database → Functions → `use_promo_code` existe |
| **RPC request_password_reset** | Database → Functions → `request_password_reset` existe |
| **Table emplacements** | Doit avoir une colonne `name` (pour la recherche) |
| **Table profiles** | Doit avoir `email`, `password_hash`, `first_name`, `last_name` |

---

## Tests rapides

1. **Auth** : Inscription → Connexion → Déconnexion
2. **Mot de passe oublié** : Demander un code → Vérifier qu’il apparaît (ou dans `password_reset_codes`)
3. **Codes promo** : Après correction du schéma, tester avec le code `LAVAGE` ou `GRATUIT`
