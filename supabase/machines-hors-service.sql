alter table public.machines
  add column if not exists hors_service boolean not null default false;

comment on column public.machines.hors_service is
  'Machine visible dans l''app mais bloquee pour paiement/demarrage quand true.';
