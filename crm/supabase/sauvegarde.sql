-- =====================================================================
-- Sauvegarde hebdomadaire du CRM (copie complète vers le Google Drive du gérant)
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Coffre privé : aucune règle d'accès, donc lisible uniquement par les fonctions ci-dessous.
create table if not exists public.private_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.private_settings enable row level security;

-- Le gérant enregistre la clé de sauvegarde (générée dans le CRM, recopiée dans le script Google).
create or replace function public.set_backup_secret(p_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé au gérant'; end if;
  if length(coalesce(p_secret, '')) < 32 then raise exception 'Clé trop courte'; end if;
  insert into public.private_settings (key, value, updated_at) values ('backup_secret', p_secret, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- Date de la dernière sauvegarde (affichée dans le CRM)
create or replace function public.backup_status()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'has_secret', exists (select 1 from public.private_settings where key = 'backup_secret'),
    'last_backup', (select value from public.private_settings where key = 'last_backup')
  ) end;
$$;

-- Export complet, appelé chaque semaine par le script Google (protégé par la clé)
create or replace function public.backup_export(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_out json;
begin
  select value into v_secret from public.private_settings where key = 'backup_secret';
  if coalesce(v_secret, '') = '' or p_secret is distinct from v_secret then raise exception 'Clé incorrecte'; end if;

  select json_build_object(
    'exported_at', now(),
    'version', 1,
    'profiles', (select coalesce(json_agg(t), '[]') from public.profiles t),
    'clients', (select coalesce(json_agg(t), '[]') from public.clients t),
    'activities', (select coalesce(json_agg(t), '[]') from public.activities t),
    'quotes', (select coalesce(json_agg(t), '[]') from public.quotes t),
    'appointments', (select coalesce(json_agg(t), '[]') from public.appointments t),
    'payments', (select coalesce(json_agg(t), '[]') from public.payments t),
    'invoices', (select coalesce(json_agg(t), '[]') from public.invoices t),
    'ad_stats', (select coalesce(json_agg(t), '[]') from public.ad_stats t),
    'settings', (select coalesce(json_agg(t), '[]') from public.settings t),
    'counters', (select coalesce(json_agg(t), '[]') from public.counters t)
  ) into v_out;

  insert into public.private_settings (key, value, updated_at) values ('last_backup', now()::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return v_out;
end $$;

revoke all on function public.set_backup_secret(text) from public;
revoke all on function public.backup_status() from public;
revoke all on function public.backup_export(text) from public;
grant execute on function public.set_backup_secret(text) to authenticated;
grant execute on function public.backup_status() to authenticated;
grant execute on function public.backup_export(text) to anon, authenticated;
