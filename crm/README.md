# CRM Alpes Désembouage

Application de suivi des prospects, clients, rendez-vous et interventions.
Fonctionne sur ordinateur et s'installe sur téléphone comme une application.

## Ce que fait le CRM (étape 1)

- **Clients & prospects** : fiche complète (coordonnées, installation de chauffage, notes), recherche, filtres par statut.
- **Pipeline** : Nouveau prospect → Contacté → Devis envoyé → Client / Perdu (glisser-déposer).
- **Agenda** : rendez-vous par semaine, filtre par technicien, couleur par technicien.
- **Rendez-vous** : boutons « Confirmer », « Je suis en route », « Démarrer », « Terminer », compte-rendu d'intervention.
- **SMS en un clic** : modèles pré-remplis (rappel, en route, intervention terminée + lien avis Google, relance devis, entretien) qui s'ouvrent dans l'appli Messages du téléphone.
- **Appel, e-mail, itinéraire Google Maps / Waze** depuis chaque fiche.
- **Suivi des devis Tolteck** : numéro, montant, statut. Les relances à faire apparaissent sur l'accueil après 7 jours.
- **Rappels d'entretien** : calculés à partir de la date du dernier désembouage.
- **Historique** de chaque client (appels, SMS, notes, changements de statut), alimenté automatiquement.
- **Équipe** : un gérant (accès complet) et des techniciens qui ne voient que leurs rendez-vous et clients, sans les montants.

## Mode démo

Tant que `js/config.js` est vide, le CRM tourne en mode démo : les données sont stockées uniquement
dans le navigateur de l'appareil. Parfait pour tester, **mais à ne pas utiliser pour de vrais clients**
(pas de synchronisation entre ordinateur et téléphone, données perdues si on vide le navigateur).

## Passer en mode réel (≈ 15 minutes, gratuit)

Le mode réel utilise **Supabase** (base de données sécurisée, hébergée en Europe, offre gratuite suffisante).

1. Créer un compte sur https://supabase.com puis **New project**.
   - Nom : `crm-alpes-desembouage`
   - Région : **Central EU (Frankfurt)** ou **West EU (Paris)**
   - Noter le mot de passe de la base dans un endroit sûr.
2. Dans le projet : **SQL Editor → New query**, coller tout le contenu de `supabase/schema.sql`, cliquer **Run**.
3. **Authentication → Sign In / Providers** : désactiver « Allow new users to sign up »
   (seul le gérant pourra ajouter des comptes).
4. **Authentication → URL Configuration** : mettre `https://www.alpes-desembouage.fr/crm/` dans *Site URL*
   et dans *Redirect URLs*.
5. **Authentication → Users → Add user → Create new user** : votre e-mail + un mot de passe.
   Le premier compte créé devient automatiquement **gérant**.
6. **Project Settings → API** : copier *Project URL* et la clé *anon public*, puis les coller dans `js/config.js` :
   ```js
   window.CRM_CONFIG = {
     supabaseUrl: 'https://xxxxxxxx.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```
   La clé *anon* peut être publique : ce sont les règles de sécurité de la base qui protègent les données.
   **Ne jamais mettre la clé `service_role` dans ce fichier.**
7. Publier le site. Le CRM est alors accessible sur `https://www.alpes-desembouage.fr/crm/`.

### Ajouter un technicien

Supabase → **Authentication → Users → Invite user** avec son e-mail. Il reçoit un lien, choisit son mot de passe
et arrive dans le CRM avec le rôle *technicien*. Ensuite, dans le CRM → **Équipe**, vous pouvez changer son nom,
sa couleur dans l'agenda, ou désactiver son accès (par exemple en fin de contrat de sous-traitance).

## Paiements

### Ce que ça fait

- **Encaisser** depuis un rendez-vous ou une fiche client. À la fin d'une intervention (« Terminer »),
  l'encaissement est proposé automatiquement, avec le **montant prévu** saisi par le gérant sur le RDV.
- **Carte bancaire** : un QR code s'affiche sur le téléphone du technicien. Le client le scanne et paie sur une page
  sécurisée Stripe (carte, Apple Pay, Google Pay). Le lien peut aussi partir par SMS ou e-mail (valable 24 h,
  régénérable). Le CRM passe le paiement en **Payé tout seul** et le technicien le voit en direct.
- **Virement** : IBAN, BIC et référence envoyés au client en un clic (SMS / e-mail), avec un QR code de virement.
  Le gérant coche « Virement reçu » quand l'argent arrive.
- **Chèque / espèces** (gérant uniquement) : enregistrés comme reçus.
- **À encaisser** sur l'accueil : demandes en attente et interventions terminées sans paiement.

> Un paiement n'est pas une facture : la facture reste à faire dans Tolteck.

### Mettre en place le paiement par carte (Stripe)

Pré-requis : le mode réel Supabase ci-dessus.

1. Créer un compte sur https://stripe.com (SIRET, IBAN du compte pro, pièce d'identité).
   Tant que le compte n'est pas validé, tout fonctionne en **mode test** (cartes fictives, aucun argent réel).
2. Stripe → **Développeurs → Clés API** : copier la **clé secrète** (`sk_test_…` puis `sk_live_…`).
3. Supabase → **Edge Functions → Secrets** : ajouter
   - `STRIPE_SECRET_KEY` = la clé secrète Stripe
   - `SITE_URL` = `https://www.alpes-desembouage.fr`
4. Supabase → **Edge Functions → Deploy a new function → Via editor** :
   - fonction `create-checkout` : coller `supabase/functions/create-checkout/index.ts`
   - fonction `stripe-webhook` : coller `supabase/functions/stripe-webhook/index.ts`,
     puis dans ses réglages **désactiver « Verify JWT »** (c'est Stripe qui l'appelle ; sa signature est vérifiée dans le code).
5. Stripe → **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://<votre-projet>.supabase.co/functions/v1/stripe-webhook`
   - événements : `checkout.session.completed` et `checkout.session.async_payment_succeeded`
   - copier le **secret de signature** (`whsec_…`) et l'ajouter dans Supabase → Secrets sous le nom `STRIPE_WEBHOOK_SECRET`.
6. Tester avec la carte de test Stripe `4242 4242 4242 4242` (date future, n'importe quel CVC), puis passer en clés `live`.

**La clé secrète Stripe ne doit jamais être mise dans `js/config.js` ni dans le site** : elle reste dans les secrets Supabase.

## Installer sur le téléphone

- **iPhone** : ouvrir l'adresse du CRM dans **Safari** → bouton Partager → « Sur l'écran d'accueil ».
- **Android** : ouvrir dans **Chrome** → menu ⋮ → « Installer l'application ».

## Prochaines étapes prévues

2. Envoi d'e-mails depuis le CRM
3. Signature électronique des devis (Yousign)
4. SMS 100 % automatiques (rappel la veille, etc.) via un service d'envoi (Brevo / OVH)
5. Photos avant / après sur les interventions
6. Connexion à un logiciel de facturation agréé (facture électronique obligatoire en 2027)

## Organisation des fichiers

```
crm/
├── index.html            page de l'application
├── manifest.webmanifest  installation sur téléphone
├── sw.js                 ouverture rapide / hors connexion
├── css/app.css           apparence
├── js/config.js          connexion Supabase (vide = mode démo)
├── js/store.js           lecture / écriture des données
├── js/app.js             écrans et fonctionnalités
├── icons/                icônes de l'application
└── supabase/schema.sql   tables et règles de sécurité
```
