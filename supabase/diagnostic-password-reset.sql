-- À exécuter dans SQL Editor pour vérifier que la réinit mot de passe est prête
-- (ne modifie rien, lecture seule)

-- 1) Les fonctions existent ?
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('password_reset_issue_code', 'reset_password_with_code');

-- 2) service_role peut exécuter password_reset_issue_code ?
SELECT has_function_privilege('service_role', 'public.password_reset_issue_code(text)', 'execute')
  AS service_role_can_call_issue_code;

-- 3) anon peut exécuter reset_password_with_code ?
SELECT has_function_privilege('anon', 'public.reset_password_with_code(text, text, text)', 'execute')
  AS anon_can_call_reset;

-- 4) Table des codes
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'password_reset_codes'
) AS password_reset_codes_exists;
