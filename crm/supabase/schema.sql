-- =====================================================================
-- CRM Alpes Désembouage — schéma de base de données Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------- profils (utilisateurs)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'technicien' check (role in ('admin', 'technicien')),
  phone text default '',
  color text default '#1c74c4',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Chaque nouvel utilisateur reçoit un profil. Le tout premier compte créé devient administrateur.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'technicien' else 'admin' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- clients / prospects
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) default auth.uid(),
  type text not null default 'particulier',
  name text not null,
  company text default '',
  phone text default '',
  email text default '',
  address text default '',
  postal_code text default '',
  city text default '',
  country text not null default 'FR',
  source text default '',
  status text not null default 'nouveau' check (status in ('nouveau', 'contacte', 'devis', 'client', 'perdu', 'indesirable')),
  assigned_to uuid references public.profiles (id) on delete set null,
  heating_type text default '',
  boiler_brand text default '',
  emitter_type text default '',
  radiators_count integer,
  last_service_date date,
  service_interval_months integer default 36,
  notes text default ''
);

-- ---------------------------------------------------------------- rendez-vous
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  technician_id uuid references public.profiles (id) on delete set null,
  type text not null default 'visite',
  start_at timestamptz not null,
  duration_min integer not null default 60,
  status text not null default 'planifie' check (status in ('planifie', 'confirme', 'en_route', 'en_cours', 'termine', 'annule')),
  notes text default '',
  report text default '',
  amount_due numeric(10, 2)
);

-- ---------------------------------------------------------------- devis (suivi, les devis restent faits dans Tolteck)
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  reference text default '',
  amount numeric(10, 2),
  sent_date date,
  status text not null default 'envoye' check (status in ('envoye', 'accepte', 'refuse')),
  notes text default ''
);

-- ---------------------------------------------------------------- historique (appels, SMS, notes…)
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null default auth.uid(),
  type text not null default 'note',
  content text not null default ''
);

-- ---------------------------------------------------------------- réglages (modèles de SMS…)
create table public.settings (
  key text primary key,
  value jsonb
);

create index on public.appointments (start_at);
create index on public.appointments (technician_id);
create index on public.activities (client_id);
create index on public.quotes (client_id);

-- =====================================================================
-- Règles d'accès (Row Level Security)
--   • admin      : voit et modifie tout
--   • technicien : voit uniquement ses rendez-vous et les clients concernés,
--                  ne voit jamais les devis ni les montants
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.can_see_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_active_user() and exists (
    select 1 from public.clients c
    where c.id = cid and (
      c.assigned_to = auth.uid() or c.created_by = auth.uid()
      or exists (select 1 from public.appointments a where a.client_id = c.id and a.technician_id = auth.uid())
    )
  ));
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.quotes enable row level security;
alter table public.activities enable row level security;
alter table public.settings enable row level security;

-- profils
create policy "profils lisibles par l'équipe" on public.profiles for select using (public.is_active_user());
create policy "profils modifiables par l'admin" on public.profiles for update using (public.is_admin());

-- clients
create policy "clients lecture" on public.clients for select using (public.can_see_client(id));
create policy "clients création" on public.clients for insert with check (public.is_active_user() and created_by = auth.uid());
create policy "clients modification" on public.clients for update using (public.can_see_client(id));
create policy "clients suppression" on public.clients for delete using (public.is_admin());

-- rendez-vous
create policy "rdv lecture" on public.appointments for select using (public.is_admin() or technician_id = auth.uid());
create policy "rdv création" on public.appointments for insert with check (public.is_admin());
create policy "rdv modification" on public.appointments for update using (public.is_admin() or technician_id = auth.uid());
create policy "rdv suppression" on public.appointments for delete using (public.is_admin());

-- devis : admin uniquement
create policy "devis admin" on public.quotes for all using (public.is_admin()) with check (public.is_admin());

-- historique
create policy "historique lecture" on public.activities for select using (public.can_see_client(client_id));
create policy "historique création" on public.activities for insert with check (public.can_see_client(client_id) and user_id = auth.uid());
create policy "historique suppression" on public.activities for delete using (public.is_admin() or user_id = auth.uid());

-- réglages
create policy "réglages lecture" on public.settings for select using (public.is_active_user());
create policy "réglages écriture" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Paiements (carte via Stripe, virement, chèque, espèces)
-- =====================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  description text not null default '',
  reference text default '',
  method text not null default 'carte' check (method in ('carte', 'virement', 'cheque', 'especes')),
  status text not null default 'en_attente' check (status in ('en_attente', 'paye', 'annule')),
  paid_at timestamptz,
  checkout_url text,
  stripe_session_id text
);
create index on public.payments (client_id);

alter table public.payments enable row level security;

-- Le gérant voit tout ; un technicien voit les encaissements qu'il a créés ou liés à ses rendez-vous.
create policy "paiements lecture" on public.payments for select using (
  public.is_admin() or (public.is_active_user() and (
    created_by = auth.uid()
    or exists (select 1 from public.appointments a where a.id = appointment_id and a.technician_id = auth.uid())
  ))
);
create policy "paiements création" on public.payments for insert with check (
  public.can_see_client(client_id) and created_by = auth.uid() and status = 'en_attente'
);
-- Seul le gérant change un statut à la main (chèque / virement reçu). Les paiements par carte
-- sont validés automatiquement par la fonction « stripe-webhook » (clé serveur, hors de ces règles).
create policy "paiements modification" on public.payments for update using (public.is_admin());
create policy "paiements suppression" on public.payments for delete using (public.is_admin());


-- Formulaire de contact du site → nouveau prospect dans le CRM
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================
-- Les visiteurs du site n'ont AUCUN accès aux tables : ils peuvent seulement appeler
-- cette fonction, qui vérifie les données puis crée la fiche.

create or replace function public.submit_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_city text default '',
  p_message text default '',
  p_honeypot text default ''
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
  v_postal text;
  v_client_id uuid;
begin
  -- Robot détecté (champ invisible rempli) : on ne fait rien, sans le signaler.
  if coalesce(p_honeypot, '') <> '' then return; end if;

  if length(v_name) < 2 or length(v_digits) < 9 then
    raise exception 'Nom et téléphone obligatoires';
  end if;

  -- Anti-inondation : pas plus de 30 demandes par heure au total.
  if (select count(*) from public.clients where source = 'Site internet' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de demandes, réessayez plus tard';
  end if;

  -- Code postal saisi dans le champ ville (ex. « 74000 Annecy »).
  v_postal := substring(v_city from '\m(\d{4,5})\M');
  if v_postal is not null then
    v_city := trim(regexp_replace(v_city, '\m' || v_postal || '\M', ''));
  end if;

  -- Déjà connu (même téléphone ou même e-mail) : on ajoute la demande à sa fiche au lieu d'en créer une nouvelle.
  select id into v_client_id from public.clients
  where (length(v_digits) >= 9 and right(regexp_replace(phone, '\D', '', 'g'), 9) = right(v_digits, 9))
     or (v_email <> '' and lower(email) = v_email)
  order by created_at desc
  limit 1;

  if v_client_id is null then
    insert into public.clients (name, email, phone, city, postal_code, country, source, status, notes, created_by)
    values (v_name, v_email, v_phone, v_city, coalesce(v_postal, ''),
            case when v_postal ~ '^\d{4}$' then 'CH' else 'FR' end,
            'Site internet', 'nouveau', v_message, null)
    returning id into v_client_id;
  else
    -- Un ancien prospect perdu qui revient redevient un nouveau prospect.
    update public.clients set status = 'nouveau' where id = v_client_id and status = 'perdu';
  end if;

  insert into public.activities (client_id, user_id, type, content)
  values (v_client_id, null, 'email',
          'Demande via le formulaire du site' || case when v_message <> '' then E' :\n' || v_message else '' end);
end $$;

revoke all on function public.submit_lead(text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text) to anon, authenticated;


-- Signature électronique des devis
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================
-- Principe : le gérant dépose le PDF du devis (fait dans Tolteck) et envoie un lien secret au client.
-- Le client n'a accès qu'à CE devis, via le lien, tant qu'il est en signature. Il ne voit rien d'autre.

-- ---------------------------------------------------------------- colonnes des devis
alter table public.quotes
  add column if not exists pdf_path text,
  add column if not exists doc_hash text,
  add column if not exists sign_token uuid unique,
  add column if not exists sign_status text not null default 'aucune',
  add column if not exists sign_sent_at timestamptz,
  add column if not exists sign_expires_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signer_name text,
  add column if not exists signature_image text,
  add column if not exists signer_ip text,
  add column if not exists signer_user_agent text;

alter table public.quotes drop constraint if exists quotes_sign_status_check;
alter table public.quotes add constraint quotes_sign_status_check check (sign_status in ('aucune', 'envoye', 'signe'));

-- ---------------------------------------------------------------- stockage des PDF (privé)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('devis', 'devis', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Un fichier est lisible par lien uniquement s'il appartient à un devis envoyé en signature (ou signé).
create or replace function public.quote_file_shared(object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.quotes q
    where q.pdf_path = object_name and q.sign_status in ('envoye', 'signe')
  );
$$;

drop policy if exists "devis gérant" on storage.objects;
create policy "devis gérant" on storage.objects for all to authenticated
  using (bucket_id = 'devis' and public.is_admin())
  with check (bucket_id = 'devis' and public.is_admin());

drop policy if exists "devis lecture par lien de signature" on storage.objects;
create policy "devis lecture par lien de signature" on storage.objects for select to anon, authenticated
  using (bucket_id = 'devis' and public.quote_file_shared(name));

-- ---------------------------------------------------------------- page de signature : lecture
create or replace function public.get_signing_info(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reference', q.reference,
    'amount', q.amount,
    'pdf_path', q.pdf_path,
    'doc_hash', q.doc_hash,
    'status', q.sign_status,
    'expired', coalesce(q.sign_expires_at < now(), false),
    'client_name', c.name,
    'company', (select value from public.settings where key = 'company'),
    'signed_at', q.signed_at,
    'signer_name', q.signer_name,
    'signer_ip', q.signer_ip,
    'signer_user_agent', q.signer_user_agent,
    'signature_image', case when q.sign_status = 'signe' then q.signature_image end
  )
  from public.quotes q
  join public.clients c on c.id = q.client_id
  where q.sign_token = p_token and q.sign_status in ('envoye', 'signe');
$$;

-- ---------------------------------------------------------------- page de signature : signer
create or replace function public.sign_quote(
  p_token uuid,
  p_name text,
  p_signature text,
  p_doc_hash text,
  p_consent boolean
)
returns json language plpgsql security definer set search_path = public as $$
declare
  q public.quotes%rowtype;
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_ip text := left(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), 64);
begin
  select * into q from public.quotes where sign_token = p_token for update;
  if not found or q.sign_status <> 'envoye' then raise exception 'Lien de signature invalide ou devis déjà signé'; end if;
  if q.sign_expires_at < now() then raise exception 'Ce lien de signature a expiré'; end if;
  if not coalesce(p_consent, false) then raise exception 'Veuillez cocher « Bon pour accord »'; end if;
  if length(v_name) < 2 then raise exception 'Veuillez indiquer votre nom'; end if;
  if coalesce(p_signature, '') !~ '^data:image/png;base64,' or length(p_signature) > 400000 then raise exception 'Signature invalide'; end if;
  if p_doc_hash is distinct from q.doc_hash then raise exception 'Le devis a été modifié entre-temps : rechargez la page'; end if;

  update public.quotes set
    sign_status = 'signe', signed_at = now(), signer_name = v_name, signature_image = p_signature,
    signer_ip = v_ip, signer_user_agent = left(coalesce(h ->> 'user-agent', ''), 300), status = 'accepte'
  where id = q.id;

  update public.clients set status = 'client' where id = q.client_id and status <> 'client';

  insert into public.activities (client_id, user_id, type, content)
  values (q.client_id, null, 'statut',
          'Devis ' || coalesce(nullif(q.reference, ''), '') || ' signé électroniquement par ' || v_name || ' — statut : Client');

  return json_build_object('signed_at', now(), 'signer_ip', v_ip);
end $$;

revoke all on function public.get_signing_info(uuid) from public;
revoke all on function public.sign_quote(uuid, text, text, text, boolean) from public;
grant execute on function public.get_signing_info(uuid) to anon, authenticated;
grant execute on function public.sign_quote(uuid, text, text, text, boolean) to anon, authenticated;
