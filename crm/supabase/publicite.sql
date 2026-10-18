-- =====================================================================
-- Publicité : dépenses Google Ads (script automatique) / Facebook, et origine des prospects
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================

-- ---------------------------------------------------------------- statistiques publicitaires par jour
create table if not exists public.ad_stats (
  day date not null,
  platform text not null check (platform in ('google', 'facebook')),
  campaign text not null default '',
  clicks integer not null default 0,
  impressions integer not null default 0,
  cost numeric(10, 2) not null default 0,
  conversions numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, platform, campaign)
);
alter table public.ad_stats enable row level security;
drop policy if exists "pub gérant" on public.ad_stats;
create policy "pub gérant" on public.ad_stats for all using (public.is_admin()) with check (public.is_admin());

-- Réception des chiffres envoyés chaque nuit par le script Google Ads (protégé par une clé secrète,
-- générée dans le CRM : Réglages → Publicité).
create or replace function public.ads_upsert(p_secret text, p_platform text, p_rows jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  r jsonb;
  n integer := 0;
begin
  select value ->> 'secret' into v_secret from public.settings where key = 'ads';
  if coalesce(v_secret, '') = '' or p_secret is distinct from v_secret then raise exception 'Clé incorrecte'; end if;
  if p_platform not in ('google', 'facebook') then raise exception 'Plateforme inconnue'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'Données invalides'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.ad_stats (day, platform, campaign, clicks, impressions, cost, conversions, updated_at)
    values ((r ->> 'day')::date, p_platform, left(coalesce(r ->> 'campaign', ''), 200),
            coalesce((r ->> 'clicks')::integer, 0), coalesce((r ->> 'impressions')::integer, 0),
            coalesce((r ->> 'cost')::numeric, 0), coalesce((r ->> 'conversions')::numeric, 0), now())
    on conflict (day, platform, campaign) do update set
      clicks = excluded.clicks, impressions = excluded.impressions, cost = excluded.cost,
      conversions = excluded.conversions, updated_at = now();
    n := n + 1;
  end loop;
  return json_build_object('ok', true, 'rows', n);
end $$;

revoke all on function public.ads_upsert(text, text, jsonb) from public;
grant execute on function public.ads_upsert(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- origine des prospects
-- « google-ads », « google » (recherche gratuite), « facebook », « direct »… (déterminée par le site)
alter table public.clients add column if not exists acquisition text default '';

drop function if exists public.submit_lead(text, text, text, text, text, text, text);

create or replace function public.submit_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_city text default '',
  p_message text default '',
  p_honeypot text default '',
  p_source text default 'Site internet',
  p_channel text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_email text := left(lower(trim(coalesce(p_email, ''))), 160);
  v_phone text := left(trim(coalesce(p_phone, '')), 40);
  v_city text := left(trim(coalesce(p_city, '')), 120);
  v_message text := left(trim(coalesce(p_message, '')), 3000);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_source text := case when p_source in ('Site internet', 'Facebook / Instagram (publicité)') then p_source else 'Site internet' end;
  v_channel text := left(regexp_replace(lower(coalesce(p_channel, '')), '[^a-z0-9.-]', '', 'g'), 40);
  v_postal text;
  v_client_id uuid;
  v_topic text;
begin
  if coalesce(p_honeypot, '') <> '' then return; end if;

  if length(v_name) < 2 or (length(v_digits) < 9 and v_email = '') then
    raise exception 'Nom et téléphone (ou e-mail) obligatoires';
  end if;

  if (select count(*) from public.clients where source = v_source and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Trop de demandes, réessayez plus tard';
  end if;

  if v_source <> 'Site internet' and v_channel = '' then v_channel := 'facebook-ads'; end if;

  v_postal := substring(v_city from '\m(\d{4,5})\M');
  if v_postal is not null then
    v_city := trim(regexp_replace(v_city, '\m' || v_postal || '\M', ''));
  end if;

  select id into v_client_id from public.clients
  where (length(v_digits) >= 9 and right(regexp_replace(phone, '\D', '', 'g'), 9) = right(v_digits, 9))
     or (v_email <> '' and lower(email) = v_email)
  order by created_at desc
  limit 1;

  if v_client_id is null then
    insert into public.clients (name, email, phone, city, postal_code, country, source, acquisition, status, notes, created_by)
    values (v_name, v_email, v_phone, v_city, coalesce(v_postal, ''),
            case when v_postal ~ '^\d{4}$' then 'CH' else 'FR' end,
            v_source, v_channel, 'nouveau', v_message, null)
    returning id into v_client_id;
  else
    update public.clients set status = 'nouveau' where id = v_client_id and status = 'perdu';
    update public.clients set acquisition = v_channel where id = v_client_id and coalesce(acquisition, '') = '' and v_channel <> '';
  end if;

  insert into public.activities (client_id, user_id, type, content)
  values (v_client_id, null, 'demande',
          'Demande via ' || case when v_source = 'Site internet' then 'le formulaire du site' else 'une publicité Facebook / Instagram' end ||
          case when v_channel = 'google-ads' then ' (venu d''une publicité Google Ads)' else '' end ||
          case when v_message <> '' then E' :\n' || v_message else '' end);

  select value ->> 'ntfy_topic' into v_topic from public.settings where key = 'notify';
  if coalesce(v_topic, '') <> '' then
    begin
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object(
          'topic', v_topic,
          'title', case when v_source <> 'Site internet' then 'Nouveau prospect Facebook / Instagram'
                        when v_channel = 'google-ads' then 'Nouveau prospect Google Ads'
                        else 'Nouveau prospect via le site' end,
          'message', 'Demande de contact' || case when v_city <> '' then ' — ' || v_city else '' end || '. Rappelez vite !',
          'tags', jsonb_build_array('bell'),
          'priority', 4,
          'click', 'https://www.alpes-desembouage.fr/crm/#/clients/' || v_client_id
        )
      );
    exception when others then null;
    end;
  end if;
end $$;

revoke all on function public.submit_lead(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, text) to anon, authenticated;
