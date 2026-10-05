-- =====================================================================
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
