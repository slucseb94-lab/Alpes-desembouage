// Conditions générales de vente : texte de référence + fabrication du PDF (même charte que les devis).
// Les coordonnées de l'entreprise et du médiateur viennent des Réglages (Mentions des devis).
// ⚠️ Modèle rédigé avec soin mais à faire relire par un professionnel du droit avant usage.
(function () {
  const safe = (s) => String(s == null ? '' : s)
    .replace(/[  ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF€«»\n]/g, '');

  function wrap(text, font, size, maxWidth) {
    const out = [];
    safe(text).split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).forEach((word) => {
        if (!word) return;
        const test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) { line = test; return; }
        if (line) out.push(line);
        line = word;
      });
      out.push(line);
    });
    return out;
  }

  // ---------------------------------------------------------------- texte des CGV
  // Chaque article : titre + paragraphes. Un paragraphe commençant par « • » est une puce.
  function articles(co) {
    const ident = co.legal_name + ', ' + co.legal_form + ' au capital de ' + co.capital + ', dont le siège social est situé ' + co.siege +
      ', immatriculée au ' + co.rcs + ' (SIRET ' + co.siret + '), n° de TVA intracommunautaire ' + co.tva_number +
      ', exerçant sous le nom commercial « ' + co.name + ' »';
    const contact = safe(co.address).replace(/\n/g, ', ') + ' — tél. ' + co.phone + ' — ' + co.email;
    const med = co.mediator_name
      ? 'le médiateur de la consommation suivant : ' + co.mediator_name + (co.mediator_url ? ' — ' + co.mediator_url : '') + (co.mediator_address ? ' — ' + co.mediator_address : '') + '.'
      : 'un médiateur de la consommation, dont les coordonnées sont communiquées au Client sur simple demande.';
    const days = Number(co.validity_days) || 30;
    const rate = Number(co.vat_rate) || 10;

    return [
      ['Article 1 — Identification du Prestataire', [
        'Les présentes conditions générales de vente (ci-après « CGV ») sont proposées par ' + ident + ' (ci-après « le Prestataire »).',
        'Adresse de correspondance : ' + contact + '.'
      ]],
      ['Article 2 — Objet et champ d\'application', [
        'Les CGV régissent les prestations de désembouage de circuits de chauffage (radiateurs, planchers chauffants et circuits mixtes) réalisées par le Prestataire au profit de ses clients (ci-après « le Client »).',
        'Elles s\'appliquent principalement aux clients consommateurs. Les dispositions particulières applicables aux clients professionnels (entreprises, syndics, bailleurs…) figurent à l\'article 16.',
        'Les CGV sont jointes à chaque devis. La signature du devis vaut acceptation des CGV, qui prévalent sur tout autre document, sauf conditions particulières convenues par écrit.'
      ]],
      ['Article 3 — Devis et formation du contrat', [
        'Toute prestation fait l\'objet d\'un devis gratuit et préalable, établi sur la base des informations communiquées par le Client (type d\'installation, nombre de radiateurs ou de boucles, accès…). Le devis est valable ' + days + ' jours à compter de sa date d\'émission.',
        'Le contrat est formé à la signature du devis par le Client, de manière manuscrite ou électronique. Conformément aux articles 1366 et 1367 du Code civil, la signature électronique a la même valeur qu\'une signature manuscrite. Les éléments enregistrés lors de la signature (nom, date, heure, adresse IP, empreinte numérique du document) font preuve de l\'accord du Client.'
      ]],
      ['Article 4 — Contenu de la prestation', [
        'Sauf mention contraire au devis, la prestation de désembouage comprend :',
        '• un contrôle visuel préalable de l\'installation accessible ;',
        '• le désembouage du circuit par injection d\'un mélange d\'eau et d\'air sous pression à l\'aide d\'une centrale de désembouage, circuit complet et radiateur par radiateur ou boucle par boucle ;',
        '• le rinçage du circuit, l\'injection d\'un inhibiteur de protection, la remise en eau et en pression ;',
        '• des conseils d\'entretien.',
        'Ne sont pas compris, sauf mention expresse au devis : la réparation ou le remplacement de pièces (radiateurs, vannes, robinets thermostatiques, purgeurs, joints, circulateur, vase d\'expansion…), toute intervention sur le générateur de chaleur (chaudière, pompe à chaleur, ballon, brûleur, régulation), l\'équilibrage de l\'installation et la recherche de fuite.'
      ]],
      ['Article 5 — Prix', [
        'Les prix sont exprimés en euros toutes taxes comprises (TTC). Ils sont fermes pour la durée de validité du devis.',
        'Le prix est établi selon le nombre de radiateurs ou de boucles déclaré par le Client. Si ce nombre s\'avère différent sur place, le prix est ajusté selon le tarif unitaire du devis ; le Client en est informé et donne son accord avant l\'exécution des éléments supplémentaires.',
        'Le taux réduit de TVA de ' + rate + ' % s\'applique aux travaux réalisés dans des locaux d\'habitation achevés depuis plus de deux ans, sur attestation du Client figurant au devis. En cas de déclaration inexacte, le Client reste redevable du complément de TVA et des éventuelles pénalités.'
      ]],
      ['Article 6 — Paiement', [
        'Aucun acompte n\'est demandé. Le prix est payable à la fin de l\'intervention, par chèque, virement bancaire, carte bancaire (lorsque ce moyen est proposé) ou en espèces dans la limite fixée par la loi.',
        'Lorsque le contrat est conclu au domicile du Client (contrat hors établissement), aucun paiement ne peut être reçu avant l\'expiration d\'un délai de sept jours à compter de sa conclusion (article L221-10 du Code de la consommation) ; le règlement intervient alors au plus tôt à l\'issue de ce délai.',
        'En cas de retard de paiement, les sommes dues portent intérêt au taux légal à compter de la mise en demeure adressée au Client.'
      ]],
      ['Article 7 — Droit de rétractation (clients consommateurs)', [
        'Le contrat étant conclu à distance (signature en ligne) ou hors établissement, le Client consommateur dispose d\'un délai de quatorze (14) jours à compter de la conclusion du contrat pour exercer son droit de rétractation, sans avoir à motiver sa décision ni à supporter d\'autres coûts que ceux prévus ci-dessous.',
        'Pour l\'exercer, le Client adresse au Prestataire, avant l\'expiration du délai, le formulaire de rétractation figurant en annexe ou toute autre déclaration dénuée d\'ambiguïté, par courrier ou par e-mail aux coordonnées indiquées à l\'article 1. Le Prestataire rembourse les sommes éventuellement versées au plus tard dans les quatorze jours suivant la réception de la rétractation.',
        'Intervention avant la fin du délai : la prestation ne peut commencer avant la fin du délai de rétractation que si le Client en fait la demande expresse, notamment en cochant la case prévue à cet effet lors de la signature. Si le Client se rétracte après le début de la prestation, il verse un montant proportionnel à ce qui a été réalisé jusqu\'à la communication de sa décision. Conformément à l\'article L221-28 1° du Code de la consommation, le droit de rétractation ne peut plus être exercé lorsque la prestation a été pleinement exécutée avant la fin du délai, à la demande expresse du Client qui a reconnu perdre ce droit une fois la prestation entièrement exécutée.'
      ]],
      ['Article 8 — Date d\'intervention, report et annulation', [
        'La date d\'intervention est fixée d\'un commun accord. Le Prestataire s\'engage à intervenir à la date convenue, sauf cas de force majeure ou circonstance imprévisible (intempéries, accident, indisponibilité soudaine), auquel cas il en informe le Client dans les meilleurs délais et propose une nouvelle date.',
        'Le Client peut reporter l\'intervention sans frais en prévenant le Prestataire au moins quarante-huit (48) heures à l\'avance. En cas d\'absence du Client au rendez-vous convenu sans avoir prévenu, un nouveau déplacement pourra faire l\'objet d\'une facturation après information préalable du Client.'
      ]],
      ['Article 9 — Obligations du Client', [
        'Le Client s\'engage à :',
        '• assurer un accès libre et sécurisé à l\'installation, aux radiateurs, au collecteur et au générateur de chaleur ;',
        '• mettre à disposition l\'eau, l\'électricité et, dans la mesure du possible, une place de stationnement à proximité ;',
        '• garantir la présence d\'une personne majeure pendant toute la durée de l\'intervention ;',
        '• informer le Prestataire, avant l\'intervention, de toute particularité de l\'installation : fuites connues, réparations ou travaux récents, ancienneté, défauts ou pannes déjà constatés, présence de produits dans le circuit.'
      ]],
      ['Article 10 — État de l\'installation et limites de responsabilité', [
        '10.1 — Nature de la prestation. Le désembouage est une opération de nettoyage du circuit de chauffage. Il ne constitue ni une réparation ni une remise à neuf. Le Prestataire intervient sur une installation existante dont il n\'est ni l\'installateur ni le mainteneur.',
        '10.2 — Défauts préexistants révélés par le désembouage. Les boues et dépôts présents dans un circuit peuvent masquer ou colmater des défauts déjà existants : corrosion, microfuites, joints usés, raccords fragilisés, vannes, robinets thermostatiques ou purgeurs grippés ou défectueux, circulateur ou vase d\'expansion en fin de vie… Le nettoyage du circuit peut faire apparaître ces défauts pendant ou après l\'intervention. Leur apparition résulte de l\'état antérieur de l\'installation et non de la prestation : elle ne peut être imputée au Prestataire et n\'est pas couverte au titre de la prestation. Le Prestataire en informe le Client et peut, à sa demande, proposer une réparation sur devis séparé.',
        '10.3 — Générateur de chaleur et équipements non concernés. La chaudière, la pompe à chaleur, le ballon d\'eau chaude, le brûleur, la régulation et tout équipement électrique ou électronique de l\'installation ne font pas partie de la prestation. Leurs pannes, mises en sécurité, défauts ou dysfonctionnements, qu\'ils surviennent pendant ou après l\'intervention, ne relèvent pas de la prestation et ne peuvent être imputés au Prestataire, sauf faute prouvée de sa part. L\'entretien de ces équipements relève d\'un professionnel qualifié (l\'entretien annuel des chaudières est obligatoire).',
        '10.4 — Réserves. Si le Prestataire constate, avant ou pendant l\'intervention, un état de l\'installation présentant un risque (corrosion avancée, fuite, matériel vétuste), il en informe le Client, peut formuler des réserves écrites, et peut suspendre ou refuser l\'intervention. Le Client peut décider de la poursuivre en connaissance de cause.',
        '10.5 — Responsabilité du Prestataire. Les stipulations ci-dessus ne limitent pas la responsabilité du Prestataire pour les dommages causés par une faute de sa part dans l\'exécution de la prestation, conformément au droit commun.'
      ]],
      ['Article 11 — Garantie et assurances', [
        'Le Prestataire réalise la prestation avec soin et conformément aux règles de l\'art. En cas de non-conformité de la prestation qui lui est imputable, signalée par le Client dans les meilleurs délais, le Prestataire intervient à nouveau gratuitement pour y remédier.',
        'L\'efficacité du désembouage dans le temps dépend de l\'état et de l\'entretien ultérieur de l\'installation (qualité de l\'eau, appoints, présence d\'un filtre) ; aucune durée de résultat n\'est garantie.',
        'Le Prestataire est assuré en responsabilité civile professionnelle et en responsabilité décennale auprès de ' + co.insurance + (co.insurance_zone ? ', couverture géographique : ' + co.insurance_zone : '') + '.'
      ]],
      ['Article 12 — Force majeure', [
        'Aucune des parties ne pourra être tenue responsable d\'un retard ou d\'une inexécution résultant d\'un cas de force majeure au sens de l\'article 1218 du Code civil.'
      ]],
      ['Article 13 — Données personnelles', [
        'Le Prestataire, responsable de traitement, collecte les données du Client (identité, coordonnées, adresse du chantier, informations sur l\'installation, historique des échanges, éléments de signature) pour établir les devis, réaliser les interventions, facturer, assurer le suivi de la relation client et conserver la preuve des engagements. Ces traitements reposent sur l\'exécution du contrat et le respect des obligations légales du Prestataire.',
        'Les données sont destinées au Prestataire et à ses éventuels techniciens ou sous-traitants pour les besoins de l\'intervention ; elles sont hébergées au sein de l\'Union européenne et ne sont ni vendues ni cédées. Elles sont conservées pendant la durée de la relation commerciale puis trois ans à compter du dernier contact, les pièces comptables pendant dix ans et les éléments de preuve pendant la durée de prescription applicable.',
        'Le Client dispose d\'un droit d\'accès, de rectification, d\'effacement, de limitation, d\'opposition et de portabilité de ses données, qu\'il exerce par e-mail à ' + co.email + '. Il peut introduire une réclamation auprès de la CNIL (www.cnil.fr).'
      ]],
      ['Article 14 — Réclamations et médiation', [
        'Toute réclamation doit d\'abord être adressée au Prestataire par écrit (courrier ou e-mail) afin de rechercher une solution amiable.',
        'À défaut d\'accord dans un délai de deux mois, le Client consommateur peut recourir gratuitement à ' + med + ' Le recours à la médiation doit intervenir dans un délai d\'un an à compter de la réclamation écrite adressée au Prestataire.'
      ]],
      ['Article 15 — Droit applicable et litiges', [
        'Les présentes CGV sont soumises au droit français. À défaut de solution amiable, le Client consommateur peut saisir, à son choix, la juridiction du lieu où il demeurait au moment de la conclusion du contrat, du lieu d\'exécution de la prestation, ou celle désignée par les règles de droit commun.'
      ]],
      ['Article 16 — Clients professionnels', [
        'Lorsque le Client agit pour les besoins de son activité professionnelle (entreprise, syndic de copropriété, bailleur professionnel…), les articles 6 (dernier alinéa), 7 et 15 sont remplacés par les dispositions suivantes : les factures sont payables à réception, et au plus tard à trente jours ; tout retard entraîne de plein droit des pénalités au taux de trois fois le taux d\'intérêt légal ainsi qu\'une indemnité forfaitaire pour frais de recouvrement de 40 € (article L441-10 du Code de commerce) ; le Client ne bénéficie pas du droit de rétractation ; tout litige relève de la compétence du tribunal de commerce de Chambéry.'
      ]]
    ];
  }

  function withdrawalForm(co) {
    return [
      'À l\'attention de ' + co.legal_name + ' (« ' + co.name + ' »), ' + safe(co.address).replace(/\n/g, ', ') + ' — ' + co.email + ' :',
      'Je / Nous (*) vous notifie / notifions (*) par la présente ma / notre (*) rétractation du contrat portant sur la prestation de services ci-dessous :',
      'Devis n° : ........................................................   Signé le : ................................................',
      'Nom du (des) consommateur(s) : ..........................................................................................................',
      'Adresse du (des) consommateur(s) : ......................................................................................................',
      '...............................................................................................................................................',
      'Signature du (des) consommateur(s) (uniquement en cas de notification sur papier) :',
      '',
      'Date : ....................................',
      '(*) Rayez la mention inutile.'
    ];
  }

  // ---------------------------------------------------------------- PDF
  async function build(co, logoData) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 48, R = W - M, TW = R - M;
    const ink = rgb(0.12, 0.14, 0.18), gray = rgb(0.38, 0.42, 0.48), soft = rgb(0.55, 0.59, 0.65);
    const navy = rgb(0.05, 0.24, 0.45), orange = rgb(0.94, 0.46, 0.17), line = rgb(0.86, 0.89, 0.93), light = rgb(0.953, 0.965, 0.98);
    const logo = logoData ? await doc.embedPng(logoData) : null;
    const today = new Date().toLocaleDateString('fr-FR');
    const brand = safe(co.name);

    let page, y;
    const pages = [];
    const txt = (s, x, yy, o) => page.drawText(safe(s), Object.assign({ x, y: yy, size: 9.6, font, color: ink }, o));
    const bottom = 78;
    const newPage = (first) => {
      page = doc.addPage([W, H]); pages.push(page);
      y = H - 46;
      if (!first) {
        txt(brand, M, y - 8, { font: bold, size: 12, color: navy });
        const t = 'Conditions générales de vente';
        txt(t, R - font.widthOfTextAtSize(t, 9), y - 8, { size: 9, color: gray });
        page.drawRectangle({ x: M, y: y - 18, width: TW, height: 0.8, color: line });
        y -= 38;
      }
    };
    const ensure = (h) => { if (y - h < bottom) newPage(false); };

    newPage(true);
    if (logo) page.drawImage(logo, { x: M - 4, y: y - 44, width: 54, height: 54 });
    const hx = logo ? M + 58 : M;
    txt(brand, hx, y - 16, { font: bold, size: 22, color: navy });
    txt('Conditions générales de vente', hx, y - 34, { size: 12, color: gray });
    const v = 'Version du ' + today;
    txt(v, R - font.widthOfTextAtSize(v, 9), y - 16, { size: 9, color: soft });
    y -= 60;
    page.drawRectangle({ x: M, y, width: TW, height: 1, color: line });
    page.drawRectangle({ x: M, y: y - 1, width: 70, height: 3, color: orange });
    y -= 24;

    articles(co).forEach(([title, paras]) => {
      ensure(40);
      txt(title, M, y, { font: bold, size: 11, color: navy });
      y -= 16;
      paras.forEach((p) => {
        const bullet = p.startsWith('• ');
        const x = bullet ? M + 12 : M;
        const lines = wrap(bullet ? p.slice(2) : p, font, 9.6, TW - (bullet ? 12 : 0));
        lines.forEach((ln, i) => {
          ensure(13);
          if (bullet && i === 0) txt('•', M + 2, y, { font: bold, color: orange });
          txt(ln, x, y);
          y -= 12.6;
        });
        y -= 4;
      });
      y -= 8;
    });

    // Annexe : formulaire de rétractation (sur une page dédiée, facile à imprimer)
    newPage(false);
    txt('Annexe — Formulaire de rétractation', M, y, { font: bold, size: 14, color: navy });
    y -= 18;
    wrap('(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)', font, 9.6, TW)
      .forEach((ln) => { txt(ln, M, y, { color: gray }); y -= 12.6; });
    y -= 14;
    const boxTop = y;
    const form = withdrawalForm(co);
    const formH = form.reduce((h, p) => h + Math.max(1, wrap(p, font, 10, TW - 32).length) * 15 + 8, 24);
    page.drawRectangle({ x: M, y: boxTop - formH, width: TW, height: formH, color: light });
    y -= 22;
    form.forEach((p) => {
      wrap(p, font, 10, TW - 32).forEach((ln) => { txt(ln, M + 16, y, { size: 10 }); y -= 15; });
      y -= 8;
    });

    // Pied de page
    const foot = [co.legal_name + ' (' + brand + ')', co.legal_form + ' au capital de ' + co.capital, co.rcs, 'SIRET ' + co.siret].join('  ·  ');
    pages.forEach((p, i) => {
      page = p;
      page.drawRectangle({ x: M, y: 56, width: TW, height: 0.8, color: line });
      txt(foot, M, 44, { size: 7.3, color: soft });
      const n = (i + 1) + ' / ' + pages.length;
      txt(n, R - bold.widthOfTextAtSize(n, 8), 44, { font: bold, size: 8, color: soft });
    });

    doc.setTitle(safe('Conditions générales de vente - ' + brand));
    doc.setAuthor(safe(co.legal_name));
    return doc.save();
  }

  window.CgvPdf = { build, articles };
})();
