-- =====================================================================
-- Nombre de boucles de plancher chauffant sur la fiche client
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================
alter table public.clients add column if not exists loops_count integer;
