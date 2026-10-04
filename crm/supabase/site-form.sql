-- =====================================================================
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
