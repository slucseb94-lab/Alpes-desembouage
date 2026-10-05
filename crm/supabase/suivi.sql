-- =====================================================================
-- Mise à jour : rappels, motif de perte, alerte nouveau prospect, CGV à la signature
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------- rappels et motif de perte
alter table public.clients
  add column if not exists next_action_at date,
  add column if not exists next_action_note text default '',
  add column if not exists lost_reason text default '';

-- ---------------------------------------------------------------- CGV signées avec le devis
alter table public.quotes add column if not exists with_cgv boolean not null default false;

-- Les conditions générales de vente (dossier « cgv/ ») sont lisibles par lien : ce sont des documents publics.
drop policy if exists "cgv lecture publique" on storage.objects;
create policy "cgv lecture publique" on storage.objects for select to anon, authenticated
  using (bucket_id = 'devis' and name like 'cgv/%');

create or replace function public.get_signing_info(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reference', q.reference,
    'amount', q.amount,
    'pdf_path', q.pdf_path,
    'doc_hash', q.doc_hash,
    'with_cgv', q.with_cgv,
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

-- ---------------------------------------------------------------- alerte « nouveau prospect » (notification ntfy)
create extension if not exists pg_net with schema extensions;

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
  v_topic text;
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
  values (v_client_id, null, 'demande',
          'Demande via le formulaire du site' || case when v_message <> '' then E' :\n' || v_message else '' end);

  -- Notification sur le téléphone du gérant (application ntfy), si un « sujet » est réglé dans le CRM.
  -- Volontairement sans nom ni téléphone : seule la ville transite par le service de notification.
  select value ->> 'ntfy_topic' into v_topic from public.settings where key = 'notify';
  if coalesce(v_topic, '') <> '' then
    begin
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object(
          'topic', v_topic,
          'title', 'Nouveau prospect via le site',
          'message', 'Demande de contact' || case when v_city <> '' then ' — ' || v_city else '' end || '. Rappelez vite !',
          'tags', jsonb_build_array('bell'),
          'priority', 4,
          'click', 'https://www.alpes-desembouage.fr/crm/#/clients/' || v_client_id
        )
      );
    exception when others then null; -- une panne de notification ne doit jamais bloquer la demande
    end;
  end if;
end $$;

-- Les demandes déjà reçues du site ne comptent pas comme un contact de votre part.
update public.activities set type = 'demande' where type = 'email' and content like 'Demande via le formulaire du site%';

revoke all on function public.submit_lead(text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text) to anon, authenticated;
