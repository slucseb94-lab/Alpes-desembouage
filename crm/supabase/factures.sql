-- =====================================================================
-- Factures et avoirs
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================
-- Règles appliquées par la base elle-même :
--   • numérotation continue et chronologique, attribuée à l'émission (FAC-2026-0001, AV-2026-0001) ;
--   • une facture émise ne peut plus être modifiée ni supprimée (on corrige par un avoir) ;
--   • les coordonnées du client sont figées dans la facture (elle reste valable même si la fiche change).

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  client_id uuid references public.clients (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  kind text not null default 'facture' check (kind in ('facture', 'avoir')),
  ref_invoice_id uuid references public.invoices (id) on delete set null,
  number text unique,
  status text not null default 'brouillon' check (status in ('brouillon', 'emise', 'payee', 'annulee')),
  title text default '',
  lines jsonb,
  project_address text default '',
  client_snapshot jsonb,
  issue_date date,
  service_date date,
  due_date date,
  total_ht numeric(10, 2),
  total_tva numeric(10, 2),
  total_ttc numeric(10, 2),
  notes text default '',
  pdf_path text,
  paid_at date,
  payment_method text,
  sent_at timestamptz
);
create index if not exists invoices_client_idx on public.invoices (client_id);

alter table public.invoices enable row level security;
drop policy if exists "factures gérant" on public.invoices;
create policy "factures gérant" on public.invoices for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- verrouillage après émission
create or replace function public.invoices_lock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'brouillon' then raise exception 'Une facture émise ne peut pas être supprimée : faites un avoir.'; end if;
    return old;
  end if;
  if old.status <> 'brouillon' and (
       new.number is distinct from old.number or new.kind is distinct from old.kind or new.lines is distinct from old.lines
    or new.total_ht is distinct from old.total_ht or new.total_tva is distinct from old.total_tva or new.total_ttc is distinct from old.total_ttc
    or new.issue_date is distinct from old.issue_date or new.service_date is distinct from old.service_date
    or new.client_snapshot is distinct from old.client_snapshot or new.title is distinct from old.title
    or new.ref_invoice_id is distinct from old.ref_invoice_id or new.status = 'brouillon'
    or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
  ) then
    raise exception 'Une facture émise ne peut plus être modifiée : faites un avoir.';
  end if;
  return new;
end $$;

drop trigger if exists invoices_lock_upd on public.invoices;
drop trigger if exists invoices_lock_del on public.invoices;
create trigger invoices_lock_upd before update on public.invoices for each row execute function public.invoices_lock();
create trigger invoices_lock_del before delete on public.invoices for each row execute function public.invoices_lock();

-- ---------------------------------------------------------------- numérotation
insert into public.counters (key, value) values ('facture', 0), ('avoir', 0) on conflict (key) do nothing;

-- Émet une facture ou un avoir : attribue le numéro suivant et fige le document.
create or replace function public.issue_invoice(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  inv public.invoices%rowtype;
  n integer;
  v_number text;
  v_date date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_admin() then raise exception 'Réservé au gérant'; end if;
  select * into inv from public.invoices where id = p_id for update;
  if not found then raise exception 'Facture introuvable'; end if;
  if inv.status <> 'brouillon' then raise exception 'Cette facture est déjà émise'; end if;
  if inv.lines is null or jsonb_array_length(inv.lines) = 0 then raise exception 'La facture ne contient aucune ligne'; end if;

  update public.counters set value = value + 1 where key = inv.kind returning value into n;
  v_number := case when inv.kind = 'avoir' then 'AV-' else 'FAC-' end || to_char(v_date, 'YYYY') || '-' || lpad(n::text, 4, '0');

  update public.invoices set
    number = v_number,
    status = case when inv.kind = 'facture' and inv.paid_at is not null then 'payee' else 'emise' end,
    issue_date = v_date,
    due_date = coalesce(inv.due_date, v_date)
  where id = p_id;

  -- Avoir total : la facture d'origine passe en « annulée »
  if inv.kind = 'avoir' and inv.ref_invoice_id is not null then
    update public.invoices f set status = 'annulee'
    where f.id = inv.ref_invoice_id and f.status in ('emise', 'payee') and abs(f.total_ttc + inv.total_ttc) < 0.01;
  end if;

  return json_build_object('number', v_number, 'issue_date', v_date);
end $$;

create or replace function public.get_counter(p_key text)
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select value from public.counters where key = p_key) end;
$$;

create or replace function public.set_counter(p_key text, p_value integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé au gérant'; end if;
  if p_value < 0 or p_key not in ('devis', 'facture', 'avoir') then raise exception 'Valeur invalide'; end if;
  update public.counters set value = p_value where key = p_key;
end $$;

revoke all on function public.issue_invoice(uuid) from public;
revoke all on function public.get_counter(text) from public;
revoke all on function public.set_counter(text, integer) from public;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.get_counter(text) to authenticated;
grant execute on function public.set_counter(text, integer) to authenticated;

-- =====================================================================
-- Prospects des publicités Facebook / Instagram (via Make.com) : même fonction que le formulaire
-- du site, avec en plus la « source » du prospect.
-- =====================================================================
drop function if exists public.submit_lead(text, text, text, text, text, text);

create or replace function public.submit_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_city text default '',
  p_message text default '',
  p_honeypot text default '',
  p_source text default 'Site internet'
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
  v_postal text;
  v_client_id uuid;
  v_topic text;
begin
  -- Robot détecté (champ invisible rempli) : on ne fait rien, sans le signaler.
  if coalesce(p_honeypot, '') <> '' then return; end if;

  if length(v_name) < 2 or (length(v_digits) < 9 and v_email = '') then
    raise exception 'Nom et téléphone (ou e-mail) obligatoires';
  end if;

  -- Anti-inondation : pas plus de 60 demandes par heure et par source.
  if (select count(*) from public.clients where source = v_source and created_at > now() - interval '1 hour') >= 60 then
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
            v_source, 'nouveau', v_message, null)
    returning id into v_client_id;
  else
    update public.clients set status = 'nouveau' where id = v_client_id and status = 'perdu';
  end if;

  insert into public.activities (client_id, user_id, type, content)
  values (v_client_id, null, 'demande',
          'Demande via ' || case when v_source = 'Site internet' then 'le formulaire du site' else 'une publicité Facebook / Instagram' end ||
          case when v_message <> '' then E' :\n' || v_message else '' end);

  -- Notification sur le téléphone du gérant (ntfy) : seule la ville et la source transitent.
  select value ->> 'ntfy_topic' into v_topic from public.settings where key = 'notify';
  if coalesce(v_topic, '') <> '' then
    begin
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object(
          'topic', v_topic,
          'title', case when v_source = 'Site internet' then 'Nouveau prospect via le site' else 'Nouveau prospect Facebook / Instagram' end,
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

revoke all on function public.submit_lead(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text, text) to anon, authenticated;
