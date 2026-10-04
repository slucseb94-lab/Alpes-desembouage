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
  status text not null default 'nouveau' check (status in ('nouveau', 'contacte', 'devis', 'client', 'perdu')),
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
