-- Trouvé via l'Advisor de sécurité Supabase (2026-07-06) : la vue public.users (staff CRM :
-- id, email, first_name, role) contournait le RLS de la vraie table crm_users et était
-- accordée à anon en lecture ET écriture — n'importe qui avec la clé publique pouvait lire
-- la liste du staff, et potentiellement insérer/modifier des lignes (vue "simple",
-- automatiquement modifiable par Postgres).

-- Fait respecter le RLS de crm_users au lieu de le contourner (comportement par défaut
-- des vues avant Postgres 15 : elles s'exécutent avec les droits du créateur, pas de
-- l'appelant).
alter view public.users set (security_invoker = true);

revoke all on public.users from anon, public;
revoke insert, update, delete on public.users from authenticated;
grant select on public.users to authenticated;
