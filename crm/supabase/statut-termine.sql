-- =====================================================================
-- Nouveau statut « Client terminé » (facture payée)
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status in ('nouveau', 'contacte', 'devis', 'rdv', 'client', 'termine', 'perdu', 'indesirable'));

-- Clients déjà payés : passent directement en « Client terminé »
update public.clients c set status = 'termine'
  where c.status = 'client' and exists (select 1 from public.invoices i where i.client_id = c.id and i.status = 'payee');
