// Calcul des totaux et fabrication du PDF d'un devis créé dans le CRM (mise en page reprise des devis Tolteck).
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
    const W = 595.28, H = 841.89, M = 40, R = W - M;
    const ink = rgb(0.1, 0.12, 0.15), gray = rgb(0.38, 0.42, 0.48), blue = rgb(0.36, 0.5, 0.74), light = rgb(0.94, 0.95, 0.97), navy = rgb(0.05, 0.24, 0.45);
    const t = computeTotals(quote.lines, co.vat_rate);
    const logoData = await logoPng();
    const logo = logoData ? await doc.embedPng(logoData) : null;

    let page, y;
    const pages = [];
    const txt = (s, x, yy, o) => page.drawText(safe(s), Object.assign({ x, y: yy, size: 9.5, font, color: ink }, o));
    const right = (s, xr, yy, o) => { const f = (o && o.font) || font, sz = (o && o.size) || 9.5; txt(s, xr - f.widthOfTextAtSize(safe(s), sz), yy, o); };
    const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = H - 50; };

    // Colonnes du tableau
    const C = { n: M + 6, des: M + 26, desW: 268, qty: 392, pu: 452, tva: 492, tot: R - 6 };
    const tableHead = () => {
      page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 20, color: blue });
      const o = { font: bold, size: 9, color: rgb(1, 1, 1) };
      txt('N°', C.n, y, o); txt('Désignation', C.des, y, o); right('Qté', C.qty, y, o); right('PU HT', C.pu, y, o); right('TVA', C.tva + 10, y, o); right('Total HT', C.tot, y, o);
      y -= 26;
    };

    newPage();
    // ---------------------------------------------------------------- en-tête
    if (logo) page.drawImage(logo, { x: M, y: y - 34, width: 44, height: 44 });
    const hx = logo ? M + 54 : M;
    txt(co.legal_name || co.name, hx, y - 6, { font: bold, size: 20 });
    txt(co.trade_name || '', hx, y - 22, { size: 10, color: gray });
    y -= 58;

    const top = y;
    const coLines = [].concat(safe(co.address || '').split('\n'), ['France', co.phone ? 'Tél : ' + co.phone : '', co.email || '']).filter(Boolean);
    coLines.forEach((l, i) => txt(l, M, top - i * 12.5, { size: 9.5 }));

    // Bloc client (à droite)
    const cx = 318;
    const clientLines = [].concat(safe(client.address || '').split('\n'), [[client.postal_code, client.city].filter(Boolean).join(' '), 'France']).filter(Boolean);
    const boxH = 22 + (clientLines.length + (client.company ? 1 : 0)) * 12.5;
    page.drawRectangle({ x: cx - 10, y: top - boxH + 12, width: R - cx + 10, height: boxH, color: light });
    txt(client.name, cx, top - 2, { font: bold, size: 10.5 });
    let cy = top - 16;
    if (client.company) { txt(client.company, cx, cy); cy -= 12.5; }
    clientLines.forEach((l) => { txt(l, cx, cy); cy -= 12.5; });

    y = Math.min(top - coLines.length * 12.5, top - boxH) - 16;

    // Date, numéro, validité / adresse du projet
    const infoTop = y;
    txt('En date du ' + frDate(quote.issue_date), M, y, { size: 9.5, color: gray });
    txt('Devis n° ' + (quote.reference || ''), M, y - 18, { font: bold, size: 13, color: navy });
    txt('Valable jusqu\'au ' + frDate(quote.valid_until), M, y - 33, { size: 9.5, color: gray });
    const proj = safe(quote.project_address || '').split('\n').filter(Boolean);
    if (proj.length) {
      txt('Adresse du projet :', cx, infoTop, { size: 9, color: gray });
      page.drawRectangle({ x: cx - 10, y: infoTop - 10 - proj.length * 12.5 - 4, width: R - cx + 10, height: proj.length * 12.5 + 8, color: light });
      proj.forEach((l, i) => txt(l, cx, infoTop - 18 - i * 12.5));
    }
    y = Math.min(infoTop - 50, infoTop - 26 - proj.length * 12.5) - 14;

    if (quote.title) { txt(quote.title, M, y, { font: bold, size: 12 }); y -= 22; }

    // ---------------------------------------------------------------- lignes
    tableHead();
    t.rows.forEach((l, i) => {
      const label = wrap(l.label, bold, 9.5, C.desW);
      const desc = l.description ? wrap(l.description, font, 8.3, C.desW) : [];
      const h = label.length * 12 + desc.length * 10.5 + 10;
      if (y - h < 150) { newPage(); tableHead(); }
      txt(String(i + 1), C.n, y);
      label.forEach((ln, k) => txt(ln, C.des, y - k * 12, { font: bold }));
      desc.forEach((ln, k) => txt(ln, C.des, y - label.length * 12 - k * 10.5, { size: 8.3, color: gray }));
      right(String(Number(l.qty).toLocaleString('fr-FR')) + ' ' + (l.unit || ''), C.qty, y);
      right(eur(l.pu_ht), C.pu, y);
      right(t.rate + ' %', C.tva + 10, y);
      right(eur(l.total_ht), C.tot, y);
      y -= h;
      page.drawLine({ start: { x: M, y: y + 5 }, end: { x: R, y: y + 5 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    });

    // ---------------------------------------------------------------- totaux
    if (y < 230) newPage();
    y -= 10;
    const terms = wrap(co.payment_terms || '', font, 9, 240);
    terms.forEach((ln, k) => txt(ln, M, y - k * 12, { size: 9, color: gray }));
    const tx = 340;
    txt('Total HT', tx, y); right(eur(t.ht), C.tot, y);
    txt('TVA à ' + t.rate + ' %', tx, y - 16); right(eur(t.tva), C.tot, y - 16);
    page.drawRectangle({ x: tx - 8, y: y - 39, width: R - tx + 8, height: 20, color: blue });
    txt('Total TTC', tx, y - 33, { font: bold, color: rgb(1, 1, 1), size: 10.5 }); right(eur(t.ttc), C.tot, y - 33, { font: bold, color: rgb(1, 1, 1), size: 10.5 });
    y = Math.min(y - terms.length * 12, y - 39) - 22;

    // ---------------------------------------------------------------- mentions
    [co.vat_mention, co.extra_mention].filter(Boolean).forEach((m) => {
      wrap(m, font, 8.3, R - M).forEach((ln) => { if (y < 70) newPage(); txt(ln, M, y, { size: 8.3, color: gray }); y -= 10.5; });
      y -= 4;
    });

    // ---------------------------------------------------------------- accord du client
    if (y < 150) newPage();
    y -= 14;
    const bx = 318;
    page.drawRectangle({ x: bx - 10, y: y - 72, width: R - bx + 10, height: 84, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.8 });
    txt('Le client', bx, y - 4, { font: bold, size: 10 });
    txt('« Devis reçu avant l\'exécution des travaux.', bx, y - 20, { size: 8.5, color: gray });
    txt('Bon pour travaux. »', bx, y - 31, { size: 8.5, color: gray });
    txt('Signature électronique : voir le certificat', bx, y - 52, { size: 8, color: gray });
    txt('joint en fin de document une fois signé.', bx, y - 62, { size: 8, color: gray });
    txt(co.legal_name || co.name, M, y - 4, { font: bold, size: 10 });

    // ---------------------------------------------------------------- pied de page (toutes les pages)
    const foot1 = [co.legal_name, safe(co.address || '').replace(/\n/g, ', ') + ', France', co.phone ? 'Téléphone : ' + co.phone : '', co.email ? 'e-mail : ' + co.email : ''].filter(Boolean).join(' — ');
    const foot2 = [[co.legal_form, co.capital ? 'au capital de ' + co.capital : ''].filter(Boolean).join(' '), co.siege ? 'Siège : ' + co.siege : '',
      co.siret ? 'SIRET : ' + co.siret : '', co.rcs || '', co.tva_number ? 'TVA : ' + co.tva_number : '', co.insurance ? 'Assurance : ' + co.insurance : '', co.iban ? 'IBAN : ' + co.iban : ''].filter(Boolean).join(' — ');
    pages.forEach((p, i) => {
      page = p;
      const lines = wrap(foot1, font, 6.8, R - M - 50).concat(wrap(foot2, font, 6.8, R - M - 50));
      lines.forEach((ln, k) => txt(ln, M, 46 - k * 8.5, { size: 6.8, color: gray }));
      right('Page ' + (i + 1) + ' / ' + pages.length, R, 46, { size: 7, color: gray });
    });

    doc.setTitle(safe('Devis ' + (quote.reference || '')));
    doc.setAuthor(safe(co.legal_name || co.name || ''));
    return doc.save();
  }

  window.QuotePdf = { computeTotals, build, round2 };
})();
