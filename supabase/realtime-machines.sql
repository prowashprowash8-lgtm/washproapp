-- WashPro : permettre à l’app de recevoir les changements sur machines en direct (optocoupleur / RPC).
-- Dashboard Supabase → SQL Editor, une fois. Si la table est déjà dans la publication, erreur bénigne à ignorer.

alter publication supabase_realtime add table public.machines;
