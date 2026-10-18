-- =====================================================================
-- Synchronisation des rendez-vous avec le calendrier Google / iPhone
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================
alter table public.appointments
  add column if not exists gcal_event_id text,
  add column if not exists gcal_synced_at timestamptz;
