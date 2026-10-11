-- =====================================================================
-- Statistiques du site (suivi « maison ») → onglet « Site web » du CRM
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================
-- Le site envoie ses visites, clics et formulaires dans la table site_events.
--   • Les visiteurs du site n'ont AUCUN accès à la table : ils peuvent seulement appeler
--     track_events() (qui vérifie et nettoie tout) et link_visitor_to_lead().
--   • Seul l'administrateur peut lire les statistiques (site_stats() et la table).
--   • Sans l'accord du visiteur (bandeau cookies), le site n'envoie AUCUN identifiant :
--     visitor_id et session_id restent vides, ce sont de simples compteurs anonymes.

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null,                       -- visit | section | click | form_start | form_submit | video_play
  label text not null default '',           -- ex. devis_hero, tel_portable, contact
  visitor_id text,                          -- renseigné seulement si le visiteur a accepté les cookies
  session_id text,
  source text not null default 'direct',    -- google, direct, facebook, utm_source…
  device text not null default 'desktop',   -- mobile | desktop
  client_id uuid references public.clients (id) on delete set null
);

create index if not exists site_events_created_idx on public.site_events (created_at);
create index if not exists site_events_visitor_idx on public.site_events (visitor_id) where visitor_id is not null;
create index if not exists site_events_client_idx on public.site_events (client_id) where client_id is not null;

alter table public.site_events enable row level security;
drop policy if exists "stats site lecture admin" on public.site_events;
create policy "stats site lecture admin" on public.site_events for select using (public.is_admin());
drop policy if exists "stats site suppression admin" on public.site_events;
create policy "stats site suppression admin" on public.site_events for delete using (public.is_admin());

-- ---------------------------------------------------------------- enregistrement depuis le site
create or replace function public.track_events(p_events jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  n integer := 0;
  v_type text;
  v_source text;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return; end if;

  -- Anti-inondation : pas plus de 5 000 événements par heure au total.
  if (select count(*) from public.site_events where created_at > now() - interval '1 hour') >= 5000 then return; end if;

  for e in select value from jsonb_array_elements(p_events) loop
    n := n + 1;
    exit when n > 25;
    v_type := coalesce(e ->> 'type', '');
    continue when v_type not in ('visit', 'section', 'click', 'form_start', 'form_submit', 'video_play');

    v_source := left(regexp_replace(lower(coalesce(e ->> 'source', 'direct')), '[^a-z0-9._-]', '', 'g'), 40);
    if v_source = '' then v_source := 'direct'; end if;

    insert into public.site_events (type, label, visitor_id, session_id, source, device)
    values (
      v_type,
      left(regexp_replace(lower(coalesce(e ->> 'label', '')), '[^a-z0-9_]', '', 'g'), 40),
      nullif(left(regexp_replace(coalesce(e ->> 'visitor', ''), '[^a-zA-Z0-9-]', '', 'g'), 40), ''),
      nullif(left(regexp_replace(coalesce(e ->> 'session', ''), '[^a-zA-Z0-9-]', '', 'g'), 40), ''),
      v_source,
      case when e ->> 'device' = 'mobile' then 'mobile' else 'desktop' end
    );
  end loop;
end $$;

revoke all on function public.track_events(jsonb) from public;
grant execute on function public.track_events(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- rattacher le parcours à la fiche prospect
-- Appelée par le site juste après l'envoi du formulaire, et seulement si le visiteur a accepté les cookies.
-- Ne fait rien si aucune demande du formulaire n'est arrivée depuis moins de 10 minutes pour ce téléphone / cet e-mail.
create or replace function public.link_visitor_to_lead(p_visitor text, p_phone text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitor text := nullif(left(regexp_replace(coalesce(p_visitor, ''), '[^a-zA-Z0-9-]', '', 'g'), 40), '');
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := left(lower(trim(coalesce(p_email, ''))), 160);
  v_client uuid;
begin
  if v_visitor is null then return; end if;

  select c.id into v_client from public.clients c
  where exists (
          select 1 from public.activities a
          where a.client_id = c.id and a.type = 'demande' and a.created_at > now() - interval '10 minutes'
        )
    and ((length(v_digits) >= 9 and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = right(v_digits, 9))
         or (v_email <> '' and lower(c.email) = v_email))
  order by c.created_at desc
  limit 1;

  if v_client is null then return; end if;

  update public.site_events
  set client_id = v_client
  where visitor_id = v_visitor and client_id is null and created_at > now() - interval '30 days';
end $$;

revoke all on function public.link_visitor_to_lead(text, text, text) from public;
grant execute on function public.link_visitor_to_lead(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------- chiffres pour le tableau de bord (admin)
create or replace function public.site_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from timestamptz := ((v_today - (v_days - 1))::timestamp) at time zone 'Europe/Paris';
  v_prev timestamptz := (((v_today - (v_days - 1) - v_days))::timestamp) at time zone 'Europe/Paris';
begin
  if not public.is_admin() then raise exception 'Accès réservé à l''administrateur'; end if;

  return jsonb_build_object(
    'days', v_days,
    'totals', (
      select jsonb_build_object(
        'visits',            count(*) filter (where type = 'visit' and created_at >= v_from),
        'visits_prev',       count(*) filter (where type = 'visit' and created_at < v_from),
        'identified',        count(*) filter (where type = 'visit' and created_at >= v_from and visitor_id is not null),
        'calls',             count(*) filter (where type = 'click' and label like 'tel%' and created_at >= v_from),
        'calls_prev',        count(*) filter (where type = 'click' and label like 'tel%' and created_at < v_from),
        'quote_clicks',      count(*) filter (where type = 'click' and label like 'devis%' and created_at >= v_from),
        'quote_clicks_prev', count(*) filter (where type = 'click' and label like 'devis%' and created_at < v_from),
        'form_starts',       count(*) filter (where type = 'form_start' and created_at >= v_from),
        'form_submits',      count(*) filter (where type = 'form_submit' and created_at >= v_from),
        'form_submits_prev', count(*) filter (where type = 'form_submit' and created_at < v_from),
        'video_plays',       count(*) filter (where type = 'video_play' and created_at >= v_from),
        'linked_leads',      count(distinct client_id) filter (where client_id is not null and created_at >= v_from)
      )
      from public.site_events where created_at >= v_prev
    ),
    'daily', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select to_char(g.day, 'YYYY-MM-DD') as day,
               count(e.id) filter (where e.type = 'visit') as visits,
               count(e.id) filter (where e.type = 'click') as clicks,
               count(e.id) filter (where e.type = 'form_submit') as forms
        from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') as g(day)
        left join public.site_events e
          on (e.created_at at time zone 'Europe/Paris')::date = g.day::date and e.created_at >= v_from
        group by g.day
      ) d
    ),
    'sections', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb) from (
        select label, count(*) as n from public.site_events
        where type = 'section' and created_at >= v_from group by label
      ) s
    ),
    'clicks', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb) from (
        select label, count(*) as n from public.site_events
        where type = 'click' and created_at >= v_from group by label
      ) s
    ),
    'sources', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb) from (
        select source as label, count(*) as n from public.site_events
        where type = 'visit' and created_at >= v_from group by source order by count(*) desc limit 8
      ) s
    ),
    'devices', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb) from (
        select device as label, count(*) as n from public.site_events
        where type = 'visit' and created_at >= v_from group by device
      ) s
    ),
    'lead_sources', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb) from (
        select source as label, count(distinct client_id) as n from public.site_events
        where type = 'visit' and client_id is not null and created_at >= v_from group by source
      ) s
    )
  );
end $$;

revoke all on function public.site_stats(integer) from public, anon;
grant execute on function public.site_stats(integer) to authenticated;

-- Conservation : pour effacer les données de plus de 25 mois (durée maximale conseillée par la CNIL), lancer à la main :
--   delete from public.site_events where created_at < now() - interval '25 months';
