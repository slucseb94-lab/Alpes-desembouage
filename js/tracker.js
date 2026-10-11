// Statistiques « maison » : le site envoie ses visites, clics et formulaires vers le CRM (Supabase).
// Respect du bandeau cookies : sans accord du visiteur, AUCUN identifiant n'est créé ni envoyé
// (simples compteurs anonymes). Avec accord, un identifiant aléatoire permet de rattacher le parcours
// à la fiche prospect quand la personne remplit le formulaire.
// Clé publique : elle ne permet que d'appeler track_events / link_visitor_to_lead, aucun accès aux données.
(function () {
  'use strict';

  var API = 'https://mgkbhucggqrkrtoyhjwi.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_uKPWZqfI6BG4AOTL2uvAuQ_Mz7J6VdR';
  var SECTIONS = ['boues', 'desembouage', 'process', 'societe', 'avis', 'contact'];
  var VISITOR_KEY = 'ad-vid';
  var SESSION_KEY = 'ad-sid';

  function get(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function set(store, key, value) { try { store.setItem(key, value); } catch (e) {} }
  function del(store, key) { try { store.removeItem(key); } catch (e) {} }

  // Pour ne pas fausser les chiffres : ouvrir le site une fois avec ?notrack=1 exclut ce navigateur
  // (?notrack=0 le remet). Pas de suivi non plus en local, ni pour les robots.
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('notrack') === '1') set(localStorage, 'ad-notrack', '1');
    if (q.get('notrack') === '0') del(localStorage, 'ad-notrack');
  } catch (e) {}
  var disabled = get(localStorage, 'ad-notrack') === '1' ||
    /^(localhost|127\.0\.0\.1|)$/.test(location.hostname) ||
    navigator.webdriver === true ||
    /bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent || '');

  if (disabled) { window.adTrack = function () {}; return; }

  function consented() {
    return get(localStorage, 'cookie-consent') === 'granted' && navigator.doNotTrack !== '1';
  }

  function randomId() {
    var bytes = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function identity(store, key) {
    var id = get(store, key);
    if (!id) { id = randomId(); set(store, key, id); }
    return id;
  }

  function visitorId() { return consented() ? identity(localStorage, VISITOR_KEY) : null; }
  function sessionId() { return consented() ? identity(sessionStorage, SESSION_KEY) : null; }

  function source() {
    try {
      var utm = new URLSearchParams(location.search).get('utm_source');
      if (utm) return utm.toLowerCase();
      if (!document.referrer) return 'direct';
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host === location.hostname.replace(/^www\./, '')) return 'direct';
      if (/(^|\.)google\./.test(host)) return 'google';
      if (/bing\.com|duckduckgo|qwant|ecosia|yahoo|brave\.com/.test(host)) return 'autre-moteur';
      if (/facebook|fb\.com|instagram|linkedin|youtube|tiktok|t\.co$/.test(host)) return host.split('.').slice(-2, -1)[0];
      return host.slice(0, 40);
    } catch (e) { return 'direct'; }
  }

  var queue = [];
  var timer = null;
  var device = window.innerWidth < 768 ? 'mobile' : 'desktop';
  var from = source();

  function send(path, body) {
    return fetch(API + path, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'apikey': KEY },
      body: JSON.stringify(body)
    }).catch(function () {});
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    var sends = [];
    while (queue.length) sends.push(send('track_events', { p_events: queue.splice(0, 25) }));
    return Promise.all(sends);
  }

  function track(type, label) {
    queue.push({ type: type, label: label || '', visitor: visitorId(), session: sessionId(), source: from, device: device });
    if (!timer) timer = setTimeout(flush, 2500);
  }

  // Une visite par page ouverte (ou par session si le visiteur a accepté les cookies).
  var counted = consented() && get(sessionStorage, 'ad-visit') === '1';
  if (!counted) {
    if (consented()) set(sessionStorage, 'ad-visit', '1');
    track('visit', '');
  }

  // Sections atteintes en faisant défiler la page.
  if ('IntersectionObserver' in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !seen[en.target.id]) {
          seen[en.target.id] = true;
          io.unobserve(en.target);
          track('section', en.target.id);
        }
      });
    }, { rootMargin: '0px 0px -40% 0px', threshold: 0 });
    SECTIONS.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Clics : boutons marqués data-track, numéros de téléphone et e-mail.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-track], a[href^="tel:"], a[href^="mailto:"]') : null;
    if (!el) return;
    var label = el.getAttribute('data-track');
    if (!label) {
      var href = el.getAttribute('href') || '';
      if (href.indexOf('tel:') === 0) label = /^(\+33|0)[67]/.test(href.slice(4)) ? 'tel_portable' : 'tel_fixe';
      else label = 'email';
    }
    track('click', label);
  });

  // Vidéo lancée.
  Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
    v.addEventListener('play', function () { track('video_play', 'intervention'); }, { once: true });
  });

  // Début de remplissage du formulaire.
  var form = document.getElementById('contact-form');
  if (form) form.addEventListener('focusin', function () { track('form_start', 'contact'); }, { once: true });

  // Envoi quand l'onglet se ferme ou passe en arrière-plan.
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // Le visiteur refuse (ou retire) son accord : on efface ses identifiants.
  document.addEventListener('ad:consent', function (e) {
    if (!e.detail || !e.detail.granted) { del(localStorage, VISITOR_KEY); del(sessionStorage, SESSION_KEY); del(sessionStorage, 'ad-visit'); }
  });

  // Appelée par le site : window.adTrack('form_submit', 'contact', { phone, email }).
  window.adTrack = function (type, label, lead) {
    track(type, label);
    if (type === 'form_submit' && lead && consented()) {
      var visitor = visitorId();
      flush().then(function () {
        return send('link_visitor_to_lead', { p_visitor: visitor, p_phone: lead.phone || '', p_email: lead.email || '' });
      });
    }
  };
})();
