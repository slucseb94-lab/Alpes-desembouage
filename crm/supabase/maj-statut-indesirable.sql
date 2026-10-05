-- =====================================================================
-- Ajoute le statut « Arnaque / robot » (indesirable) aux fiches clients
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status in ('nouveau', 'contacte', 'devis', 'client', 'perdu', 'indesirable'));
