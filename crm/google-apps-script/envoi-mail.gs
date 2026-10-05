/**
 * CRM Alpes Désembouage — envoi des e-mails depuis votre compte Gmail.
 *
 * Installation (une seule fois) : voir crm/README.md, section « Envoi des e-mails ».
 *  1. https://script.google.com → Nouveau projet → coller tout ce fichier.
 *  2. Remplacer COLLER_ICI_LA_CLE par la clé affichée dans le CRM (Réglages → Envoi des e-mails).
 *  3. Déployer → Nouveau déploiement → type « Application Web »
 *     Exécuter en tant que : Moi · Qui peut accéder : Tout le monde → Déployer → autoriser.
 *  4. Copier l'URL de l'application Web dans le CRM.
 *
 * Les e-mails partent de VOTRE adresse Gmail (limite Google : 100 destinataires par jour).
 */
const CLE_SECRETE = 'COLLER_ICI_LA_CLE';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!CLE_SECRETE || CLE_SECRETE === 'COLLER_ICI_LA_CLE' || data.secret !== CLE_SECRETE) {
      return reponse({ ok: false, error: 'Clé incorrecte' });
    }
    if (data.test) {
      return reponse({ ok: true, from: Session.getActiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() });
    }
    const to = String(data.to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return reponse({ ok: false, error: 'Adresse e-mail invalide' });

    GmailApp.sendEmail(to, String(data.subject || '').slice(0, 200), String(data.text || ''), {
      htmlBody: data.html || undefined,
      name: data.fromName || 'Alpes Désembouage'
    });
    return reponse({ ok: true, quota: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reponse({ ok: false, error: String(err && err.message || err) });
  }
}

function reponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
