-- WashPro : à coller dans Supabase → SQL → New query → Run
-- Compare ce résultat avec ton firmware (ESP32_ID et MACHINE_RELAY_ID dans washpro-esp32.ino).

select
  e.id as emplacement_id,
  e.name as nom_emplacement,
  e.esp32_id as esp32_dans_la_base,
  m.id as machine_id,
  m.name as nom_machine,
  m.relay_id as relais_dans_la_base,
  m.statut,
  m.estimated_end_time
from public.emplacements e
left join public.machines m on m.emplacement_id = e.id
order by e.name, m.name;
