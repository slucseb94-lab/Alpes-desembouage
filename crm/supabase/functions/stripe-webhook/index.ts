// Fonction serveur Supabase : Stripe l'appelle quand un client a payé, et le CRM passe le paiement en « Payé ».
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// À déployer SANS vérification JWT (c'est Stripe qui appelle, pas un utilisateur) :
//   la signature Stripe est vérifiée ci-dessous à la place.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() });
const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!, undefined, crypto);
  } catch (e) {
    return new Response('Signature invalide : ' + (e as Error).message, { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.payment_id;
    if (paymentId && session.payment_status === 'paid') {
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: payment } = await db
        .from('payments')
        .update({ status: 'paye', paid_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('status', 'en_attente')
        .select()
        .single();
      if (payment) {
        await db.from('activities').insert({
          client_id: payment.client_id,
          user_id: payment.created_by,
          type: 'note',
          content: 'Paiement par carte reçu : ' + Number(payment.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' (' + payment.description + ')'
        });
      }
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
