// Calcul des totaux et fabrication du PDF d'un devis créé dans le CRM.
// Les prix sont saisis TTC (590 €, 50 €…) : le HT et la TVA en sont déduits, comme dans Tolteck.
(function () {
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  function computeTotals(lines, rate) {
    const k = 1 + (rate == null ? 10 : Number(rate)) / 100;
    let ttc = 0;
    const rows = (lines || []).map((l) => {
      const qty = Number(l.qty) || 0, price = Number(l.price_ttc) || 0;
      ttc += qty * price;
      return Object.assign({}, l, { pu_ht: round2(price / k), total_ht: round2((qty * price) / k), total_ttc: round2(qty * price) });
    });
    ttc = round2(ttc);
    const ht = round2(ttc / k);
    return { rows, ht, tva: round2(ttc - ht), ttc, rate: rate == null ? 10 : Number(rate) };
  }

  // Polices standard des PDF : alphabet latin uniquement.
  const safe = (s) => String(s == null ? '' : s)
    .replace(/[  ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF€«»\n]/g, '');
  const eur = (n) => safe(Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
  const frDate = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('fr-FR') : '');

  function wrap(text, font, size, maxWidth) {
    const out = [];
    safe(text).split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).forEach((word) => {
        if (!word) return;
        const test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) { line = test; return; }
        if (line) out.push(line);
        // mot trop long : on le coupe
        while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
          let i = word.length;
          while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > maxWidth) i--;
          out.push(word.slice(0, i)); word = word.slice(i);
        }
        line = word;
      });
      out.push(line);
    });
    return out;
  }

  // Logo : la goutte du site, convertie en image PNG (le PDF ne sait pas lire le SVG).
  async function logoPng() {
    try {
      const svg = await (await fetch(new URL('icons/icon.svg', document.baseURI))).text();
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 240; c.height = 240;
      c.getContext('2d').drawImage(img, 0, 0, 240, 240);
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }

  async function build(quote, client, co) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 42, R = W - M;
    // Couleurs du site : bleu marine, bleu, orange
    const ink = rgb(0.1, 0.12, 0.15), gray = rgb(0.36, 0.4, 0.46), soft = rgb(0.55, 0.59, 0.65);
    const navy = rgb(0.05, 0.24, 0.45), blue = rgb(0.08, 0.35, 0.62), orange = rgb(0.94, 0.46, 0.17);
    const light = rgb(0.953, 0.965, 0.98), line = rgb(0.86, 0.89, 0.93), white = rgb(1, 1, 1);
    const t = computeTotals(quote.lines, co.vat_rate);
    const logoData = await logoPng();
    const logo = logoData ? await doc.embedPng(logoData) : null;
    const brand = safe(co.name || co.legal_name || '');

    let page, y;
    const pages = [];
    const txt = (s, x, yy, o) => page.drawText(safe(s), Object.assign({ x, y: yy, size: 10.5, font, color: ink }, o));
    const width = (s, o) => ((o && o.font) || font).widthOfTextAtSize(safe(s), (o && o.size) || 10.5);
    const right = (s, xr, yy, o) => txt(s, xr - width(s, o), yy, o);
    // Rectangle à coins arrondis (yTop = bord supérieur)
    const box = (x, yTop, w, h, color, r, border) => {
      r = Math.min(r == null ? 8 : r, h / 2, w / 2);
      const p = 'M ' + r + ' 0 H ' + (w - r) + ' Q ' + w + ' 0 ' + w + ' ' + r + ' V ' + (h - r) + ' Q ' + w + ' ' + h + ' ' + (w - r) + ' ' + h +
        ' H ' + r + ' Q 0 ' + h + ' 0 ' + (h - r) + ' V ' + r + ' Q 0 0 ' + r + ' 0 Z';
      page.drawSvgPath(p, Object.assign({ x, y: yTop }, color ? { color } : {}, border ? { borderColor: border, borderWidth: 0.8 } : {}));
    };
    const label = (s, x, yy, color) => txt(String(s).toUpperCase(), x, yy, { font: bold, size: 7.8, color: color || blue });

    const newPage = () => { page = doc.addPage([W, H]); pages.push(page); };

    // ---------------------------------------------------------------- en-tête (première page)
    newPage();
    y = H - 46;
    if (logo) page.drawImage(logo, { x: M - 4, y: y - 46, width: 58, height: 58 });
    const bx = logo ? M + 62 : M;
    txt(brand, bx, y - 18, { font: bold, size: 25, color: navy });
    txt(co.tagline || 'Désembouage de circuits de chauffage', bx, y - 35, { size: 10.5, color: gray });

    right('DEVIS', R, y - 18, { font: bold, size: 28, color: orange });
    right('N° ' + (quote.reference || ''), R, y - 35, { font: bold, size: 11.5, color: navy });
    y -= 62;
    // fine ligne d'accent : marine + touche orange
    page.drawRectangle({ x: M, y, width: R - M, height: 1, color: line });
    page.drawRectangle({ x: M, y: y - 1, width: 70, height: 3, color: orange });

    // Date et validité
    y -= 22;
    txt('Date : ', M, y, { size: 10, color: gray });
    txt(frDate(quote.issue_date), M + width('Date : ', { size: 10 }), y, { font: bold, size: 10 });
    const valid = 'Valable jusqu\'au ' + frDate(quote.valid_until);
    right(valid, R, y, { size: 10, color: gray });

    // ---------------------------------------------------------------- cartes émetteur / client
    y -= 16;
    const gap = 14, cw = (R - M - gap) / 2, pad = 14;
    const emit = [].concat(safe(co.address || '').split('\n'), [co.phone ? 'Tél. ' + co.phone : '', co.email || '']).filter(Boolean);
    const cli = [].concat(client.company ? [client.company] : [], safe(client.address || '').split('\n'), [[client.postal_code, client.city].filter(Boolean).join(' ')]).filter(Boolean);
    const cardH = 38 + Math.max(emit.length, cli.length) * 14 + 6;
    box(M, y, cw, cardH, light);
    box(M + cw + gap, y, cw, cardH, null, 8, line);
    page.drawRectangle({ x: M + cw + gap, y: y - cardH + 8, width: 3, height: cardH - 16, color: orange });
    label('Émetteur', M + pad, y - 18);
    txt(co.legal_name || brand, M + pad, y - 33, { font: bold, size: 12 });
    emit.forEach((l, i) => txt(l, M + pad, y - 49 - i * 14, { size: 10, color: gray }));
    const cx = M + cw + gap + pad + 4;
    label('Client', cx, y - 18, orange);
    txt(client.name || '', cx, y - 33, { font: bold, size: 12.5 });
    cli.forEach((l, i) => txt(l, cx, y - 49 - i * 14, { size: 10, color: gray }));
    y -= cardH + 16;

    // Adresse du chantier
    const proj = safe(quote.project_address || '').replace(/\n+/g, ', ').trim();
    if (proj) {
      label('Adresse du chantier', M, y);
      const pl = wrap(proj, font, 10.5, R - M - 130);
      pl.forEach((l, i) => txt(l, M + 122, y - i * 14, { size: 10.5 }));
      y -= pl.length * 14 + 12;
    }

    // Objet
    if (quote.title) {
      txt(quote.title, M, y - 4, { font: bold, size: 16, color: navy });
      y -= 26;
    }

    // ---------------------------------------------------------------- tableau des prestations
    const C = { n: M + 12, des: M + 34, desW: 236, qty: 362, pu: 432, tva: 472, tot: R - 12 };
    const tableHead = () => {
      box(M, y, R - M, 26, navy, 6);
      const o = { font: bold, size: 9.5, color: white };
      const yy = y - 17;
      txt('N°', C.n, yy, o); txt('Désignation', C.des, yy, o); right('Qté', C.qty, yy, o);
      right('PU HT', C.pu, yy, o); right('TVA', C.tva, yy, o); right('Total HT', C.tot, yy, o);
      y -= 26;
    };
    const continuedHeader = () => {
      newPage();
      y = H - 46;
      txt(brand, M, y - 10, { font: bold, size: 14, color: navy });
      right('Devis n° ' + (quote.reference || '') + ' (suite)', R, y - 10, { size: 10, color: gray });
      page.drawRectangle({ x: M, y: y - 22, width: R - M, height: 1, color: line });
      y -= 40;
    };

    tableHead();
    t.rows.forEach((l, i) => {
      const lab = wrap(l.label, bold, 11, C.desW);
      const desc = l.description ? wrap(l.description, font, 9.3, C.desW) : [];
      const h = 16 + lab.length * 14 + (desc.length ? 4 + desc.length * 12.2 : 0);
      if (y - h < 190) { continuedHeader(); tableHead(); }
      if (i % 2 === 1) page.drawRectangle({ x: M, y: y - h, width: R - M, height: h, color: light });
      const yy = y - 18;
      txt(String(i + 1), C.n, yy, { font: bold, size: 10.5, color: soft });
      lab.forEach((ln, k) => txt(ln, C.des, yy - k * 14, { font: bold, size: 11 }));
      desc.forEach((ln, k) => txt(ln, C.des, yy - lab.length * 14 - 4 - k * 12.2, { size: 9.3, color: gray }));
      right(Number(l.qty).toLocaleString('fr-FR') + ' ' + (l.unit || ''), C.qty, yy, { size: 10.5 });
      right(eur(l.pu_ht), C.pu, yy, { size: 10.5 });
      right(t.rate + ' %', C.tva, yy, { size: 10.5, color: gray });
      right(eur(l.total_ht), C.tot, yy, { font: bold, size: 10.5 });
      y -= h;
    });
    page.drawRectangle({ x: M, y, width: R - M, height: 1, color: line });

    // ---------------------------------------------------------------- totaux + conditions
    if (y < 250) continuedHeader();
    y -= 18;
    const tw = 232, tx = R - tw;
    box(tx, y, tw, 96, light);
    txt('Total HT', tx + 16, y - 22, { size: 10.5, color: gray }); right(eur(t.ht), R - 16, y - 22, { size: 10.5 });
    txt('TVA ' + t.rate + ' %', tx + 16, y - 42, { size: 10.5, color: gray }); right(eur(t.tva), R - 16, y - 42, { size: 10.5 });
    box(tx, y - 56, tw, 40, navy, 8);
    txt('Total TTC', tx + 16, y - 81, { font: bold, size: 12, color: white });
    right(eur(t.ttc), R - 16, y - 82, { font: bold, size: 17, color: white });

    const lw = tx - M - 24;
    label('Conditions de paiement', M, y - 12);
    const terms = wrap(co.payment_terms || '', font, 10, lw);
    terms.forEach((ln, k) => txt(ln, M, y - 28 - k * 13.5, { size: 10 }));
    let ly = y - 28 - terms.length * 13.5 - 10;
    label('Validité', M, ly);
    txt('Ce devis est valable jusqu\'au ' + frDate(quote.valid_until) + '.', M, ly - 16, { size: 10 });
    y = Math.min(y - 96, ly - 16) - 18;

    // ---------------------------------------------------------------- mentions
    [co.vat_mention, co.extra_mention].filter(Boolean).forEach((m) => {
      wrap(m, font, 8.8, R - M).forEach((ln) => { if (y < 80) continuedHeader(); txt(ln, M, y, { size: 8.8, color: gray }); y -= 11.5; });
      y -= 5;
    });

    // ---------------------------------------------------------------- signatures
    if (y - 104 < 66) continuedHeader();
    y -= 12;
    const sh = 86;
    box(M, y, cw, sh, null, 8, line);
    box(M + cw + gap, y, cw, sh, null, 8, line);
    label('L\'entreprise', M + pad, y - 18);
    txt(co.legal_name || brand, M + pad, y - 34, { font: bold, size: 11 });
    txt(brand, M + pad, y - 49, { size: 9.5, color: gray });
    label('Le client — bon pour accord', cx, y - 18, orange);
    txt('« Devis reçu avant l\'exécution des travaux.', cx, y - 34, { size: 9.5, color: gray });
    txt('Bon pour travaux. »', cx, y - 47, { size: 9.5, color: gray });
    txt('Signature électronique : voir le certificat', cx, y - 68, { size: 8.5, color: soft });
    txt('joint en fin de document une fois signé.', cx, y - 79, { size: 8.5, color: soft });

    // ---------------------------------------------------------------- pied de page (toutes les pages)
    const foot1 = [co.legal_name, safe(co.address || '').replace(/\n/g, ', '), co.phone ? 'Tél. ' + co.phone : '', co.email || ''].filter(Boolean).join('  ·  ');
    const foot2 = [[co.legal_form, co.capital ? 'au capital de ' + co.capital : ''].filter(Boolean).join(' '), co.siege ? 'Siège : ' + co.siege : '',
      co.siret ? 'SIRET ' + co.siret : '', co.rcs || '', co.tva_number ? 'TVA ' + co.tva_number : '', co.insurance ? 'Assurance ' + co.insurance : '', co.iban ? 'IBAN ' + co.iban : ''].filter(Boolean).join('  ·  ');
    pages.forEach((p, i) => {
      page = p;
      page.drawRectangle({ x: M, y: 60, width: R - M, height: 0.8, color: line });
      const lines = wrap(foot1, font, 7.3, R - M - 60).concat(wrap(foot2, font, 7.3, R - M - 60));
      lines.slice(0, 4).forEach((ln, k) => txt(ln, M, 49 - k * 9, { size: 7.3, color: soft }));
      right((i + 1) + ' / ' + pages.length, R, 49, { font: bold, size: 8, color: soft });
    });

    doc.setTitle(safe('Devis ' + (quote.reference || '') + ' - ' + brand));
    doc.setAuthor(safe(co.legal_name || brand));
    return doc.save();
  }

  window.QuotePdf = { computeTotals, build, round2, logoPng };
})();
