// Fonction serveur Supabase : crée une page de paiement Stripe Checkout pour un encaissement du CRM.
// Secrets à définir dans Supabase (Edge Functions > Secrets) : STRIPE_SECRET_KEY, SITE_URL
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.)
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: 'payment_id manquant' }, 400);

    // 1. Lecture avec les droits de l'utilisateur connecté : s'il ne voit pas ce paiement, il ne peut pas l'encaisser.
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });
    const { data: payment, error } = await asUser
      .from('payments')
      .select('*, clients(name, email)')
      .eq('id', payment_id)
      .single();
    if (error || !payment) return json({ error: 'Paiement introuvable ou accès refusé' }, 403);
    if (payment.status !== 'en_attente') return json({ error: 'Ce paiement est déjà ' + payment.status }, 400);
    if (payment.method !== 'carte') return json({ error: "Ce paiement n'est pas un paiement par carte" }, 400);

    // 2. Création de la page de paiement Stripe (valable 24 h).
    const site = (Deno.env.get('SITE_URL') ?? 'https://www.alpes-desembouage.fr').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(payment.amount) * 100),
          product_data: { name: payment.description || 'Intervention Alpes Désembouage' }
        }
      }],
      customer_email: payment.clients?.email || undefined,
      payment_intent_data: {
        description: payment.description,
        receipt_email: payment.clients?.email || undefined,
        metadata: { payment_id: payment.id, reference: payment.reference ?? '' }
      },
      metadata: { payment_id: payment.id },
      success_url: site + '/paiement-merci.html',
      cancel_url: site + '/paiement-merci.html?annule=1',
      expires_at: Math.floor(Date.now() / 1000) + 23 * 3600
    });

    // 3. Enregistrement du lien (clé serveur : les techniciens n'ont pas le droit de modifier un paiement).
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.from('payments').update({ checkout_url: session.url, stripe_session_id: session.id }).eq('id', payment.id);

    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
