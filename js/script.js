document.getElementById('year').textContent = new Date().getFullYear();

const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger.addEventListener('click', () => {
  nav.classList.toggle('open');
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('open'));
});

const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.style.boxShadow = window.scrollY > 10
    ? '0 4px 20px rgba(11,37,69,0.1)'
    : '0 1px 0 rgba(11,37,69,0.06)';
});

const form = document.getElementById('contact-form');
const note = document.getElementById('form-note');

// Crée la fiche « Nouveau prospect » dans le CRM (en plus de l'e-mail envoyé par Formspree).
// Clé publique : elle ne permet que d'appeler la fonction submit_lead, aucun accès aux données.
const CRM_URL = 'https://mgkbhucggqrkrtoyhjwi.supabase.co';
const CRM_KEY = 'sb_publishable_uKPWZqfI6BG4AOTL2uvAuQ_Mz7J6VdR';

async function sendToCrm(data) {
  const response = await fetch(CRM_URL + '/rest/v1/rpc/submit_lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': CRM_KEY },
    body: JSON.stringify({
      p_name: data.get('name') || '',
      p_email: data.get('email') || '',
      p_phone: data.get('phone') || '',
      p_city: data.get('city') || '',
      p_message: data.get('message') || '',
      p_honeypot: data.get('_gotcha') || ''
    })
  });
  return response.ok;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  note.textContent = 'Envoi en cours...';
  note.style.color = '#5a6472';

  const data = new FormData(form);
  try {
    const [response, crmOk] = await Promise.all([
      fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } })
        .catch(() => ({ ok: false })),
      sendToCrm(data).catch(() => false)
    ]);

    if (response.ok || crmOk) {
      note.textContent = 'Message envoyé, merci ! Nous vous recontactons rapidement.';
      note.style.color = '#1d8a4c';
      form.reset();
    } else {
      note.textContent = "Une erreur est survenue. Contactez-nous par téléphone.";
      note.style.color = '#d9591a';
    }
  } catch (err) {
    note.textContent = "Une erreur est survenue. Contactez-nous par téléphone.";
    note.style.color = '#d9591a';
  }
});

const cookieBanner = document.getElementById('cookie-banner');
const cookieAccept = document.getElementById('cookie-accept');
const cookieDecline = document.getElementById('cookie-decline');
const consentChoice = localStorage.getItem('cookie-consent');

function applyConsent(granted) {
  if (typeof gtag === 'function') {
    gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
  }
}

if (consentChoice) {
  applyConsent(consentChoice === 'granted');
} else {
  cookieBanner.hidden = false;
}

cookieAccept.addEventListener('click', () => {
  localStorage.setItem('cookie-consent', 'granted');
  applyConsent(true);
  cookieBanner.hidden = true;
});

cookieDecline.addEventListener('click', () => {
  localStorage.setItem('cookie-consent', 'denied');
  applyConsent(false);
  cookieBanner.hidden = true;
});
