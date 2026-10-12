-- =====================================================================
-- Mise à jour : délai de rétractation, statut « RDV confirmé », notifications de devis signé
-- À coller une fois dans Supabase > SQL Editor > New query > Run
-- Conseil : fermez le CRM (ordinateur et téléphone) pendant l'exécution.
-- =====================================================================

-- ---------------------------------------------------------------- statut « RDV confirmé »
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status in ('nouveau', 'contacte', 'devis', 'rdv', 'client', 'perdu', 'indesirable'));

-- ---------------------------------------------------------------- demande d'intervention anticipée
alter table public.quotes add column if not exists early_start boolean not null default false;

create or replace function public.get_signing_info(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'reference', q.reference,
    'amount', q.amount,
    'pdf_path', q.pdf_path,
    'doc_hash', q.doc_hash,
    'with_cgv', q.with_cgv,
    'early_start', q.early_start,
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

-- ---------------------------------------------------------------- signature (+ notifications au gérant)
drop function if exists public.sign_quote(uuid, text, text, text, boolean);

create extension if not exists pg_net with schema extensions;

create or replace function public.sign_quote(
  p_token uuid,
  p_name text,
  p_signature text,
  p_doc_hash text,
  p_consent boolean,
  p_early_start boolean default false
)
returns json language plpgsql security definer set search_path = public as $$
declare
  q public.quotes%rowtype;
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_ip text := left(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), 64);
  v_client text;
  v_amount text;
  v_topic text;
  v_mail jsonb;
  v_owner text;
  v_deadline text;
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
    signer_ip = v_ip, signer_user_agent = left(coalesce(h ->> 'user-agent', ''), 300), status = 'accepte',
    early_start = coalesce(p_early_start, false)
  where id = q.id;

  update public.clients set status = 'client' where id = q.client_id and status <> 'client';

  insert into public.activities (client_id, user_id, type, content)
  values (q.client_id, null, 'statut',
          'Devis ' || coalesce(nullif(q.reference, ''), '') || ' signé électroniquement par ' || v_name || ' — statut : Client' ||
          case when coalesce(p_early_start, false) then ' — intervention avant la fin du délai de rétractation demandée'
               else ' — délai de rétractation : 14 jours' end);

  -- Notifications au gérant (une panne d'envoi ne doit jamais bloquer la signature)
  select name into v_client from public.clients where id = q.client_id;
  v_amount := coalesce(replace(to_char(q.amount, 'FM999999990.00'), '.', ',') || ' €', '');
  v_deadline := to_char((now() at time zone 'Europe/Paris') + interval '14 days', 'DD/MM/YYYY');

  -- 1) Notification téléphone (ntfy) : sans le nom du client, par discrétion
  select value ->> 'ntfy_topic' into v_topic from public.settings where key = 'notify';
  if coalesce(v_topic, '') <> '' then
    begin
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object(
          'topic', v_topic,
          'title', 'Devis signé',
          'message', 'Le devis ' || coalesce(q.reference, '') || ' (' || v_amount || ') vient d''être signé.',
          'tags', jsonb_build_array('white_check_mark'),
          'priority', 4,
          'click', 'https://www.alpes-desembouage.fr/crm/#/clients/' || q.client_id
        )
      );
    exception when others then null;
    end;
  end if;

  -- 2) E-mail au gérant, envoyé par son propre script Google (Réglages → Envoi des e-mails)
  select value into v_mail from public.settings where key = 'email';
  select coalesce(nullif(value ->> 'email', ''), 'alpesdesembouage@gmail.com') into v_owner from public.settings where key = 'company';
  v_owner := coalesce(v_owner, 'alpesdesembouage@gmail.com');
  if coalesce(v_mail ->> 'script_url', '') <> '' and coalesce(v_mail ->> 'secret', '') <> '' then
    begin
      perform net.http_post(
        url := v_mail ->> 'script_url',
        body := jsonb_build_object(
          'secret', v_mail ->> 'secret',
          'to', v_owner,
          'fromName', 'CRM Alpes Désembouage',
          'subject', 'Devis ' || coalesce(q.reference, '') || ' signé par ' || coalesce(v_client, v_name),
          'text', 'Bonne nouvelle : le devis ' || coalesce(q.reference, '') || ' vient d''être signé électroniquement.' || E'\n\n' ||
                  'Client : ' || coalesce(v_client, '') || E'\n' ||
                  'Signataire : ' || v_name || E'\n' ||
                  'Montant : ' || v_amount || ' TTC' || E'\n' ||
                  'Signé le : ' || to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || E'\n' ||
                  case when coalesce(p_early_start, false)
                       then 'Intervention anticipée : demandée par le client (vous pouvez intervenir avant le ' || v_deadline || ').'
                       else 'Délai de rétractation : jusqu''au ' || v_deadline || ' — planifiez l''intervention après cette date.' end || E'\n\n' ||
                  'Ouvrir la fiche dans le CRM : https://www.alpes-desembouage.fr/crm/#/clients/' || q.client_id
        )
      );
    exception when others then null;
    end;
  end if;

  return json_build_object('signed_at', now(), 'signer_ip', v_ip);
end $$;

revoke all on function public.sign_quote(uuid, text, text, text, boolean, boolean) from public;
grant execute on function public.sign_quote(uuid, text, text, text, boolean, boolean) to anon, authenticated;
