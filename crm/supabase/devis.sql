-- =====================================================================
-- Création des devis dans le CRM (lignes, totaux, brouillons, numérotation automatique)
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================

alter table public.quotes
  add column if not exists title text default '',
  add column if not exists lines jsonb,
  add column if not exists project_address text default '',
  add column if not exists issue_date date,
  add column if not exists valid_until date,
  add column if not exists total_ht numeric(10, 2),
  add column if not exists total_tva numeric(10, 2);

alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check check (status in ('brouillon', 'envoye', 'accepte', 'refuse'));

-- ---------------------------------------------------------------- numérotation : DEV-AAAA/MM-0241, 0242…
create table if not exists public.counters (
  key text primary key,
  value integer not null
);
alter table public.counters enable row level security; -- aucun accès direct : uniquement via les fonctions ci-dessous

-- Dernier numéro utilisé dans Tolteck : DEV-2026/10-0240 → le CRM continue à 0241.
insert into public.counters (key, value) values ('devis', 240) on conflict (key) do nothing;

create or replace function public.next_quote_reference()
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Réservé au gérant'; end if;
  update public.counters set value = value + 1 where key = 'devis' returning value into n;
  return 'DEV-' || to_char(now() at time zone 'Europe/Paris', 'YYYY/MM') || '-' || lpad(n::text, 4, '0');
end $$;

-- Lire / corriger le compteur depuis les Réglages du CRM (gérant uniquement).
create or replace function public.get_quote_counter()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select value from public.counters where key = 'devis') end;
$$;

create or replace function public.set_quote_counter(p_value integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé au gérant'; end if;
  if p_value < 0 then raise exception 'Numéro invalide'; end if;
  update public.counters set value = p_value where key = 'devis';
end $$;

revoke all on function public.next_quote_reference() from public;
revoke all on function public.get_quote_counter() from public;
revoke all on function public.set_quote_counter(integer) from public;
grant execute on function public.next_quote_reference() to authenticated;
grant execute on function public.get_quote_counter() to authenticated;
grant execute on function public.set_quote_counter(integer) to authenticated;
