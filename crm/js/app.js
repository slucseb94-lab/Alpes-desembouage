// CRM Alpes Désembouage — interface (routeur, vues, formulaires).
(function () {
  const S = window.Store;

  // ================================================================ référentiels
  const STATUS = {
    nouveau: { label: 'Nouveau prospect', color: '#1c74c4' },
    contacte: { label: 'Contacté', color: '#7c5cc4' },
    devis: { label: 'Devis envoyé', color: '#e0691f' },
    client: { label: 'Client', color: '#1f9d55' },
    perdu: { label: 'Perdu', color: '#8a94a3' }
  };
  const CLIENT_TYPES = { particulier: 'Particulier', professionnel: 'Professionnel', syndic: 'Syndic / copropriété' };
  const APPT_TYPES = { visite: 'Visite technique', desembouage: 'Désembouage', entretien: 'Entretien', sav: 'SAV / dépannage', autre: 'Autre' };
  const APPT_STATUS = {
    planifie: { label: 'Planifié', color: '#5a6472' },
    confirme: { label: 'Confirmé', color: '#1c74c4' },
    en_route: { label: 'En route', color: '#7c5cc4' },
    en_cours: { label: 'En cours', color: '#e0691f' },
    termine: { label: 'Terminé', color: '#1f9d55' },
    annule: { label: 'Annulé', color: '#b3261e' }
  };
  const QUOTE_STATUS = {
    envoye: { label: 'En attente', color: '#e0691f' },
    accepte: { label: 'Accepté', color: '#1f9d55' },
    refuse: { label: 'Refusé', color: '#8a94a3' }
  };
  const PAY_STATUS = {
    en_attente: { label: 'À encaisser', color: '#e0691f' },
    paye: { label: 'Payé', color: '#1f9d55' },
    annule: { label: 'Annulé', color: '#8a94a3' }
  };
  const PAY_METHODS = { carte: 'Carte bancaire', virement: 'Virement', cheque: 'Chèque', especes: 'Espèces' };
  const ACT_TYPES = {
    note: { label: 'Note', color: '#5a6472' },
    appel: { label: 'Appel', color: '#1c74c4' },
    sms: { label: 'SMS', color: '#7c5cc4' },
    email: { label: 'E-mail', color: '#0e8a8a' },
    visite: { label: 'Visite / intervention', color: '#1f9d55' },
    statut: { label: 'Changement de statut', color: '#e0691f' }
  };
  const SOURCES = ['Google / Fiche Google', 'Site internet', 'Bouche-à-oreille', 'Recommandation client', 'Partenaire / plombier', 'Réseaux sociaux', 'Autre'];
  const HEATING = ['Gaz', 'Fioul', 'Pompe à chaleur', 'Bois / granulés', 'Électrique', 'Réseau de chaleur', 'Autre'];
  const EMITTERS = ['Radiateurs', 'Plancher chauffant', 'Mixte'];
  const DURATIONS = { 30: '30 min', 60: '1 h', 90: '1 h 30', 120: '2 h', 180: '3 h', 240: '4 h', 300: '5 h', 480: 'Journée' };
  const SERVICE_TYPES = ['desembouage', 'entretien'];

  const DEFAULT_TEMPLATES = {
    rappel: { label: 'Rappel de rendez-vous', text: 'Bonjour {nom}, nous vous rappelons votre rendez-vous ({type}) le {date} à {heure}. En cas d\'empêchement, merci de répondre à ce SMS. {entreprise}' },
    en_route: { label: 'Technicien en route', text: 'Bonjour {nom}, {technicien} est en route et arrivera chez vous dans environ 30 minutes. {entreprise}' },
    termine: { label: 'Intervention terminée', text: 'Bonjour {nom}, l\'intervention est terminée. Merci pour votre confiance ! Si vous êtes satisfait, un avis Google nous aiderait beaucoup : {lien_avis}' },
    relance_devis: { label: 'Relance de devis', text: 'Bonjour {nom}, avez-vous pu consulter notre devis {reference} ? Je reste disponible pour toute question. {entreprise}' },
    entretien: { label: 'Entretien à prévoir', text: 'Bonjour {nom}, votre dernier désembouage date de {dernier_entretien}. Il est conseillé de prévoir un entretien pour garder un chauffage performant. Souhaitez-vous fixer un rendez-vous ? {entreprise}' },
    paiement: { label: 'Lien de paiement par carte', text: 'Bonjour {nom}, voici le lien sécurisé pour régler {montant} par carte bancaire : {lien_paiement} Merci pour votre confiance ! {entreprise}' },
    virement: { label: 'Coordonnées pour virement', text: 'Bonjour {nom}, pour régler {montant} par virement : IBAN {iban} – BIC {bic} – titulaire {titulaire}. Merci d\'indiquer la référence {ref_paiement} dans le libellé. {entreprise}' }
  };
  const PAYMENT_TEMPLATES = ['paiement', 'virement'];
  const DEFAULT_COMPANY = { name: 'Alpes Désembouage', review_link: 'https://maps.app.goo.gl/sVYWGCqHb2V59HXk9' };

  // ================================================================ utilitaires
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const sameDay = (a, b) => ymd(a) === ymd(b);
  const fmt = (iso, opts) => (iso ? new Date(iso).toLocaleString('fr-FR', opts) : '');
  const fmtDate = (iso) => (iso ? fmt(iso.length === 10 ? iso + 'T12:00:00' : iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const fmtDay = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit' });
  const fmtMoney = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
  const fmtMoney2 = (n) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const toLocalInput =(iso) => { if (!iso) return ''; const d = new Date(iso); return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const daysSince = (iso) => Math.floor((Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime()) / 86400000);
  const relTime = (iso) => {
    const n = daysSince(iso);
    if (n <= 0) return "aujourd'hui";
    if (n === 1) return 'hier';
    if (n < 30) return 'il y a ' + n + ' j';
    return fmtDate(iso);
  };

  const badge = (map, key) => { const s = map[key] || { label: key, color: '#5a6472' }; return '<span class="badge" style="--c:' + s.color + '">' + esc(s.label) + '</span>'; };
  const client = (id) => S.data.clients.find((c) => c.id === id);
  const profile = (id) => S.data.profiles.find((p) => p.id === id);
  const company = () => Object.assign({}, DEFAULT_COMPANY, S.data.settings.company || {});
  const templates = () => {
    const saved = S.data.settings.sms_templates || {};
    const out = {};
    Object.keys(DEFAULT_TEMPLATES).forEach((k) => { out[k] = { label: DEFAULT_TEMPLATES[k].label, text: saved[k] || DEFAULT_TEMPLATES[k].text }; });
    return out;
  };
  const technicians = () => S.data.profiles.filter((p) => p.active);

  // Téléphone au format international pour les liens tel: / sms:
  function intlPhone(phone, country) {
    let p = String(phone || '').replace(/[^\d+]/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (p.startsWith('0')) p = (country === 'CH' ? '+41' : '+33') + p.slice(1);
    return p;
  }
  const fullAddress = (c) => [c.address, [c.postal_code, c.city].filter(Boolean).join(' '), c.country === 'CH' ? 'Suisse' : ''].filter(Boolean).join(', ');
  const mapsUrl = (c) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(fullAddress(c));
  const wazeUrl = (c) => 'https://waze.com/ul?q=' + encodeURIComponent(fullAddress(c)) + '&navigate=yes';
  const smsUrl = (c, body) => 'sms:' + intlPhone(c.phone, c.country) + '?&body=' + encodeURIComponent(body);

  function nextService(c) {
    if (!c.last_service_date || !c.service_interval_months) return null;
    const d = parseYmd(c.last_service_date);
    d.setMonth(d.getMonth() + Number(c.service_interval_months));
    return d;
  }

  function fillTemplate(text, ctx) {
    const c = ctx.client || {}, a = ctx.appt, q = ctx.quote, p = ctx.payment, co = company(), bank = S.data.settings.bank || {};
    const tech = a && profile(a.technician_id);
    const vars = {
      nom: c.name || '',
      date: a ? new Date(a.start_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
      heure: a ? fmtTime(a.start_at).replace(':', 'h') : '',
      type: a ? (APPT_TYPES[a.type] || '').toLowerCase() : '',
      technicien: tech ? tech.full_name.replace(/\s*\(.*\)$/, '') : (S.user ? S.user.full_name : ''),
      reference: q ? q.reference || '' : '',
      dernier_entretien: c.last_service_date ? fmtDate(c.last_service_date) : '',
      entreprise: co.name,
      lien_avis: co.review_link,
      montant: p ? fmtMoney2(p.amount) : '',
      lien_paiement: p ? p.checkout_url || '' : '',
      ref_paiement: p ? p.reference || '' : '',
      iban: bank.iban || '', bic: bank.bic || '', titulaire: bank.holder || ''
    };
    return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  function toast(msg, isError) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, isError ? 5000 : 2600);
  }

  async function guard(fn) {
    try { return await fn(); } catch (e) { console.error(e); toast(e.message || 'Une erreur est survenue.', true); throw e; }
  }

  async function logActivity(client_id, type, content) {
    return S.insert('activities', { client_id, type, content, user_id: S.user.id });
  }

  async function setClientStatus(c, status, reason) {
    if (!c || c.status === status) return;
    const from = STATUS[c.status].label;
    await S.update('clients', c.id, { status });
    await logActivity(c.id, 'statut', 'Statut : ' + from + ' → ' + STATUS[status].label + (reason ? ' (' + reason + ')' : ''));
  }

  // ================================================================ icônes
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>',
    columns: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
    team: '<circle cx="12" cy="7" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
    nav: '<path d="M3 11l19-9-9 19-2-8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    chevL: '<path d="M15 18l-6-6 6-6"/>',
    chevR: '<path d="M9 18l6-6-6-6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'
  };
  const icon = (name, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';

  // ================================================================ formulaires (fenêtre modale)
  const modal = $('#modal');

  function closeModal() { if (modal.open) modal.close(); modal.innerHTML = ''; delete modal.dataset.payment; }
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function fieldHtml(f, v) {
    if (f.section) return '<h4 class="form-section">' + esc(f.section) + '</h4>';
    const val = v == null ? (f.default == null ? '' : f.default) : v;
    const req = f.required ? ' required' : '';
    const id = 'f-' + f.name;
    let input;
    if (f.type === 'select') {
      const opts = Array.isArray(f.options) ? f.options.map((o) => [o, o]) : Object.entries(f.options);
      input = '<select id="' + id + '" name="' + f.name + '"' + req + '>' +
        (f.empty !== undefined ? '<option value="">' + esc(f.empty) + '</option>' : '') +
        opts.map(([k, l]) => '<option value="' + esc(k) + '"' + (String(val) === String(k) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
    } else if (f.type === 'file') {
      input = '<input id="' + id + '" name="' + f.name + '" type="file" accept="' + esc(f.accept || '') + '">';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 3) + '"' + req + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(val) + '</textarea>';
    } else {
      const v2 = f.type === 'datetime-local' ? toLocalInput(val) : val;
      input = '<input id="' + id + '" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(v2) + '"' + req +
        (f.step ? ' step="' + f.step + '"' : '') + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + ' placeholder="' + esc(f.placeholder || '') + '">';
    }
    return '<label class="field' + (f.half ? ' half' : '') + '" for="' + id + '"><span>' + esc(f.label) + (f.required ? ' *' : '') + '</span>' + input + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '') + '</label>';
  }

  function openForm(opts) {
    const values = opts.values || {};
    modal.innerHTML =
      '<form class="modal-card" novalidate>' +
      '<header class="modal-head"><h3>' + esc(opts.title) + '</h3><button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button></header>' +
      '<div class="modal-body form-grid">' + opts.fields.map((f) => fieldHtml(f, values[f.name])).join('') + '</div>' +
      '<footer class="modal-foot">' +
      (opts.onDelete ? '<button type="button" class="btn btn-danger-ghost" data-delete>Supprimer</button>' : '') +
      '<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Annuler</button>' +
      '<button type="submit" class="btn btn-primary">' + esc(opts.submitLabel || 'Enregistrer') + '</button></footer></form>';
    const form = $('form', modal);
    modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    if (opts.onDelete) {
      const del = $('[data-delete]', modal);
      del.addEventListener('click', async () => {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Confirmer la suppression ?'; return; }
        await guard(opts.onDelete);
        closeModal();
        render();
      });
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const out = {};
      opts.fields.forEach((f) => {
        if (!f.name) return;
        if (f.type === 'file') { out[f.name] = form.elements[f.name].files[0] || null; return; }
        let v = form.elements[f.name].value.trim();
        if (f.type === 'number') v = v === '' ? null : Number(v);
        else if (f.type === 'datetime-local') v = v ? new Date(v).toISOString() : null;
        else if (f.type === 'date' || f.nullable) v = v || null;
        out[f.name] = v;
      });
      const btn = $('[type=submit]', form);
      btn.disabled = true;
      let res;
      try { res = await guard(() => opts.onSubmit(out)); } catch (err) { btn.disabled = false; return; }
      closeModal(); render();
      if (opts.after) opts.after(res);
    });
    modal.showModal();
    const first = form.querySelector('input:not([type=hidden]), select, textarea');
    if (first && window.matchMedia('(min-width: 700px)').matches) first.focus();
  }

  function openSheet(title, bodyHtml, bind) {
    modal.innerHTML = '<div class="modal-card"><header class="modal-head"><h3>' + esc(title) + '</h3><button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button></header><div class="modal-body">' + bodyHtml + '</div></div>';
    modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    if (bind) bind(modal);
    modal.showModal();
  }

  // ---------------------------------------------------------------- formulaires métier
  function clientFields() {
    const f = [
      { section: 'Coordonnées' },
      { name: 'name', label: 'Nom (ou nom de la copropriété)', required: true },
      { name: 'type', label: 'Type', type: 'select', options: CLIENT_TYPES, half: true },
      { name: 'company', label: 'Société / syndic', half: true },
      { name: 'phone', label: 'Téléphone', type: 'tel', half: true, inputmode: 'tel' },
      { name: 'email', label: 'E-mail', type: 'email', half: true },
      { name: 'address', label: 'Adresse' },
      { name: 'postal_code', label: 'Code postal', half: true, inputmode: 'numeric' },
      { name: 'city', label: 'Ville', half: true },
      { name: 'country', label: 'Pays', type: 'select', options: { FR: 'France', CH: 'Suisse' }, half: true },
      { name: 'source', label: 'Origine du contact', type: 'select', options: SOURCES, empty: '—', half: true },
      { name: 'status', label: 'Statut', type: 'select', options: Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])), half: true }
    ];
    if (S.isAdmin()) f.push({ name: 'assigned_to', label: 'Technicien référent', type: 'select', options: Object.fromEntries(technicians().map((p) => [p.id, p.full_name])), empty: 'Aucun', nullable: true, half: true });
    return f.concat([
      { section: 'Installation de chauffage' },
      { name: 'heating_type', label: 'Énergie', type: 'select', options: HEATING, empty: '—', half: true },
      { name: 'boiler_brand', label: 'Chaudière / PAC (marque, modèle)', half: true },
      { name: 'emitter_type', label: 'Émetteurs', type: 'select', options: EMITTERS, empty: '—', half: true },
      { name: 'radiators_count', label: 'Nombre de radiateurs', type: 'number', half: true, inputmode: 'numeric' },
      { name: 'last_service_date', label: 'Dernier désembouage / entretien', type: 'date', half: true },
      { name: 'service_interval_months', label: 'Rappel entretien tous les', type: 'select', options: { 12: '1 an', 24: '2 ans', 36: '3 ans', 48: '4 ans', 60: '5 ans' }, default: 36, half: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
    ]);
  }

  function editClient(c, preset) {
    openForm({
      title: c ? 'Modifier la fiche' : 'Nouveau prospect / client',
      fields: clientFields(),
      values: c || Object.assign({ status: 'nouveau', country: 'FR', type: 'particulier' }, preset || {}),
      onSubmit: async (v) => {
        v.radiators_count = v.radiators_count == null ? null : Math.round(v.radiators_count);
        v.service_interval_months = Number(v.service_interval_months) || 36;
        if (c) {
          const old = c.status;
          await S.update('clients', c.id, v);
          if (old !== v.status) await logActivity(c.id, 'statut', 'Statut : ' + STATUS[old].label + ' → ' + STATUS[v.status].label);
          toast('Fiche mise à jour');
        } else {
          v.created_by = S.user.id;
          const row = await S.insert('clients', v);
          toast('Fiche créée');
          location.hash = '#/clients/' + row.id;
        }
      },
      onDelete: c && S.isAdmin() ? async () => { await S.remove('clients', c.id); toast('Fiche supprimée'); location.hash = '#/clients'; } : null
    });
  }

  function editAppointment(a, preset) {
    const clients = S.data.clients.slice().sort((x, y) => x.name.localeCompare(y.name, 'fr'));
    if (!a && !clients.length) { toast("Créez d'abord une fiche client.", true); return; }
    const fields = [
      { name: 'client_id', label: 'Client', type: 'select', options: Object.fromEntries(clients.map((c) => [c.id, c.name + (c.city ? ' — ' + c.city : '')])), required: true, empty: 'Choisir…' },
      { name: 'type', label: "Type d'intervention", type: 'select', options: APPT_TYPES, half: true },
      { name: 'status', label: 'Statut', type: 'select', options: Object.fromEntries(Object.entries(APPT_STATUS).map(([k, v]) => [k, v.label])), half: true },
      { name: 'start_at', label: 'Date et heure', type: 'datetime-local', required: true, half: true },
      { name: 'duration_min', label: 'Durée', type: 'select', options: DURATIONS, half: true }
    ];
    if (S.isAdmin()) fields.push({ name: 'technician_id', label: 'Technicien', type: 'select', options: Object.fromEntries(technicians().map((p) => [p.id, p.full_name])) });
    if (S.isAdmin()) fields.push({ name: 'amount_due', label: 'Montant à encaisser sur place (€ TTC)', type: 'number', step: '0.01', inputmode: 'decimal', hint: 'Pré-rempli pour le technicien au moment d’encaisser.' });
    fields.push({ name: 'notes', label: 'Consignes / matériel à prévoir', type: 'textarea', rows: 3 });
    const def = new Date(); def.setDate(def.getDate() + 1); def.setHours(9, 0, 0, 0);
    openForm({
      title: a ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
      fields,
      values: a || Object.assign({ type: 'visite', status: 'planifie', start_at: def.toISOString(), duration_min: 60, technician_id: S.user.id }, preset || {}),
      onSubmit: async (v) => {
        v.duration_min = Number(v.duration_min);
        if (a) { await S.update('appointments', a.id, v); toast('Rendez-vous mis à jour'); }
        else {
          if (!v.technician_id) v.technician_id = S.user.id;
          const row = await S.insert('appointments', v);
          await logActivity(v.client_id, 'note', 'RDV planifié : ' + APPT_TYPES[v.type] + ' le ' + fmtDate(v.start_at) + ' à ' + fmtTime(v.start_at));
          const c = client(v.client_id);
          if (c && c.status === 'nouveau') await setClientStatus(c, 'contacte', 'RDV planifié');
          toast('Rendez-vous créé');
          location.hash = '#/rdv/' + row.id;
        }
      },
      onDelete: a && S.isAdmin() ? async () => { await S.remove('appointments', a.id); toast('Rendez-vous supprimé'); location.hash = '#/agenda'; } : null
    });
  }

  function editQuote(q, clientId) {
    openForm({
      title: q ? 'Modifier le devis' : 'Ajouter un devis',
      fields: [
        { name: 'reference', label: 'N° de devis (Tolteck)', half: true, placeholder: 'D-2026-0001' },
        { name: 'amount', label: 'Montant TTC (€)', type: 'number', step: '0.01', half: true, inputmode: 'decimal' },
        { name: 'sent_date', label: "Date d'envoi", type: 'date', half: true },
        { name: 'status', label: 'Statut', type: 'select', options: Object.fromEntries(Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label])), half: true },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
      ].concat(q && q.sign_status === 'signe' ? [] : [{
        name: 'pdf', label: q && q.pdf_path ? 'Remplacer le PDF du devis' : 'PDF du devis (export Tolteck)', type: 'file', accept: 'application/pdf',
        hint: 'Nécessaire pour la signature électronique par le client.'
      }]),
      values: q || { sent_date: ymd(new Date()), status: 'envoye' },
      onSubmit: async (v) => {
        const cid = q ? q.client_id : clientId;
        const c = client(cid);
        const pdf = v.pdf;
        delete v.pdf;
        let row;
        if (q) row = await S.update('quotes', q.id, v);
        else {
          v.client_id = cid;
          row = await S.insert('quotes', v);
          await logActivity(cid, 'email', 'Devis ' + (v.reference || '') + ' envoyé (' + fmtMoney(v.amount) + ')');
        }
        if (pdf) row = await S.uploadQuotePdf(row, pdf);
        if (v.status === 'accepte') await setClientStatus(c, 'client', 'devis accepté');
        else if (v.status === 'envoye' && ['nouveau', 'contacte'].includes(c.status)) await setClientStatus(c, 'devis');
        else if (v.status === 'refuse' && c.status === 'devis' && !S.data.quotes.some((x) => x.client_id === cid && x.status === 'envoye')) await setClientStatus(c, 'perdu', 'devis refusé');
        toast('Devis enregistré');
        return row;
      },
      after: (row) => { if (row && row.pdf_path && row.sign_status === 'aucune' && pdfChanged(q, row)) quoteSheet(row); },
      onDelete: q ? async () => { await S.remove('quotes', q.id); toast('Devis supprimé'); } : null
    });
  }
  const pdfChanged = (before, after) => !before || before.doc_hash !== after.doc_hash;

  // ---------------------------------------------------------------- signature électronique
  const signUrl = (q) => location.origin + location.pathname.replace(/index\.html$/, '') + 'signer.html?t=' + q.sign_token;

  function signBadge(q) {
    if (q.sign_status === 'signe') return '<span class="badge" style="--c:#1f9d55">Signé</span>';
    if (q.sign_status === 'envoye') return '<span class="badge" style="--c:#7c5cc4">En signature</span>';
    return '';
  }

  async function downloadSignedQuote(q) {
    const c = client(q.client_id) || {};
    const bytes = await S.getQuotePdf(q.pdf_path);
    const out = await window.SignedPdf.build(bytes, Object.assign({}, q, { client_name: c.name, company_name: company().name }));
    window.SignedPdf.download(out, 'Devis-' + (q.reference || 'signe').replace(/[^\w-]+/g, '_') + '-signe.pdf');
  }

  async function openQuotePdf(q) {
    const bytes = await S.getQuotePdf(q.pdf_path);
    window.open(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), '_blank');
  }

  function quoteSheet(q) {
    q = S.data.quotes.find((x) => x.id === q.id) || q;
    const c = client(q.client_id) || { name: 'Client', country: 'FR' };
    let body = '<div class="pay-head"><span class="pay-amount">' + esc(fmtMoney(q.amount)) + '</span><span class="muted">Devis ' + esc(q.reference || '(sans numéro)') + ' · ' + esc(c.name) + '</span>' +
      '<span class="small muted">' + badge(QUOTE_STATUS, q.status) + ' ' + signBadge(q) + '</span></div>';

    if (q.sign_status === 'signe') {
      body += '<div class="pay-done">✓ Signé par ' + esc(q.signer_name) + ' le ' + esc(fmt(q.signed_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</div>' +
        '<div class="pay-actions"><button class="btn btn-primary" data-q="signed">Télécharger le devis signé (PDF)</button></div>';
    } else if (!q.pdf_path) {
      body += '<p class="muted center">Ajoutez le PDF du devis (export Tolteck) pour pouvoir le faire signer en ligne.</p>' +
        '<div class="pay-actions"><button class="btn btn-primary" data-q="edit">Ajouter le PDF</button></div>';
    } else if (q.sign_status === 'aucune') {
      body += '<p class="center">Le client recevra un lien pour <b>lire et signer le devis</b> sur son téléphone. Le lien est valable 30 jours.</p>' +
        '<div class="pay-actions"><button class="btn btn-primary btn-lg" data-q="send">Envoyer pour signature</button></div>';
    } else {
      const url = signUrl(q);
      const sms = 'Bonjour ' + c.name + ', voici votre devis ' + (q.reference || '') + ' (' + fmtMoney(q.amount) + ') à consulter et signer en ligne : ' + url + ' ' + company().name;
      const expired = q.sign_expires_at && new Date(q.sign_expires_at) < new Date();
      body += (expired ? '<p class="error">Le lien a expiré le ' + esc(fmtDate(q.sign_expires_at)) + '.</p><div class="pay-actions"><button class="btn btn-primary" data-q="send">Renouveler le lien (30 jours)</button></div>'
        : '<p class="center muted small">Envoyé ' + esc(relTime(q.sign_sent_at)) + ' · lien valable jusqu\'au ' + esc(fmtDate(q.sign_expires_at)) + '</p>' +
          '<div class="pay-actions">' +
          (c.phone ? '<a class="btn btn-ghost" href="' + esc(smsUrl(c, sms)) + '" data-q="log-sms">' + icon('sms') + 'Envoyer par SMS</a>' : '') +
          (c.email ? '<a class="btn btn-ghost" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent('Votre devis ' + (q.reference || '') + ' — ' + company().name) + '&body=' + encodeURIComponent(sms) + '">' + icon('mail') + 'Par e-mail</a>' : '') +
          '<button class="btn btn-ghost" data-q="copy">' + icon('copy') + 'Copier le lien</button>' +
          '<a class="btn btn-ghost" href="' + esc(url) + '" target="_blank" rel="noopener">Voir la page client</a></div>' +
          '<div class="pay-status"><span class="dot"></span>En attente de signature…</div>');
    }
    body += '<div class="pay-admin">' + (q.pdf_path ? '<button class="btn btn-ghost btn-sm" data-q="pdf">Voir le PDF d\'origine</button>' : '') +
      '<button class="btn btn-ghost btn-sm" data-q="edit">' + icon('edit') + 'Modifier le devis</button></div>';

    openSheet('Devis', body, (root) => {
      const on = (k, fn) => root.querySelectorAll('[data-q=' + k + ']').forEach((b) => b.addEventListener('click', fn));
      on('edit', () => { closeModal(); editQuote(q); });
      on('pdf', () => guard(() => openQuotePdf(q)));
      on('signed', (e) => { e.target.disabled = true; guard(() => downloadSignedQuote(q)).finally(() => { e.target.disabled = false; }); });
      on('copy', () => navigator.clipboard.writeText(signUrl(q)).then(() => toast('Lien copié'), () => toast('Copie impossible', true)));
      on('log-sms', () => logActivity(q.client_id, 'sms', 'Lien de signature du devis ' + (q.reference || '') + ' envoyé par SMS').catch(() => {}));
      on('send', async () => {
        const now = new Date();
        const row = await guard(() => S.update('quotes', q.id, { sign_status: 'envoye', sign_sent_at: now.toISOString(), sign_expires_at: addDays(now, 30).toISOString(), status: 'envoye' }));
        await logActivity(q.client_id, 'note', 'Devis ' + (q.reference || '') + ' envoyé pour signature électronique');
        const cl = client(q.client_id);
        if (cl && ['nouveau', 'contacte'].includes(cl.status)) await setClientStatus(cl, 'devis');
        render(); quoteSheet(row);
      });
    });

    // Le client signe pendant que la fenêtre est ouverte : on le voit tout de suite.
    if (q.sign_status === 'envoye') {
      clearInterval(pollTimer);
      modal.dataset.payment = 'q-' + q.id;
      pollTimer = setInterval(async () => {
        if (!modal.open || modal.dataset.payment !== 'q-' + q.id) { clearInterval(pollTimer); return; }
        try {
          const row = await S.refresh('quotes', q.id);
          if (row.sign_status === 'signe') { clearInterval(pollTimer); await S.loadAll(); render(); quoteSheet(row); toast('Devis signé !'); }
        } catch (e) { /* réseau */ }
      }, 5000);
    }
  }

  // Fenêtre « Envoyer un SMS » : choix d'un modèle, ouvre l'appli SMS du téléphone.
  function smsSheet(c, ctx, preferred) {
    if (!c.phone) { toast("Aucun numéro de téléphone sur cette fiche.", true); return; }
    const tpls = templates();
    const keys = ctx.payment ? [preferred] : Object.keys(tpls).filter((k) => !PAYMENT_TEMPLATES.includes(k)).sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));
    const items = keys.map((k) => {
      const text = fillTemplate(tpls[k].text, Object.assign({ client: c }, ctx));
      return '<div class="sms-item' + (k === preferred ? ' sms-preferred' : '') + '"><div class="sms-label">' + esc(tpls[k].label) + '</div>' +
        '<p class="sms-text">' + esc(text) + '</p><div class="sms-actions">' +
        '<a class="btn btn-primary btn-sm" href="' + esc(smsUrl(c, text)) + '" data-sms="' + esc(k) + '">' + icon('sms') + 'Ouvrir dans Messages</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + esc(k) + '">' + icon('copy') + 'Copier</button></div></div>';
    }).join('');
    const free = '<div class="sms-item"><div class="sms-label">Message libre</div><a class="btn btn-ghost btn-sm" href="' + esc(smsUrl(c, '')) + '" data-sms="libre">' + icon('sms') + 'Écrire un SMS</a></div>';
    openSheet('SMS à ' + c.name, '<p class="muted small">Le SMS s\'ouvre dans l\'application Messages de votre téléphone, prêt à être envoyé.</p>' + items + free, (root) => {
      root.querySelectorAll('[data-sms]').forEach((a) => a.addEventListener('click', () => {
        const k = a.dataset.sms;
        logActivity(c.id, 'sms', k === 'libre' ? 'SMS envoyé' : 'SMS « ' + tpls[k].label + ' » envoyé').then(() => { setTimeout(() => { closeModal(); render(); }, 400); });
      }));
      root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
        const text = fillTemplate(tpls[b.dataset.copy].text, Object.assign({ client: c }, ctx));
        navigator.clipboard.writeText(text).then(() => toast('Texte copié'), () => toast('Copie impossible', true));
      }));
    });
  }

  // ================================================================ paiements
  function qrSvg(text) {
    if (!window.qrcode) return '<p class="muted small">QR code indisponible (connexion internet nécessaire).</p>';
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }

  // QR code « virement SEPA » (norme EPC) : lisible par certaines applications bancaires.
  function epcPayload(bank, p) {
    return ['BCD', '002', '1', 'SCT', (bank.bic || '').replace(/\s/g, ''), (bank.holder || '').slice(0, 70),
      bank.iban.replace(/\s/g, '').toUpperCase(), 'EUR' + Number(p.amount).toFixed(2), '', '', (p.reference + ' ' + p.description).slice(0, 140)].join('\n');
  }

  function ibanValid(iban) {
    const s = String(iban || '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
    const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let mod = 0;
    for (const d of digits) mod = (mod * 10 + Number(d)) % 97;
    return mod === 1;
  }

  const newReference = () => 'AD-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const paidTotal = (clientId) => S.data.payments.filter((p) => p.client_id === clientId && p.status === 'paye').reduce((s, p) => s + Number(p.amount), 0);

  // Montant proposé : devis accepté du client, moins ce qui est déjà payé (le technicien ne voit pas les devis).
  function suggestedAmount(c) {
    const q = S.data.quotes.filter((x) => x.client_id === c.id && x.status === 'accepte' && x.amount).sort((a, b) => String(b.sent_date).localeCompare(String(a.sent_date)))[0];
    if (!q) return null;
    const rest = Number(q.amount) - paidTotal(c.id);
    return rest > 0 ? Math.round(rest * 100) / 100 : null;
  }

  function collectPayment(c, appt) {
    const methods = S.isAdmin() ? { carte: 'Carte bancaire (QR code / lien)', virement: 'Virement bancaire', cheque: 'Chèque reçu', especes: 'Espèces reçues' }
      : { carte: 'Carte bancaire (QR code / lien)', virement: 'Virement bancaire' };
    openForm({
      title: 'Encaisser — ' + c.name,
      fields: [
        { name: 'amount', label: 'Montant TTC (€)', type: 'number', step: '0.01', required: true, inputmode: 'decimal', half: true },
        { name: 'method', label: 'Moyen de paiement', type: 'select', options: methods, half: true },
        { name: 'description', label: 'Libellé (visible par le client)', required: true }
      ],
      values: { amount: (appt && appt.amount_due) || suggestedAmount(c), method: 'carte', description: (appt ? APPT_TYPES[appt.type] : 'Intervention') + ' — ' + c.name },
      submitLabel: 'Continuer',
      onSubmit: async (v) => {
        if (!(v.amount > 0)) throw new Error('Montant invalide.');
        let p = await S.insert('payments', {
          client_id: c.id, appointment_id: appt ? appt.id : null, amount: Math.round(v.amount * 100) / 100, description: v.description,
          method: v.method, status: 'en_attente', reference: newReference(), created_by: S.user.id
        });
        if (v.method === 'cheque' || v.method === 'especes') {
          p = await markPaid(p, v.method);
        } else {
          await logActivity(c.id, 'note', 'Demande de paiement (' + PAY_METHODS[v.method] + ') : ' + fmtMoney2(p.amount) + ' — réf. ' + p.reference);
          if (v.method === 'carte') p = await S.createCardLink(p.id);
        }
        return p;
      },
      after: (p) => { if (p && p.status === 'en_attente') paymentSheet(p); else toast('Paiement enregistré'); }
    });
  }

  async function markPaid(p, method) {
    const row = await S.update('payments', p.id, { status: 'paye', method, paid_at: new Date().toISOString() });
    await logActivity(p.client_id, 'note', 'Paiement reçu (' + PAY_METHODS[method].toLowerCase() + ') : ' + fmtMoney2(p.amount) + ' — ' + p.description);
    return row;
  }

  let pollTimer = null;
  function paymentSheet(p) {
    clearInterval(pollTimer);
    const c = client(p.client_id) || { name: 'Client', country: 'FR' };
    const bank = S.data.settings.bank || {};
    const head = '<div class="pay-head"><span class="pay-amount">' + esc(fmtMoney2(p.amount)) + '</span><span class="muted">' + esc(p.description) + '</span>' +
      '<span class="small muted">Réf. ' + esc(p.reference) + ' · ' + esc(PAY_METHODS[p.method]) + ' · ' + badge(PAY_STATUS, p.status) + '</span></div>';
    let body = head;
    const tpls = templates();

    if (p.status === 'paye') {
      body += '<div class="pay-done">✓ Payé le ' + esc(fmt(p.paid_at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '</div>';
    } else if (p.status === 'annule') {
      body += empty('Ce paiement a été annulé.');
    } else if (p.method === 'carte') {
      const expired = p.created_at && Date.now() - new Date(p.created_at).getTime() > 22 * 3600000 && S.mode === 'supabase';
      if (!p.checkout_url || expired) {
        body += '<p class="muted">' + (expired ? 'Le lien de paiement a expiré (24 h).' : "Le lien de paiement n'a pas encore été créé.") + '</p>' +
          '<button class="btn btn-primary btn-lg" data-p="regen">Créer un nouveau lien</button>';
      } else {
        const sms = fillTemplate(tpls.paiement.text, { client: c, payment: p });
        body += '<div class="qr">' + qrSvg(p.checkout_url) + '</div>' +
          '<p class="center">Faites scanner ce QR code au client avec l\'appareil photo de son téléphone.<br><span class="muted small">Carte bancaire, Apple Pay ou Google Pay.</span></p>' +
          '<div class="pay-status" id="pay-status"><span class="dot"></span>En attente du paiement…</div>' +
          '<div class="pay-actions">' +
          (c.phone ? '<a class="btn btn-ghost" href="' + esc(smsUrl(c, sms)) + '" data-p="log-sms">' + icon('sms') + 'Envoyer par SMS</a>' : '') +
          (c.email ? '<a class="btn btn-ghost" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent('Votre paiement — ' + company().name) + '&body=' + encodeURIComponent(sms) + '">' + icon('mail') + 'Par e-mail</a>' : '') +
          '<button class="btn btn-ghost" data-p="copy" data-text="' + esc(p.checkout_url) + '">' + icon('copy') + 'Copier le lien</button>' +
          '<a class="btn btn-ghost" href="' + esc(p.checkout_url) + '" target="_blank" rel="noopener">Ouvrir sur ce téléphone</a></div>' +
          (S.mode === 'demo' ? '<p class="muted small center">Démo : cliquez sur « Ouvrir sur ce téléphone » pour simuler le paiement du client.</p>' : '');
      }
    } else if (p.method === 'virement') {
      if (!bank.iban) {
        body += '<p class="error">Aucun IBAN enregistré. ' + (S.isAdmin() ? 'Renseignez-le dans Réglages → Coordonnées bancaires.' : 'Demandez au gérant de le renseigner.') + '</p>';
      } else {
        const sms = fillTemplate(tpls.virement.text, { client: c, payment: p });
        body += '<div class="infos bank"><div class="info"><span>Titulaire</span><b>' + esc(bank.holder) + '</b></div><div class="info"><span>IBAN</span><b>' + esc(bank.iban) + '</b></div>' +
          '<div class="info"><span>BIC</span><b>' + esc(bank.bic) + '</b></div><div class="info"><span>Référence</span><b>' + esc(p.reference) + '</b></div></div>' +
          '<div class="qr qr-sm">' + qrSvg(epcPayload(bank, p)) + '</div><p class="center muted small">QR code de virement : lisible par certaines applications bancaires.</p>' +
          '<div class="pay-actions">' +
          (c.phone ? '<a class="btn btn-ghost" href="' + esc(smsUrl(c, sms)) + '" data-p="log-sms">' + icon('sms') + 'Envoyer par SMS</a>' : '') +
          (c.email ? '<a class="btn btn-ghost" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent('Règlement par virement — ' + company().name) + '&body=' + encodeURIComponent(sms) + '">' + icon('mail') + 'Par e-mail</a>' : '') +
          '<button class="btn btn-ghost" data-p="copy" data-text="' + esc(sms) + '">' + icon('copy') + 'Copier</button></div>';
      }
    }

    if (S.isAdmin() && p.status === 'en_attente') {
      body += '<div class="pay-admin"><span class="muted small">Paiement reçu autrement ?</span>' +
        ['virement', 'cheque', 'especes', 'carte'].map((m) => '<button class="btn btn-ghost btn-sm" data-p="paid" data-m="' + m + '">' + esc(PAY_METHODS[m]) + ' reçu</button>').join('') +
        '<button class="btn btn-danger-ghost btn-sm" data-p="cancel">Annuler la demande</button></div>';
    }

    openSheet('Paiement', body, (root) => {
      root.dataset.payment = p.id;
      root.querySelectorAll('[data-p=copy]').forEach((b) => b.addEventListener('click', () => navigator.clipboard.writeText(b.dataset.text).then(() => toast('Copié'), () => toast('Copie impossible', true))));
      root.querySelectorAll('[data-p=log-sms]').forEach((a) => a.addEventListener('click', () => logActivity(p.client_id, 'sms', 'SMS de paiement envoyé (' + fmtMoney2(p.amount) + ')').catch(() => {})));
      const regen = $('[data-p=regen]', root);
      if (regen) regen.addEventListener('click', async () => {
        regen.disabled = true;
        try { paymentSheet(await guard(() => S.createCardLink(p.id))); } catch (e) { regen.disabled = false; }
      });
      root.querySelectorAll('[data-p=paid]').forEach((b) => b.addEventListener('click', async () => {
        const row = await guard(() => markPaid(p, b.dataset.m));
        toast('Paiement enregistré'); render(); paymentSheet(row);
      }));
      const cancel = $('[data-p=cancel]', root);
      if (cancel) cancel.addEventListener('click', async () => {
        if (cancel.dataset.confirm !== '1') { cancel.dataset.confirm = '1'; cancel.textContent = "Confirmer l'annulation ?"; return; }
        await guard(() => S.update('payments', p.id, { status: 'annule' }));
        closeModal(); render();
      });
    });

    // Suivi en direct : dès que Stripe confirme le paiement, la fenêtre l'affiche.
    if (p.status === 'en_attente' && p.method === 'carte' && p.checkout_url) {
      pollTimer = setInterval(async () => {
        if (!modal.open || modal.dataset.payment !== p.id) { clearInterval(pollTimer); return; }
        try {
          const row = await S.refresh('payments', p.id);
          if (row.status === 'paye') {
            clearInterval(pollTimer);
            if (S.mode === 'supabase') await S.loadAll();
            render(); paymentSheet(row); toast('Paiement reçu !');
          }
        } catch (e) { /* réseau momentanément indisponible */ }
      }, 4000);
    }
  }

  function paymentsList(list) {
    return '<div class="list">' + list.map((p) =>
      '<button class="row" data-action="open-payment" data-id="' + p.id + '"><div class="row-main"><div class="row-title">' + esc(fmtMoney2(p.amount)) + ' · ' + esc(PAY_METHODS[p.method]) + '</div>' +
      '<div class="row-sub">' + esc(p.description) + ' · ' + esc(p.status === 'paye' ? 'payé ' + relTime(p.paid_at) : 'demandé ' + relTime(p.created_at)) + '</div></div>' + badge(PAY_STATUS, p.status) + '</button>').join('') + '</div>';
  }

  // Page de paiement simulée (mode démo uniquement) : imite ce que le client voit sur Stripe.
  function viewDemoCheckout(id) {
    const p = S.data.payments.find((x) => x.id === id);
    if (!p) return empty('Paiement introuvable.');
    const done = p.status === 'paye';
    return '<div class="demo-checkout"><div class="dc-card"><p class="muted small">Démo — page de paiement que verra le client</p>' +
      '<h2>' + esc(company().name) + '</h2><p>' + esc(p.description) + '</p><div class="pay-amount">' + esc(fmtMoney2(p.amount)) + '</div>' +
      (done ? '<div class="pay-done">✓ Paiement accepté</div><a class="btn btn-ghost" href="#/">Retour au CRM</a>'
        : '<div class="dc-fake"><span>Numéro de carte</span><b>4242 4242 4242 4242</b><span>Expiration / CVC</span><b>12/30 · 123</b></div>' +
          '<button class="btn btn-primary btn-lg" data-action="demo-pay" data-id="' + p.id + '">Payer ' + esc(fmtMoney2(p.amount)) + '</button>') +
      '</div></div>';
  }

  // ================================================================ composants
  function contactButtons(c, ctx) {
    const b = [];
    if (c.phone) {
      b.push('<a class="action" href="tel:' + esc(intlPhone(c.phone, c.country)) + '" data-log="appel" data-client="' + c.id + '">' + icon('phone') + '<span>Appeler</span></a>');
      b.push('<button class="action" data-action="sms" data-client="' + c.id + '"' + (ctx && ctx.appt ? ' data-appt="' + ctx.appt.id + '"' : '') + '>' + icon('sms') + '<span>SMS</span></button>');
    }
    if (c.email) b.push('<a class="action" href="mailto:' + esc(c.email) + '">' + icon('mail') + '<span>E-mail</span></a>');
    if (c.address || c.city) {
      b.push('<a class="action" href="' + esc(mapsUrl(c)) + '" target="_blank" rel="noopener">' + icon('nav') + '<span>Maps</span></a>');
      b.push('<a class="action" href="' + esc(wazeUrl(c)) + '" target="_blank" rel="noopener">' + icon('pin') + '<span>Waze</span></a>');
    }
    return b.length ? '<div class="actions">' + b.join('') + '</div>' : '';
  }

  function apptRow(a, opts) {
    const c = client(a.client_id) || { name: 'Client inconnu' };
    const tech = profile(a.technician_id);
    const showDate = opts && opts.showDate;
    return '<a class="appt' + (a.status === 'annule' ? ' appt-cancel' : '') + '" href="#/rdv/' + a.id + '" style="--tc:' + (tech ? tech.color : '#5a6472') + '">' +
      '<div class="appt-time">' + (showDate ? '<b>' + esc(fmt(a.start_at, { day: 'numeric', month: 'short' })) + '</b>' : '') + esc(fmtTime(a.start_at)) + '</div>' +
      '<div class="appt-main"><div class="appt-title">' + esc(c.name) + '</div>' +
      '<div class="appt-sub">' + esc(APPT_TYPES[a.type]) + (c.city ? ' · ' + esc(c.city) : '') + (S.isAdmin() && tech ? ' · ' + esc(tech.full_name) : '') + '</div></div>' +
      badge(APPT_STATUS, a.status) + '</a>';
  }

  function clientRow(c) {
    return '<a class="row" href="#/clients/' + c.id + '"><div class="avatar" style="--c:' + STATUS[c.status].color + '">' + esc(c.name.trim().charAt(0).toUpperCase()) + '</div>' +
      '<div class="row-main"><div class="row-title">' + esc(c.name) + '</div><div class="row-sub">' + esc([c.city, c.phone].filter(Boolean).join(' · ')) + '</div></div>' +
      badge(STATUS, c.status) + '</a>';
  }

  const empty = (text) => '<p class="empty">' + esc(text) + '</p>';
  const card = (title, body, action) => '<section class="card"><header class="card-head"><h3>' + title + '</h3>' + (action || '') + '</header>' + body + '</section>';
  const pageHead = (title, sub, actions, back) =>
    '<header class="page-head">' + (back ? '<a class="icon-btn back" href="' + back + '" aria-label="Retour">' + icon('back') + '</a>' : '') +
    '<div class="page-title"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions || '') + '</header>';

  // ================================================================ vues
  function viewDashboard() {
    const now = new Date();
    const today = S.data.appointments.filter((a) => sameDay(new Date(a.start_at), now) && a.status !== 'annule').sort((a, b) => a.start_at.localeCompare(b.start_at));
    const upcoming = S.data.appointments.filter((a) => new Date(a.start_at) > now && !sameDay(new Date(a.start_at), now) && a.status !== 'annule')
      .sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 6);
    const hello = 'Bonjour ' + esc(S.user.full_name.replace(/\s*\(.*\)$/, ''));
    const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    let html = pageHead(hello, date.charAt(0).toUpperCase() + date.slice(1));

    if (S.isAdmin()) {
      const prospects = S.data.clients.filter((c) => c.status === 'nouveau' || c.status === 'contacte');
      const pending = S.data.quotes.filter((q) => q.status === 'envoye');
      const decided = S.data.quotes.filter((q) => q.status !== 'envoye');
      const won = decided.filter((q) => q.status === 'accepte');
      const weekStart = startOfWeek(now), weekEnd = addDays(weekStart, 7);
      const week = S.data.appointments.filter((a) => { const d = new Date(a.start_at); return d >= weekStart && d < weekEnd && a.status !== 'annule'; });
      html += '<div class="kpis">' +
        kpi('Prospects actifs', prospects.length, '#/pipeline') +
        kpi('Devis en attente', pending.length, '#/pipeline', fmtMoney(pending.reduce((s, q) => s + Number(q.amount || 0), 0))) +
        kpi('Taux de signature', decided.length ? Math.round((won.length / decided.length) * 100) + ' %' : '—', '#/pipeline', won.length + ' / ' + decided.length + ' devis') +
        kpi('RDV cette semaine', week.length, '#/agenda') + '</div>';
    }

    html += '<div class="grid-2">';
    html += card("Aujourd'hui", today.length ? '<div class="list">' + today.map((a) => apptRow(a)).join('') + '</div>' : empty('Aucun rendez-vous aujourd\'hui.'),
      S.isAdmin() ? '<button class="btn btn-ghost btn-sm" data-action="new-appt">' + icon('plus') + 'RDV</button>' : '');
    html += card('Prochains rendez-vous', upcoming.length ? '<div class="list">' + upcoming.map((a) => apptRow(a, { showDate: true })).join('') + '</div>' : empty('Rien de prévu pour le moment.'),
      '<a class="link" href="#/agenda">Agenda</a>');

    if (S.isAdmin()) {
      const toFollow = S.data.quotes.filter((q) => q.status === 'envoye' && q.sent_date && daysSince(q.sent_date) >= 7)
        .sort((a, b) => a.sent_date.localeCompare(b.sent_date));
      html += card('Devis à relancer', toFollow.length ? '<div class="list">' + toFollow.map((q) => {
        const c = client(q.client_id);
        return '<div class="row"><a class="row-main" href="#/clients/' + c.id + '"><div class="row-title">' + esc(c.name) + '</div>' +
          '<div class="row-sub">' + esc(q.reference || 'Devis') + ' · ' + fmtMoney(q.amount) + ' · envoyé ' + relTime(q.sent_date) + '</div></a>' +
          '<button class="btn btn-ghost btn-sm" data-action="sms-quote" data-quote="' + q.id + '">' + icon('sms') + 'Relancer</button></div>';
      }).join('') + '</div>' : empty('Aucun devis en attente depuis plus de 7 jours.'));

      const soon = addDays(now, 45);
      const services = S.data.clients.map((c) => ({ c, d: nextService(c) })).filter((x) => x.d && x.d <= soon && x.c.status === 'client')
        .filter((x) => !S.data.appointments.some((a) => a.client_id === x.c.id && new Date(a.start_at) > now && a.status !== 'annule'))
        .sort((a, b) => a.d - b.d);
      html += card('Entretiens à prévoir', services.length ? '<div class="list">' + services.map((x) =>
        '<div class="row"><a class="row-main" href="#/clients/' + x.c.id + '"><div class="row-title">' + esc(x.c.name) + '</div>' +
        '<div class="row-sub">Dernier passage : ' + fmtDate(x.c.last_service_date) + ' · ' + (x.d < now ? '<b class="warn">en retard</b>' : 'prévu ' + fmtDate(ymd(x.d))) + '</div></a>' +
        '<button class="btn btn-ghost btn-sm" data-action="sms-service" data-client="' + x.c.id + '">' + icon('sms') + 'Proposer</button></div>').join('') + '</div>'
        : empty('Aucun entretien à prévoir dans les 45 prochains jours.'));

      const due = S.data.payments.filter((p) => p.status === 'en_attente').sort((a, b) => a.created_at.localeCompare(b.created_at));
      const doneNoPay = S.data.appointments.filter((a) => a.status === 'termine' && daysSince(a.start_at) <= 60 && !S.data.payments.some((p) => p.appointment_id === a.id && p.status !== 'annule'));
      html += card('À encaisser' + (due.length ? ' <span class="muted small">· ' + esc(fmtMoney2(due.reduce((s, p) => s + Number(p.amount), 0))) + '</span>' : ''),
        (due.length ? paymentsList(due) : '') +
        (doneNoPay.length ? '<p class="muted small pad">Interventions terminées sans paiement enregistré :</p><div class="list">' + doneNoPay.map((a) => apptRow(a, { showDate: true })).join('') + '</div>' : '') +
        (!due.length && !doneNoPay.length ? empty('Tout est encaissé.') : ''));

      const recent = S.data.clients.filter((c) => c.status === 'nouveau').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
      html += card('Nouveaux prospects', recent.length ? '<div class="list">' + recent.map(clientRow).join('') + '</div>' : empty('Aucun nouveau prospect.'),
        '<button class="btn btn-ghost btn-sm" data-action="new-client">' + icon('plus') + 'Prospect</button>');
    }
    html += '</div>';
    return html;
  }

  const kpi = (label, value, href, sub) => '<a class="kpi" href="' + href + '"><span class="kpi-label">' + esc(label) + '</span><span class="kpi-value">' + esc(value) + '</span>' + (sub ? '<span class="kpi-sub">' + esc(sub) + '</span>' : '') + '</a>';

  function viewAgenda(params) {
    const start = params.get('w') ? startOfWeek(parseYmd(params.get('w'))) : startOfWeek(new Date());
    const techFilter = params.get('t') || '';
    const end = addDays(start, 7);
    const list = S.data.appointments.filter((a) => {
      const d = new Date(a.start_at);
      return d >= start && d < end && (!techFilter || a.technician_id === techFilter);
    }).sort((a, b) => a.start_at.localeCompare(b.start_at));
    const label = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' – ' + addDays(start, 6).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const q = (w, t) => '#/agenda?w=' + ymd(w) + (t ? '&t=' + t : '');

    let html = pageHead('Agenda', label, S.isAdmin() ? '<button class="btn btn-primary" data-action="new-appt">' + icon('plus') + '<span class="hide-sm">Nouveau RDV</span></button>' : '');
    html += '<div class="toolbar"><div class="seg">' +
      '<a class="icon-btn" href="' + q(addDays(start, -7), techFilter) + '" aria-label="Semaine précédente">' + icon('chevL') + '</a>' +
      '<a class="btn btn-ghost btn-sm" href="' + q(new Date(), techFilter) + '">Cette semaine</a>' +
      '<a class="icon-btn" href="' + q(addDays(start, 7), techFilter) + '" aria-label="Semaine suivante">' + icon('chevR') + '</a></div>';
    if (S.isAdmin() && technicians().length > 1) {
      html += '<select class="select-sm" data-action="agenda-tech" data-week="' + ymd(start) + '"><option value="">Toute l\'équipe</option>' +
        technicians().map((p) => '<option value="' + p.id + '"' + (techFilter === p.id ? ' selected' : '') + '>' + esc(p.full_name) + '</option>').join('') + '</select>';
    }
    html += '</div>';
    if (!list.length && new Date(ymd(addDays(start, 6)) + 'T23:59') < new Date()) return html + '<section class="card">' + empty('Aucun rendez-vous cette semaine-là.') + '</section>';
    html += '<div class="week">';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const items = list.filter((a) => sameDay(new Date(a.start_at), d));
      const isToday = sameDay(d, new Date());
      const isPast = new Date(ymd(d) + 'T23:59') < new Date();
      if (!items.length && !isToday && (i >= 5 || isPast)) continue; // jours vides passés et week-end vide masqués
      html += '<div class="day' + (isToday ? ' today' : '') + (isPast ? ' past' : '') + '">' +
        '<div class="day-head"><span>' + esc(fmtDay(d)) + '</span>' +
        (S.isAdmin() ? '<button class="icon-btn sm" data-action="new-appt-day" data-day="' + ymd(d) + '" aria-label="Ajouter un RDV">' + icon('plus') + '</button>' : '') + '</div>' +
        (items.length ? items.map((a) => apptRow(a)).join('') : '<p class="day-empty">—</p>') + '</div>';
    }
    html += '</div>';
    return html;
  }

  function viewClients(params) {
    const qtxt = (params.get('q') || '').toLowerCase();
    const st = params.get('s') || '';
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const nq = norm(qtxt);
    const list = S.data.clients.filter((c) => (!st || c.status === st) &&
      (!nq || norm([c.name, c.company, c.city, c.phone, c.email, c.postal_code].join(' ')).includes(nq) || String(c.phone || '').replace(/\s/g, '').includes(nq.replace(/\s/g, ''))))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    let html = pageHead('Clients & prospects', S.data.clients.length + ' fiches', '<button class="btn btn-primary" data-action="new-client">' + icon('plus') + '<span class="hide-sm">Nouvelle fiche</span></button>');
    html += '<div class="toolbar wrap"><label class="search">' + icon('search') + '<input type="search" id="client-search" placeholder="Nom, ville, téléphone…" value="' + esc(params.get('q') || '') + '"></label>' +
      '<div class="chips">' + '<a class="chip' + (!st ? ' on' : '') + '" href="#/clients' + (qtxt ? '?q=' + encodeURIComponent(qtxt) : '') + '">Tous</a>' +
      Object.entries(STATUS).map(([k, v]) => '<a class="chip' + (st === k ? ' on' : '') + '" style="--c:' + v.color + '" href="#/clients?s=' + k + (qtxt ? '&q=' + encodeURIComponent(qtxt) : '') + '">' + esc(v.label) + ' <b>' + S.data.clients.filter((c) => c.status === k).length + '</b></a>').join('') + '</div></div>';
    html += '<section class="card flush"><div class="list" id="client-list">' + (list.length ? list.map(clientRow).join('') : empty('Aucune fiche ne correspond.')) + '</div></section>';
    return html;
  }

  function viewClient(id) {
    const c = client(id);
    if (!c) return pageHead('Fiche introuvable', '', '', '#/clients') + empty("Cette fiche n'existe pas ou vous n'y avez pas accès.");
    const appts = S.data.appointments.filter((a) => a.client_id === id).sort((a, b) => b.start_at.localeCompare(a.start_at));
    const quotes = S.data.quotes.filter((q) => q.client_id === id).sort((a, b) => String(b.sent_date).localeCompare(String(a.sent_date)));
    const acts = S.data.activities.filter((a) => a.client_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const ns = nextService(c);
    const info = (label, value) => (value || value === 0 ? '<div class="info"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>' : '');

    let html = pageHead(esc(c.name), (c.company ? esc(c.company) + ' · ' : '') + esc(CLIENT_TYPES[c.type] || ''),
      '<button class="btn btn-ghost" data-action="edit-client" data-client="' + c.id + '">' + icon('edit') + '<span class="hide-sm">Modifier</span></button>', '#/clients');

    html += '<div class="status-bar"><select class="status-select" data-action="client-status" data-client="' + c.id + '" style="--c:' + STATUS[c.status].color + '">' +
      Object.entries(STATUS).map(([k, v]) => '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + esc(v.label) + '</option>').join('') + '</select>' +
      '<span class="muted small">Fiche créée ' + relTime(c.created_at) + (c.source ? ' · ' + esc(c.source) : '') + '</span></div>';
    html += contactButtons(c);

    html += '<div class="grid-2">';
    html += card('Coordonnées', '<div class="infos">' + info('Téléphone', c.phone) + info('E-mail', c.email) + info('Adresse', fullAddress(c)) +
      info('Technicien référent', c.assigned_to && profile(c.assigned_to) ? profile(c.assigned_to).full_name : '') + '</div>' +
      (c.notes ? '<p class="notes">' + esc(c.notes) + '</p>' : ''));
    html += card('Installation', '<div class="infos">' + info('Énergie', c.heating_type) + info('Chaudière / PAC', c.boiler_brand) + info('Émetteurs', c.emitter_type) +
      info('Radiateurs', c.radiators_count) + info('Dernier passage', c.last_service_date ? fmtDate(c.last_service_date) : 'Jamais') +
      (ns ? '<div class="info"><span>Prochain entretien</span><b class="' + (ns < new Date() ? 'warn' : '') + '">' + fmtDate(ymd(ns)) + (ns < new Date() ? ' (en retard)' : '') + '</b></div>' : '') + '</div>');

    html += card('Rendez-vous', appts.length ? '<div class="list">' + appts.map((a) => apptRow(a, { showDate: true })).join('') + '</div>' : empty('Aucun rendez-vous.'),
      S.isAdmin() ? '<button class="btn btn-ghost btn-sm" data-action="new-appt" data-client="' + c.id + '">' + icon('plus') + 'RDV</button>' : '');

    if (S.isAdmin()) {
      html += card('Devis', (quotes.length ? '<div class="list">' + quotes.map((q) =>
        '<button class="row" data-action="open-quote" data-quote="' + q.id + '"><div class="row-main"><div class="row-title">' + esc(q.reference || 'Devis') + ' · ' + fmtMoney(q.amount) + '</div>' +
        '<div class="row-sub">Envoyé le ' + fmtDate(q.sent_date) + (q.notes ? ' · ' + esc(q.notes) : '') + '</div></div>' + signBadge(q) + badge(QUOTE_STATUS, q.status) + '</button>').join('') + '</div>'
        : empty('Aucun devis enregistré.')) + '<p class="muted small pad">Les devis restent créés dans Tolteck : notez ici le numéro et le montant pour le suivi.</p>',
        '<button class="btn btn-ghost btn-sm" data-action="new-quote" data-client="' + c.id + '">' + icon('plus') + 'Devis</button>');
    }

    const pays = S.data.payments.filter((p) => p.client_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    html += card('Paiements' + (pays.some((p) => p.status === 'paye') ? ' <span class="muted small">· ' + esc(fmtMoney2(paidTotal(id))) + ' reçus</span>' : ''),
      pays.length ? paymentsList(pays) : empty('Aucun paiement enregistré.'),
      '<button class="btn btn-ghost btn-sm" data-action="collect" data-client="' + c.id + '">' + icon('card') + 'Encaisser</button>');

    html += '<section class="card span-2"><header class="card-head"><h3>Historique</h3></header>' +
      '<form class="note-form" data-client="' + c.id + '"><select name="type">' +
      ['note', 'appel', 'email', 'visite'].map((k) => '<option value="' + k + '">' + ACT_TYPES[k].label + '</option>').join('') + '</select>' +
      '<input name="content" placeholder="Ajouter une note, un compte-rendu d\'appel…" required><button class="btn btn-primary btn-sm" type="submit">Ajouter</button></form>' +
      (acts.length ? '<ol class="timeline">' + acts.map((a) => {
        const t = ACT_TYPES[a.type] || ACT_TYPES.note, u = profile(a.user_id);
        return '<li style="--c:' + t.color + '"><div class="tl-head"><b>' + esc(t.label) + '</b><span>' + esc(fmt(a.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + (u ? ' · ' + esc(u.full_name) : '') + '</span></div><p>' + esc(a.content) + '</p></li>';
      }).join('') + '</ol>' : empty('Aucun échange enregistré.')) + '</section>';
    html += '</div>';
    return html;
  }

  function viewPipeline() {
    let html = pageHead('Pipeline', 'Glissez une fiche pour changer son statut', '<button class="btn btn-primary" data-action="new-client">' + icon('plus') + '<span class="hide-sm">Nouveau prospect</span></button>');
    html += '<div class="board">';
    Object.entries(STATUS).forEach(([k, v]) => {
      const items = S.data.clients.filter((c) => c.status === k).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const amount = items.reduce((s, c) => s + S.data.quotes.filter((q) => q.client_id === c.id && (k === 'client' ? q.status === 'accepte' : q.status === 'envoye')).reduce((x, q) => x + Number(q.amount || 0), 0), 0);
      html += '<div class="col" data-status="' + k + '" style="--c:' + v.color + '"><div class="col-head"><span>' + esc(v.label) + '</span><b>' + items.length + '</b></div>' +
        (amount && (k === 'devis' || k === 'client') ? '<div class="col-sum">' + fmtMoney(amount) + '</div>' : '') +
        '<div class="col-body">' + items.map((c) => {
          const last = S.data.activities.filter((a) => a.client_id === c.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return '<a class="pcard" draggable="true" data-id="' + c.id + '" href="#/clients/' + c.id + '"><b>' + esc(c.name) + '</b><span>' + esc(c.city || '') + '</span>' +
            (last ? '<small>' + esc(relTime(last.created_at)) + ' · ' + esc(last.content.slice(0, 60)) + '</small>' : '') + '</a>';
        }).join('') + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function viewAppointment(id) {
    const a = S.data.appointments.find((x) => x.id === id);
    if (!a) return pageHead('Rendez-vous introuvable', '', '', '#/agenda') + empty("Ce rendez-vous n'existe pas ou vous n'y avez pas accès.");
    const c = client(a.client_id) || { id: a.client_id, name: 'Client', country: 'FR' };
    const tech = profile(a.technician_id);
    const end = new Date(new Date(a.start_at).getTime() + a.duration_min * 60000);
    const when = new Date(a.start_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + fmtTime(a.start_at) + ' – ' + fmtTime(end.toISOString());

    const steps = {
      planifie: [['confirme', 'Confirmer le RDV', 'rappel'], ['en_route', 'Je suis en route', 'en_route']],
      confirme: [['en_route', 'Je suis en route', 'en_route'], ['en_cours', "Démarrer l'intervention"]],
      en_route: [['en_cours', "Démarrer l'intervention"]],
      en_cours: [['termine', "Terminer l'intervention", 'termine']],
      termine: [], annule: [['planifie', 'Replanifier']]
    }[a.status] || [];

    let html = pageHead(esc(APPT_TYPES[a.type]), esc(when.charAt(0).toUpperCase() + when.slice(1)),
      S.isAdmin() ? '<button class="btn btn-ghost" data-action="edit-appt" data-appt="' + a.id + '">' + icon('edit') + '<span class="hide-sm">Modifier</span></button>' : '', '#/agenda?w=' + ymd(startOfWeek(new Date(a.start_at))));
    html += '<div class="status-bar">' + badge(APPT_STATUS, a.status) + (tech ? '<span class="muted small">Technicien : ' + esc(tech.full_name) + '</span>' : '') + '</div>';

    if (steps.length) {
      html += '<div class="steps">' + steps.map(([st, label, tpl], i) =>
        '<button class="btn ' + (i === 0 ? 'btn-primary' : 'btn-ghost') + ' btn-lg" data-action="appt-step" data-appt="' + a.id + '" data-to="' + st + '"' + (tpl ? ' data-tpl="' + tpl + '"' : '') + '>' + esc(label) + '</button>').join('') +
        (a.status !== 'annule' ? '<button class="btn btn-danger-ghost btn-sm" data-action="appt-step" data-appt="' + a.id + '" data-to="annule">Annuler le RDV</button>' : '') + '</div>';
    }

    html += '<div class="grid-2">';
    html += card('Client', '<a class="client-link" href="#/clients/' + c.id + '"><b>' + esc(c.name) + '</b><span>' + esc(fullAddress(c)) + '</span><span>' + esc(c.phone || '') + '</span></a>' + contactButtons(c, { appt: a }));
    html += card('Infos installation', '<div class="infos">' +
      [['Énergie', c.heating_type], ['Chaudière / PAC', c.boiler_brand], ['Émetteurs', c.emitter_type], ['Radiateurs', c.radiators_count], ['Dernier passage', c.last_service_date ? fmtDate(c.last_service_date) : '']]
        .filter((x) => x[1] || x[1] === 0).map((x) => '<div class="info"><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>').join('') + '</div>' +
      (a.notes ? '<p class="notes"><b>Consignes :</b> ' + esc(a.notes) + '</p>' : ''));
    const pays = S.data.payments.filter((p) => p.appointment_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
    html += card('Paiement', (a.amount_due ? '<p class="pad">Montant prévu : <b>' + esc(fmtMoney2(a.amount_due)) + '</b></p>' : '') + (pays.length ? paymentsList(pays) : empty(a.status === 'termine' ? 'Rien d’encaissé pour cette intervention.' : 'À encaisser en fin d’intervention.')),
      '<button class="btn ' + (a.status === 'termine' && !pays.some((p) => p.status !== 'annule') ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-action="collect" data-client="' + c.id + '" data-appt="' + a.id + '">' + icon('card') + 'Encaisser</button>');
    html += '<section class="card span-2"><header class="card-head"><h3>Compte-rendu d\'intervention</h3></header>' +
      '<form class="report-form" data-appt="' + a.id + '"><textarea name="report" rows="5" placeholder="Travaux réalisés, état de l\'eau, pièces posées, recommandations…">' + esc(a.report || '') + '</textarea>' +
      '<div class="form-actions"><button class="btn btn-primary" type="submit">Enregistrer le compte-rendu</button></div></form></section>';
    html += '</div>';
    return html;
  }

  function viewTeam() {
    if (!S.isAdmin()) return pageHead('Équipe') + empty('Réservé au gérant.');
    let html = pageHead('Équipe', S.data.profiles.length + ' membre(s)', S.mode === 'demo' ? '<button class="btn btn-primary" data-action="new-member">' + icon('plus') + '<span class="hide-sm">Ajouter</span></button>' : '');
    html += '<section class="card flush"><div class="list">' + S.data.profiles.map((p) =>
      '<button class="row" data-action="edit-member" data-id="' + p.id + '"><div class="avatar" style="--c:' + p.color + '">' + esc(p.full_name.charAt(0).toUpperCase()) + '</div>' +
      '<div class="row-main"><div class="row-title">' + esc(p.full_name) + (p.id === S.user.id ? ' (vous)' : '') + '</div><div class="row-sub">' + esc(p.phone || '') + '</div></div>' +
      '<span class="badge" style="--c:' + (p.role === 'admin' ? '#0d3d73' : '#e0691f') + '">' + (p.role === 'admin' ? 'Gérant' : 'Technicien') + '</span>' +
      (p.active ? '' : '<span class="badge" style="--c:#b3261e">Désactivé</span>') + '</button>').join('') + '</div></section>';
    html += card('Ce que voit un technicien', '<ul class="bullets"><li>Uniquement <b>ses</b> rendez-vous et les fiches des clients concernés.</li><li>Il peut appeler, envoyer les SMS, lancer l\'itinéraire, changer le statut du RDV et rédiger le compte-rendu.</li><li>Il peut encaisser le client : QR code de paiement par carte ou coordonnées de virement.</li><li>Il ne voit <b>pas</b> les devis, les autres paiements ni le reste du fichier clients.</li></ul>' +
      (S.mode === 'demo' ? '<p class="muted small pad">Pour tester : déconnectez-vous (Réglages) et reconnectez-vous en tant que « Thomas ».</p>'
        : '<p class="muted small pad">Pour ajouter un technicien : Supabase → Authentication → Users → « Invite user » avec son e-mail. Il reçoit un lien pour choisir son mot de passe, puis apparaît ici.</p>'));
    return html;
  }

  function viewSettings() {
    const co = company(), tpls = templates();
    let html = pageHead('Réglages', esc(S.user.full_name) + (S.user.email ? ' · ' + esc(S.user.email) : ''));
    html += '<div class="grid-2">';
    html += card('Application', '<div class="infos"><div class="info"><span>Mode</span><b>' + (S.mode === 'demo' ? 'Démo (données sur cet appareil uniquement)' : 'Connecté (Supabase)') + '</b></div>' +
      '<div class="info"><span>Rôle</span><b>' + (S.isAdmin() ? 'Gérant' : 'Technicien') + '</b></div></div>' +
      '<div class="btn-row">' +
      (S.isAdmin() ? '<a class="btn btn-ghost" href="#/equipe">' + icon('team') + 'Équipe</a>' : '') +
      (S.mode === 'supabase' ? '<button class="btn btn-ghost" data-action="change-password">Changer mon mot de passe</button>' : '') +
      (S.isAdmin() ? '<button class="btn btn-ghost" data-action="export-csv">Exporter les clients (CSV)</button>' : '') +
      (S.mode === 'demo' && S.isAdmin() ? '<button class="btn btn-danger-ghost" data-action="reset-demo">Réinitialiser la démo</button>' : '') +
      '<button class="btn btn-ghost" data-action="logout">' + icon('logout') + 'Se déconnecter</button></div>' +
      '<p class="muted small pad">Installer sur le téléphone : ouvrir le CRM dans Safari (iPhone) ou Chrome (Android) puis « Ajouter à l\'écran d\'accueil ».</p>');
    if (S.isAdmin()) {
      html += '<section class="card"><header class="card-head"><h3>Entreprise</h3></header><form class="settings-form" data-kind="company">' +
        fieldHtml({ name: 'name', label: "Nom affiché dans les SMS" }, co.name) +
        fieldHtml({ name: 'review_link', label: 'Lien vers votre fiche Google (avis)' }, co.review_link) +
        '<div class="form-actions"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form></section>';
      const bank = S.data.settings.bank || {};
      html += '<section class="card"><header class="card-head"><h3>Coordonnées bancaires</h3></header><form class="settings-form" data-kind="bank">' +
        '<p class="muted small">Utilisées pour les demandes de règlement par virement.</p>' +
        fieldHtml({ name: 'holder', label: 'Titulaire du compte' }, bank.holder) +
        fieldHtml({ name: 'iban', label: 'IBAN', placeholder: 'FR76 …' }, bank.iban) +
        fieldHtml({ name: 'bic', label: 'BIC' }, bank.bic) +
        '<div class="form-actions"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form></section>';
      html += card('Paiement par carte', '<div class="infos"><div class="info"><span>Prestataire</span><b>Stripe</b></div><div class="info"><span>État</span><b>' +
        (S.mode === 'demo' ? 'Simulation (mode démo)' : 'Actif si la fonction « create-checkout » est déployée') + '</b></div></div>' +
        '<p class="muted small pad">Le client paie sur une page sécurisée Stripe (carte, Apple Pay, Google Pay). L\'argent arrive sur votre compte bancaire sous quelques jours. Mise en place : voir crm/README.md.</p>');
      html += '<section class="card span-2"><header class="card-head"><h3>Modèles de SMS</h3></header><form class="settings-form" data-kind="sms">' +
        '<p class="muted small">Variables disponibles : {nom} {date} {heure} {type} {technicien} {reference} {dernier_entretien} {entreprise} {lien_avis} — paiements : {montant} {lien_paiement} {ref_paiement} {iban} {bic} {titulaire}</p>' +
        Object.entries(tpls).map(([k, t]) => fieldHtml({ name: k, label: t.label, type: 'textarea', rows: 3 }, t.text)).join('') +
        '<div class="form-actions"><button class="btn btn-ghost" type="button" data-action="reset-templates">Modèles par défaut</button><button class="btn btn-primary" type="submit">Enregistrer les modèles</button></div></form></section>';
    }
    html += '</div>';
    return html;
  }

  // ================================================================ routeur
  const view = () => $('#view');

  function currentRoute() {
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?');
    return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(qs || '') };
  }

  function render() {
    if (!S.user) return renderLogin();
    if (!$('#view')) renderShell();
    const { parts, params } = currentRoute();
    const section = parts[0] || '';
    let html;
    if (section === 'agenda') html = viewAgenda(params);
    else if (section === 'clients' && parts[1]) html = viewClient(parts[1]);
    else if (section === 'clients') html = viewClients(params);
    else if (section === 'pipeline' && S.isAdmin()) html = viewPipeline();
    else if (section === 'rdv' && parts[1]) html = viewAppointment(parts[1]);
    else if (section === 'equipe') html = viewTeam();
    else if (section === 'demo-paiement' && parts[1] && S.mode === 'demo') html = viewDemoCheckout(parts[1]);
    else if (section === 'reglages') html = viewSettings();
    else html = viewDashboard();
    const scroll = window.scrollY;
    const sameRoute = view().dataset.route === location.hash;
    view().innerHTML = html;
    view().dataset.route = location.hash;
    window.scrollTo(0, sameRoute ? scroll : 0);
    document.querySelectorAll('.nav a').forEach((a) => {
      const target = a.getAttribute('href').slice(2).split('/')[0];
      a.classList.toggle('on', target === section || (target === '' && !['agenda', 'clients', 'pipeline', 'equipe', 'reglages', 'rdv'].includes(section)) || (target === 'agenda' && section === 'rdv'));
    });
    bindView();
  }

  function renderShell() {
    const admin = S.isAdmin();
    const items = [['', 'home', 'Accueil'], ['agenda', 'calendar', 'Agenda'], ['clients', 'users', 'Clients']];
    if (admin) items.push(['pipeline', 'columns', 'Pipeline'], ['equipe', 'team', 'Équipe']);
    items.push(['reglages', 'settings', 'Réglages']);
    document.getElementById('app').innerHTML =
      '<aside class="sidebar"><div class="brand"><img src="icons/icon.svg" alt=""><div><b>Alpes Désembouage</b><span>CRM</span></div></div>' +
      '<nav class="nav">' + items.map(([h, i, l]) => '<a href="#/' + h + '">' + icon(i) + '<span>' + l + '</span></a>').join('') + '</nav>' +
      (S.mode === 'demo' ? '<div class="demo-flag">Mode démo</div>' : '') + '</aside>' +
      '<main id="view"></main>' +
      '<button class="fab" data-action="quick-add" aria-label="Ajouter">' + icon('plus') + '</button>';
    document.body.classList.toggle('is-tech', !admin);
  }

  function renderLogin(error) {
    document.body.classList.remove('is-tech');
    let body;
    if (S.mode === 'demo') {
      body = '<p class="muted">Mode démo : les données restent sur cet appareil. Choisissez un profil pour découvrir l\'application.</p>' +
        '<div class="demo-choices">' + S.data.profiles.filter((p) => p.active).map((p) =>
          '<button class="demo-choice" data-demo="' + p.id + '"><div class="avatar" style="--c:' + p.color + '">' + esc(p.full_name.charAt(0)) + '</div><div><b>' + esc(p.full_name) + '</b><span>' + (p.role === 'admin' ? 'Gérant · accès complet' : 'Technicien · ses RDV uniquement') + '</span></div></button>').join('') + '</div>';
    } else if (S.needPassword) {
      body = '<form class="login-form" data-kind="set-password"><p class="muted">Choisissez votre mot de passe pour activer votre compte.</p>' +
        '<label class="field"><span>Nouveau mot de passe</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>' +
        '<button class="btn btn-primary btn-lg" type="submit">Valider</button></form>';
    } else {
      body = '<form class="login-form" data-kind="login">' +
        '<label class="field"><span>E-mail</span><input type="email" name="email" required autocomplete="username"></label>' +
        '<label class="field"><span>Mot de passe</span><input type="password" name="password" required autocomplete="current-password"></label>' +
        '<button class="btn btn-primary btn-lg" type="submit">Se connecter</button>' +
        '<button class="link-btn" type="button" data-action="forgot">Mot de passe oublié ?</button></form>';
    }
    document.getElementById('app').innerHTML = '<div class="login"><div class="login-card"><img src="icons/icon.svg" alt="" class="login-logo"><h1>Alpes Désembouage</h1><p class="login-sub">Suivi clients & interventions</p>' +
      (error ? '<p class="error">' + esc(error) + '</p>' : '') + body + '</div></div>';

    document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
      S.signInDemo(b.dataset.demo);
      await S.loadAll();
      location.hash = '#/';
      renderShell();
      render();
    }));
    const form = $('.login-form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('[type=submit]', form); btn.disabled = true;
      try {
        if (form.dataset.kind === 'set-password') {
          await S.setPassword(form.elements.password.value);
          const { data } = await S.sb.auth.getSession();
          await S._loadProfile(data.session.user);
        } else {
          await S.signIn(form.elements.email.value.trim(), form.elements.password.value);
        }
        await S.loadAll();
        location.hash = '#/';
        renderShell();
        render();
      } catch (err) { renderLogin(err.message); }
    });
    const forgot = $('[data-action=forgot]');
    if (forgot) forgot.addEventListener('click', async () => {
      const email = $('.login-form').elements.email.value.trim();
      if (!email) { renderLogin('Saisissez votre e-mail puis cliquez sur « Mot de passe oublié ».'); return; }
      try { await S.resetPassword(email); toast('E-mail de réinitialisation envoyé'); } catch (err) { renderLogin(err.message); }
    });
  }

  // ================================================================ interactions
  function bindView() {
    const search = $('#client-search');
    if (search) {
      search.addEventListener('input', () => {
        const { params } = currentRoute();
        if (search.value) params.set('q', search.value); else params.delete('q');
        const qs = params.toString();
        history.replaceState(null, '', '#/clients' + (qs ? '?' + qs : ''));
        const pos = search.selectionStart;
        render();
        const s2 = $('#client-search'); s2.focus(); s2.setSelectionRange(pos, pos);
      });
    }

    const noteForm = $('.note-form');
    if (noteForm) noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = noteForm.elements.content.value.trim();
      if (!content) return;
      await guard(() => logActivity(noteForm.dataset.client, noteForm.elements.type.value, content));
      render();
    });

    const reportForm = $('.report-form');
    if (reportForm) reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guard(() => S.update('appointments', reportForm.dataset.appt, { report: reportForm.elements.report.value.trim() }));
      toast('Compte-rendu enregistré');
    });

    document.querySelectorAll('.settings-form').forEach((form) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = {};
      Array.from(form.elements).forEach((el) => { if (el.name) out[el.name] = el.value.trim(); });
      if (form.dataset.kind === 'bank') {
        out.iban = out.iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
        out.bic = out.bic.replace(/\s/g, '').toUpperCase();
        if (out.iban && !ibanValid(out.iban)) { toast('IBAN invalide : vérifiez la saisie.', true); return; }
      }
      await guard(() => S.saveSetting({ company: 'company', bank: 'bank', sms: 'sms_templates' }[form.dataset.kind], out));
      toast('Réglages enregistrés');
    }));

    // Glisser-déposer du pipeline
    let dragId = null;
    document.querySelectorAll('.pcard').forEach((el) => {
      el.addEventListener('dragstart', (e) => { dragId = el.dataset.id; e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
    document.querySelectorAll('.col').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault(); col.classList.remove('over');
        const c = client(dragId);
        if (c && c.status !== col.dataset.status) { await guard(() => setClientStatus(c, col.dataset.status)); render(); }
      });
    });
  }

  const actions = {
    'new-client': () => editClient(),
    'edit-client': (el) => editClient(client(el.dataset.client)),
    'new-appt': (el) => editAppointment(null, el.dataset.client ? { client_id: el.dataset.client } : null),
    'new-appt-day': (el) => { const d = parseYmd(el.dataset.day); d.setHours(9, 0, 0, 0); editAppointment(null, { start_at: d.toISOString() }); },
    'edit-appt': (el) => editAppointment(S.data.appointments.find((a) => a.id === el.dataset.appt)),
    'new-quote': (el) => editQuote(null, el.dataset.client),
    'edit-quote': (el) => editQuote(S.data.quotes.find((q) => q.id === el.dataset.quote)),
    'open-quote': (el) => quoteSheet(S.data.quotes.find((q) => q.id === el.dataset.quote)),
    'sms': (el) => { const a = el.dataset.appt && S.data.appointments.find((x) => x.id === el.dataset.appt); smsSheet(client(el.dataset.client), { appt: a }, a ? 'rappel' : null); },
    'sms-quote': (el) => { const q = S.data.quotes.find((x) => x.id === el.dataset.quote); smsSheet(client(q.client_id), { quote: q }, 'relance_devis'); },
    'sms-service': (el) => smsSheet(client(el.dataset.client), {}, 'entretien'),
    'client-status': null,
    'agenda-tech': null,
    'quick-add': () => {
      if (!S.isAdmin()) return editClient();
      openSheet('Ajouter', '<div class="quick"><button class="btn btn-ghost btn-lg" data-q="client">' + icon('users') + 'Nouveau prospect / client</button><button class="btn btn-ghost btn-lg" data-q="appt">' + icon('calendar') + 'Nouveau rendez-vous</button></div>', (root) => {
        $('[data-q=client]', root).addEventListener('click', () => { closeModal(); editClient(); });
        $('[data-q=appt]', root).addEventListener('click', () => { closeModal(); editAppointment(); });
      });
    },
    'appt-step': async (el) => {
      const a = S.data.appointments.find((x) => x.id === el.dataset.appt);
      const to = el.dataset.to, c = client(a.client_id);
      if (to === 'annule' && el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = "Confirmer l'annulation ?"; return; }
      await guard(async () => {
        await S.update('appointments', a.id, { status: to });
        if (to === 'termine' && c) {
          await logActivity(c.id, 'visite', APPT_TYPES[a.type] + ' terminé(e)' + (a.report ? ' — ' + a.report : ''));
          if (SERVICE_TYPES.includes(a.type)) await S.update('clients', c.id, { last_service_date: ymd(new Date(a.start_at)) });
          if (SERVICE_TYPES.includes(a.type) || a.type === 'sav') await setClientStatus(client(c.id), 'client', 'intervention réalisée');
        } else if (to === 'annule' && c) {
          await logActivity(c.id, 'note', 'RDV du ' + fmtDate(a.start_at) + ' annulé');
        }
      });
      toast('Statut : ' + APPT_STATUS[to].label);
      render();
      const fresh = S.data.appointments.find((x) => x.id === a.id);
      // Intervention terminée et rien d'encaissé : on propose directement l'encaissement.
      if (to === 'termine' && c && !S.data.payments.some((p) => p.appointment_id === a.id && p.status !== 'annule')) collectPayment(client(c.id), fresh);
      else if (el.dataset.tpl && c && c.phone) smsSheet(client(c.id), { appt: fresh }, el.dataset.tpl);
    },
    'new-member': () => openForm({
      title: 'Ajouter un membre (démo)',
      fields: [{ name: 'full_name', label: 'Nom', required: true }, { name: 'phone', label: 'Téléphone', type: 'tel' }, { name: 'role', label: 'Rôle', type: 'select', options: { technicien: 'Technicien', admin: 'Gérant' } }, { name: 'color', label: "Couleur dans l'agenda", type: 'color', default: '#1f9d55' }],
      onSubmit: async (v) => { v.active = true; await S.insert('profiles', v); toast('Membre ajouté'); }
    }),
    'edit-member': (el) => {
      const p = profile(el.dataset.id);
      openForm({
        title: 'Modifier ' + p.full_name,
        fields: [{ name: 'full_name', label: 'Nom', required: true }, { name: 'phone', label: 'Téléphone', type: 'tel' },
          { name: 'role', label: 'Rôle', type: 'select', options: { technicien: 'Technicien', admin: 'Gérant' }, half: true },
          { name: 'active', label: 'Accès', type: 'select', options: { true: 'Actif', false: 'Désactivé' }, half: true },
          { name: 'color', label: "Couleur dans l'agenda", type: 'color' }],
        values: Object.assign({}, p, { active: String(p.active) }),
        onSubmit: async (v) => {
          v.active = v.active === 'true';
          if (p.id === S.user.id && (v.role !== 'admin' || !v.active)) throw new Error('Vous ne pouvez pas retirer vos propres droits de gérant.');
          await S.update('profiles', p.id, v);
          toast('Membre mis à jour');
        }
      });
    },
    'export-csv': () => {
      const cols = ['name', 'type', 'company', 'phone', 'email', 'address', 'postal_code', 'city', 'country', 'source', 'status', 'heating_type', 'boiler_brand', 'emitter_type', 'radiators_count', 'last_service_date', 'notes', 'created_at'];
      const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = String.fromCharCode(0xFEFF) + cols.join(';') + '\n' + S.data.clients.map((c) => cols.map((k) => cell(k === 'status' ? STATUS[c.status].label : c[k])).join(';')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'clients-' + ymd(new Date()) + '.csv';
      a.click();
    },
    'reset-demo': async (el) => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Confirmer : tout effacer ?'; return; }
      S.resetDemo(); await S.signOut(); await S.loadAll(); location.hash = '#/'; render(); toast('Démo réinitialisée');
    },
    'reset-templates': async () => { await guard(() => S.saveSetting('sms_templates', {})); toast('Modèles réinitialisés'); render(); },
    'change-password': () => openForm({
      title: 'Changer mon mot de passe',
      fields: [{ name: 'password', label: 'Nouveau mot de passe (8 caractères min.)', type: 'password', required: true }],
      onSubmit: async (v) => { if (v.password.length < 8) throw new Error('8 caractères minimum.'); await S.setPassword(v.password); toast('Mot de passe modifié'); }
    }),
    'collect': (el) => collectPayment(client(el.dataset.client), el.dataset.appt ? S.data.appointments.find((a) => a.id === el.dataset.appt) : null),
    'open-payment': (el) => paymentSheet(S.data.payments.find((p) => p.id === el.dataset.id)),
    'demo-pay': async (el) => {
      const p = S.data.payments.find((x) => x.id === el.dataset.id);
      el.disabled = true; el.textContent = 'Paiement en cours…';
      await new Promise((r) => setTimeout(r, 900));
      await S.update('payments', p.id, { status: 'paye', paid_at: new Date().toISOString() });
      await logActivity(p.client_id, 'note', 'Paiement par carte reçu : ' + fmtMoney2(p.amount) + ' (' + p.description + ')');
      render();
    },
    'logout': async () => { await S.signOut(); if (S.mode === 'demo') await S.loadAll(); location.hash = '#/'; render(); }
  };

  document.addEventListener('click', (e) => {
    const logLink = e.target.closest('[data-log]');
    if (logLink) logActivity(logLink.dataset.client, logLink.dataset.log, 'Appel sortant').catch(() => {});
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || !actions[el.dataset.action]) return;
    e.preventDefault();
    actions[el.dataset.action](el, e);
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.action === 'client-status') {
      await guard(() => setClientStatus(client(el.dataset.client), el.value));
      toast('Statut mis à jour');
      render();
    } else if (el.dataset.action === 'agenda-tech') {
      location.hash = '#/agenda?w=' + el.dataset.week + (el.value ? '&t=' + el.value : '');
    }
  });

  window.addEventListener('hashchange', () => { closeModal(); render(); });

  // Rafraîchit les données quand on revient sur l'application (utile sur mobile, à plusieurs).
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.user && S.mode === 'supabase' && !modal.open) {
      try { await S.loadAll(); render(); } catch (e) { /* hors ligne */ }
    }
  });

  // ================================================================ démarrage
  (async function start() {
    try {
      await S.init();
      if (S.mode === 'demo') await S.loadAll();
      else if (S.user && !S.needPassword) await S.loadAll();
      if (S.needPassword) S.user = null;
      render();
    } catch (e) {
      console.error(e);
      document.getElementById('app').innerHTML = '<div class="login"><div class="login-card"><h1>Erreur de démarrage</h1><p class="error">' + esc(e.message) + '</p></div></div>';
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
