// Page publique de signature d'un devis (ouverte par le client depuis le lien reçu par SMS ou e-mail).
(function () {
  const cfg = window.CRM_CONFIG || {};
  const main = document.getElementById('main');
  const token = new URLSearchParams(location.search).get('t') || '';
  const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
  const longDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ------------------------------------------------------------ accès aux données (réel ou démo)
  const demoDb = () => { try { return JSON.parse(localStorage.getItem('crm-demo-v1')) || {}; } catch (e) { return {}; } };

  const api = {
    async info() {
      if (live) {
        const { data, error } = await sb.rpc('get_signing_info', { p_token: token });
        if (error) throw new Error(error.message);
        return data;
      }
      const db = demoDb();
      const q = (db.quotes || []).find((x) => x.sign_token === token && ['envoye', 'signe'].includes(x.sign_status));
      if (!q) return null;
      const c = (db.clients || []).find((x) => x.id === q.client_id) || {};
      return Object.assign({}, q, {
        status: q.sign_status, client_name: c.name, company: (db.settings || {}).company || null,
        expired: !!(q.sign_expires_at && new Date(q.sign_expires_at) < new Date())
      });
    },
    async pdf(path) {
      if (live) {
        const { data, error } = await sb.storage.from('devis').download(path);
        if (error) throw new Error('Impossible de charger le devis.');
        return data.arrayBuffer();
      }
      const url = (demoDb().files || {})[path];
      if (!url) throw new Error('Impossible de charger le devis.');
      return (await fetch(url)).arrayBuffer();
    },
    async sign(payload) {
      if (live) {
        const { data, error } = await sb.rpc('sign_quote', payload);
        if (error) throw new Error(error.message);
        return data;
      }
      // Démo : reproduit la fonction sign_quote de la base
      const db = demoDb();
      const q = db.quotes.find((x) => x.sign_token === token);
      if (!q || q.sign_status !== 'envoye') throw new Error('Lien de signature invalide ou devis déjà signé');
      if (payload.p_doc_hash !== q.doc_hash) throw new Error('Le devis a été modifié entre-temps : rechargez la page');
      const now = new Date().toISOString();
      Object.assign(q, { sign_status: 'signe', signed_at: now, signer_name: payload.p_name.trim(), signature_image: payload.p_signature, signer_ip: '(démo)', signer_user_agent: navigator.userAgent, status: 'accepte' });
      const c = db.clients.find((x) => x.id === q.client_id);
      if (c) c.status = 'client';
      db.activities.push({ id: 'act-' + Date.now(), created_at: now, client_id: q.client_id, user_id: null, type: 'statut', content: 'Devis ' + (q.reference || '') + ' signé électroniquement par ' + payload.p_name.trim() + ' — statut : Client' });
      localStorage.setItem('crm-demo-v1', JSON.stringify(db));
      return { signed_at: now, signer_ip: '(démo)' };
    }
  };

  // ------------------------------------------------------------ affichage
  function message(title, text, kind) {
    main.innerHTML = '<section class="card center ' + (kind || '') + '"><h1>' + esc(title) + '</h1><p>' + text + '</p></section>';
  }

  async function renderPdf(bytes, container) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const width = container.clientWidth;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      canvas.style.width = '100%';
      canvas.setAttribute('aria-label', 'Page ' + n + ' du devis');
      container.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    }
  }

  function signaturePad(canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false, empty = true, last = null;
    function resize() {
      const r = canvas.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * k; canvas.height = r.height * k;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0d1f3c';
      empty = true;
    }
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; empty = false;
      canvas.dispatchEvent(new Event('change'));
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => canvas.addEventListener(t, () => { drawing = false; }));
    resize();
    return {
      clear: resize,
      isEmpty: () => empty,
      // Image réduite (largeur 600 px max) pour garder un fichier léger
      toPng() {
        const k = Math.min(1, 600 / canvas.width);
        const out = document.createElement('canvas');
        out.width = Math.round(canvas.width * k); out.height = Math.round(canvas.height * k);
        out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
      }
    };
  }

  function signedView(info) {
    main.innerHTML = '<section class="card center ok"><div class="check">✓</div><h1>Devis signé</h1>' +
      '<p>Signé par <b>' + esc(info.signer_name) + '</b> le ' + esc(longDate(info.signed_at)) + '.</p>' +
      '<p>Merci pour votre confiance ! Nous vous recontactons très vite pour fixer la date d\'intervention.</p>' +
      '<button class="btn btn-primary" id="dl">Télécharger mon exemplaire signé (PDF)</button></section>';
    document.getElementById('dl').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const bytes = await api.pdf(info.pdf_path);
        const out = await SignedPdf.build(bytes, Object.assign({}, info, { company_name: companyName(info) }));
        SignedPdf.download(out, 'Devis-' + (info.reference || 'signe').replace(/[^\w-]+/g, '_') + '-signe.pdf');
      } catch (err) { alert(err.message); }
      e.target.disabled = false;
    });
  }

  const companyName = (info) => (info.company && info.company.name) || 'Alpes Désembouage';

  async function start() {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return message('Lien incomplet', 'Le lien de signature semble incomplet. Ouvrez à nouveau le lien reçu par SMS ou e-mail.', 'err');
    let info;
    try { info = await api.info(); } catch (e) { return message('Erreur', 'Impossible de charger le devis. Vérifiez votre connexion et réessayez.', 'err'); }
    if (!info) return message('Lien invalide', 'Ce lien de signature n\'est plus valable. Contactez-nous au <a href="tel:+33658658056">06 58 65 80 56</a>.', 'err');
    document.getElementById('company').textContent = companyName(info);
    if (info.status === 'signe') return signedView(info);
    if (info.expired) return message('Lien expiré', 'Le délai pour signer ce devis est dépassé. Contactez-nous au <a href="tel:+33658658056">06 58 65 80 56</a> pour recevoir un nouveau lien.', 'err');

    main.innerHTML =
      '<section class="intro"><h1>Votre devis' + (info.reference ? ' n° ' + esc(info.reference) : '') + '</h1>' +
      '<p>Bonjour ' + esc(info.client_name) + ', voici votre devis' + (info.amount ? ' d\'un montant de <b>' + esc(money(info.amount)) + ' TTC</b>' : '') +
      (info.with_cgv ? ', suivi de nos <b>conditions générales de vente</b>' : '') + '. ' +
      'Prenez le temps de ' + (info.with_cgv ? 'les' : 'le') + ' lire, puis signez en bas de page.</p></section>' +
      '<section class="doc" id="doc"><p class="loading">Affichage du devis…</p></section>' +
      '<p class="center"><button class="link" id="dl-orig">Télécharger le devis (PDF)</button></p>' +
      '<form class="card sign" id="sign-form">' +
      '<h2>Signature</h2>' +
      '<label class="field"><span>Nom et prénom du signataire</span><input name="name" required autocomplete="name" value="' + esc(info.client_name || '') + '"></label>' +
      '<label class="check-line"><input type="checkbox" name="consent" required><span>' + (info.with_cgv ? 'J\'ai lu le devis et les conditions générales de vente, et je les accepte sans réserve.' : 'J\'ai lu le devis et je l\'accepte sans réserve.') + ' <b>Bon pour accord.</b></span></label>' +
      '<div class="pad-head"><span>Signez avec votre doigt dans le cadre</span><button type="button" class="link" id="clear">Effacer</button></div>' +
      '<canvas class="pad" id="pad"></canvas>' +
      '<p class="error" id="err" hidden></p>' +
      '<button class="btn btn-primary btn-lg" type="submit">Signer le devis</button>' +
      '<p class="fine">Signature électronique sécurisée. La date, l\'heure et l\'empreinte du document sont enregistrées comme preuve de votre accord.</p>' +
      '</form>';

    let bytes, hash;
    try {
      bytes = await api.pdf(info.pdf_path);
      hash = await SignedPdf.sha256Hex(bytes);
      const doc = document.getElementById('doc');
      doc.innerHTML = '';
      await renderPdf(bytes, doc);
    } catch (e) {
      document.getElementById('doc').innerHTML = '<p class="error">Le devis n\'a pas pu être affiché. Utilisez le bouton « Télécharger le devis ».</p>';
    }

    document.getElementById('dl-orig').addEventListener('click', () => { if (bytes) SignedPdf.download(bytes, 'Devis-' + (info.reference || 'alpes-desembouage') + '.pdf'); });
    const pad = signaturePad(document.getElementById('pad'));
    document.getElementById('clear').addEventListener('click', () => pad.clear());

    const form = document.getElementById('sign-form');
    const err = document.getElementById('err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const fail = (m) => { err.textContent = m; err.hidden = false; };
      if (form.elements.name.value.trim().length < 2) return fail('Indiquez votre nom et prénom.');
      if (!form.elements.consent.checked) return fail('Cochez « Bon pour accord » pour accepter le devis.');
      if (pad.isEmpty()) return fail('Signez dans le cadre avec votre doigt (ou la souris).');
      if (!hash) return fail('Le devis n\'a pas pu être chargé : rechargez la page.');
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Signature en cours…';
      try {
        const name = form.elements.name.value.trim();
        const signature = pad.toPng();
        const res = await api.sign({ p_token: token, p_name: name, p_signature: signature, p_doc_hash: hash, p_consent: true });
        signedView(Object.assign({}, info, {
          signer_name: name, signed_at: res.signed_at, signer_ip: res.signer_ip, signature_image: signature, signer_user_agent: navigator.userAgent
        }));
        window.scrollTo(0, 0);
      } catch (e2) {
        fail(e2.message);
        btn.disabled = false; btn.textContent = 'Signer le devis';
      }
    });
  }

  start();
})();
