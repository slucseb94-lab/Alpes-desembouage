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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  note.textContent = 'Envoi en cours...';
  note.style.color = '#5a6472';

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      note.textContent = 'Message envoyé, merci ! Nous vous recontactons rapidement.';
      note.style.color = '#1d8a4c';
      form.reset();
    } else {
      note.textContent = "Une erreur est survenue. Contactez-nous par téléphone.";
      note.style.color = '#d9541e';
    }
  } catch (err) {
    note.textContent = "Une erreur est survenue. Contactez-nous par téléphone.";
    note.style.color = '#d9541e';
  }
});
