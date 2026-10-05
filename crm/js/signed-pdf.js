// Fabrique le PDF signé : devis d'origine + mention en pied de chaque page + page « Certificat de signature ».
// Utilisé par le CRM (gérant) et par la page de signature (exemplaire du client). Nécessite pdf-lib (PDFLib).
(function () {
  // Les polices standard des PDF ne connaissent que l'alphabet latin (WinAnsi) : on remplace le reste.
  const safe = (s) => String(s == null ? '' : s)
    .replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '');

  function wrap(text, font, size, maxWidth) {
    const lines = [];
    String(text).split('\n').forEach((para) => {
      let line = '';
      para.split(' ').forEach((word) => {
        const test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = word; } else line = test;
      });
      lines.push(line);
    });
    return lines;
  }

  async function sha256Hex(bytes) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildSignedPdf(originalBytes, info) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const blue = rgb(0.05, 0.24, 0.45), gray = rgb(0.35, 0.39, 0.45);
    const when = new Date(info.signed_at);
    const whenText = when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const company = safe(info.company_name || 'Alpes Désembouage');

    // Mention en bas de chaque page du devis
    const pages = doc.getPages();
    const footer = safe('Signé électroniquement par ' + info.signer_name + ' le ' + whenText + ' - Devis ' + (info.reference || '') + ' - voir certificat en dernière page');
    pages.forEach((p, i) => {
      const { width } = p.getSize();
      p.drawText(footer + '  (' + (i + 1) + '/' + pages.length + ')', { x: 24, y: 10, size: 6.5, font, color: gray, maxWidth: width - 48 });
    });

    // Page certificat (format A4)
    const page = doc.addPage([595.28, 841.89]);
    const W = 595.28, M = 56;
    let y = 841.89 - 70;
    const text = (t, opts) => { page.drawText(safe(t), Object.assign({ x: M, y, size: 10, font, color: rgb(0.1, 0.12, 0.15) }, opts)); };

    text('Certificat de signature électronique', { size: 20, font: bold, color: blue });
    y -= 22;
    text(company, { size: 11, color: gray });
    y -= 34;

    const rows = [
      ['Document', 'Devis ' + (info.reference || '(sans numéro)') + (info.with_cgv ? ' + conditions générales de vente' : '')],
      ['Montant', info.amount != null && info.amount !== '' ? Number(info.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' TTC' : '-'],
      ['Client', info.client_name || ''],
      ['Signé par', info.signer_name],
      ['Date et heure', whenText + ' (heure de Paris)'],
      ['Adresse IP', info.signer_ip || 'non disponible'],
      ['Appareil', info.signer_user_agent || 'non disponible'],
      ['Empreinte du devis (SHA-256)', info.doc_hash || '']
    ];
    rows.forEach(([label, value]) => {
      text(label, { size: 9, font: bold, color: gray });
      const lines = wrap(safe(value), font, 10, W - M * 2 - 150);
      lines.forEach((ln, i) => page.drawText(ln, { x: M + 150, y: y - i * 13, size: 10, font }));
      y -= Math.max(1, lines.length) * 13 + 9;
    });

    y -= 10;
    text('Mention acceptée par le signataire :', { size: 9, font: bold, color: gray });
    y -= 15;
    const mention = info.with_cgv
      ? '« J\'ai lu le devis et les conditions générales de vente ci-joints, et je les accepte sans réserve. Bon pour accord. »'
      : '« J\'ai lu le devis ci-joint et je l\'accepte sans réserve. Bon pour accord. »';
    wrap(safe(mention), font, 10, W - M * 2).forEach((ln) => { text(ln); y -= 13; });

    y -= 18;
    text('Signature :', { size: 9, font: bold, color: gray });
    y -= 10;
    if (info.signature_image) {
      const png = await doc.embedPng(info.signature_image);
      const maxW = 260, maxH = 110;
      const k = Math.min(maxW / png.width, maxH / png.height);
      const w = png.width * k, h = png.height * k;
      page.drawRectangle({ x: M, y: y - maxH - 10, width: maxW + 20, height: maxH + 10, borderColor: rgb(0.85, 0.87, 0.9), borderWidth: 1 });
      page.drawImage(png, { x: M + 10, y: y - h - 5, width: w, height: h });
      y -= maxH + 40;
    }

    wrap(safe('Signature électronique simple au sens de l\'article 1367 du Code civil et du règlement européen eIDAS (UE n° 910/2014). ' +
      'Le signataire a consulté le devis puis l\'a accepté via un lien personnel et sécurisé. L\'empreinte SHA-256 ci-dessus identifie de façon unique ' +
      'le document présenté au signataire : toute modification du devis produirait une empreinte différente.'), font, 8.5, W - M * 2)
      .forEach((ln) => { page.drawText(ln, { x: M, y, size: 8.5, font, color: gray }); y -= 11.5; });

    doc.setTitle(safe('Devis ' + (info.reference || '') + ' signé'));
    doc.setProducer(company + ' - CRM');
    return doc.save();
  }

  function downloadBytes(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  window.SignedPdf = { build: buildSignedPdf, sha256Hex, download: downloadBytes };
})();
