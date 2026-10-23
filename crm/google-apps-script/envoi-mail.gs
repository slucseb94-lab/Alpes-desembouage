/**
 * CRM Alpes Désembouage — script Google personnel :
 *   1. envoi des e-mails depuis votre compte Gmail ;
 *   2. synchronisation des rendez-vous avec le calendrier Google « CRM Alpes Désembouage »
 *      (affiché dans l'app Calendrier de l'iPhone).
 *
 * Installation / mise à jour : voir crm/README.md (« Envoi des e-mails » et « Calendrier iPhone »).
 *  - Coller tout ce fichier dans le projet, remplacer COLLER_ICI_LA_CLE par la clé du CRM.
 *  - Remplacer aussi le fichier appsscript.json par crm/google-apps-script/appsscript.json.
 *  - Déployer → Gérer les déploiements → crayon → Version : Nouvelle version → Déployer → autoriser.
 *
 * Droits demandés par Google : envoyer des e-mails en votre nom, gérer vos agendas Google
 * (le script ne touche qu'au calendrier « CRM Alpes Désembouage »), voir votre adresse e-mail.
 */

const CLE_SECRETE = 'COLLER_ICI_LA_CLE';
const NOM_CALENDRIER = 'CRM Alpes Désembouage';

// Sauvegarde hebdomadaire du CRM dans Google Drive (clé générée dans le CRM : Réglages → Sauvegarde)
const CLE_SAUVEGARDE = 'COLLER_ICI_LA_CLE_DE_SAUVEGARDE';
const URL_SUPABASE = 'https://mgkbhucggqrkrtoyhjwi.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_uKPWZqfI6BG4AOTL2uvAuQ_Mz7J6VdR';
const DOSSIER_DRIVE = 'CRM Alpes Désembouage';
const SAUVEGARDES_GARDEES = 12;

// Ouvrir l'URL /exec dans un navigateur affiche simplement ce message (utile pour vérifier le déploiement).
function doGet() {
  return ContentService.createTextOutput('Script du CRM Alpes Désembouage : OK — version 4 (e-mails, pièces jointes, calendrier, sauvegardes).');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!CLE_SECRETE || CLE_SECRETE === 'COLLER_ICI_LA_CLE' || data.secret !== CLE_SECRETE) {
      return reponse({ ok: false, error: 'Clé incorrecte' });
    }
    if (data.test) {
      return reponse({ ok: true, from: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() });
    }
    // ---------------------------------------------------------------- calendrier
    if (data.action === 'cal_upsert') return reponse(calUpsert(data));
    if (data.action === 'cal_delete') return reponse(calDelete(data));
    if (data.action === 'cal_list') return reponse(calList(data));
    if (data.action === 'drive_save') return reponse(driveSave(data));
    if (data.action === 'cal_test') {
      const cal = calendrier();
      return reponse({ ok: true, calendar: cal.getName(), email: Session.getEffectiveUser().getEmail() });
    }

    // ---------------------------------------------------------------- e-mail
    const to = String(data.to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return reponse({ ok: false, error: 'Adresse e-mail invalide' });
    // MailApp ne demande que le droit d'ENVOYER des e-mails (pas de lecture ni de suppression de votre boîte).
    // Pièces jointes éventuelles (PDF des factures), transmises encodées en base64
    const attachments = (data.attachments || []).slice(0, 5).map((a) =>
      Utilities.newBlob(Utilities.base64Decode(a.base64), a.type || 'application/pdf', String(a.name || 'document.pdf')));
    MailApp.sendEmail({
      to: to,
      subject: String(data.subject || '').slice(0, 200),
      body: String(data.text || ''),
      htmlBody: data.html || undefined,
      name: data.fromName || 'Alpes Désembouage',
      attachments: attachments
    });
    return reponse({ ok: true, quota: MailApp.getRemainingDailyQuota(), attachments: attachments.length });
  } catch (err) {
    return reponse({ ok: false, error: String(err && err.message || err) });
  }
}

// Calendrier dédié, créé automatiquement à la première utilisation.
function calendrier() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CAL_ID');
  let cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    const found = CalendarApp.getCalendarsByName(NOM_CALENDRIER);
    cal = found.length ? found[0] : CalendarApp.createCalendar(NOM_CALENDRIER, { color: CalendarApp.Color.BLUE, summary: 'Rendez-vous du CRM Alpes Désembouage' });
    try { cal.setTimeZone('Europe/Paris'); } catch (e) { /* facultatif */ }
    props.setProperty('CAL_ID', cal.getId());
  }
  return cal;
}

function trouver(cal, id) {
  if (!id) return null;
  try { return cal.getEventById(id); } catch (e) { return null; }
}

// Crée ou met à jour un rendez-vous (identifié par l'identifiant du CRM, mémorisé dans l'événement).
function calUpsert(d) {
  const cal = calendrier();
  const start = new Date(d.start), end = new Date(d.end);
  let ev = trouver(cal, d.gcal_id);
  if (ev) {
    ev.setTitle(d.title || 'Rendez-vous');
    ev.setTime(start, end);
    ev.setLocation(d.location || '');
    ev.setDescription(d.description || '');
  } else {
    ev = cal.createEvent(d.title || 'Rendez-vous', start, end, { location: d.location || '', description: d.description || '' });
  }
  if (d.crm_id) ev.setTag('crm_id', String(d.crm_id));
  return { ok: true, id: ev.getId() };
}

function calDelete(d) {
  const ev = trouver(calendrier(), d.gcal_id);
  if (ev) ev.deleteEvent();
  return { ok: true };
}

// Liste les événements du calendrier sur une période (y compris ceux notés directement sur l'iPhone).
function calList(d) {
  const events = calendrier().getEvents(new Date(d.from), new Date(d.to)).map((ev) => ({
    id: ev.getId(),
    title: ev.getTitle(),
    start: ev.getStartTime().toISOString(),
    end: ev.getEndTime().toISOString(),
    all_day: ev.isAllDayEvent(),
    location: ev.getLocation(),
    description: ev.getDescription(),
    crm_id: ev.getTag('crm_id') || null,
    updated: ev.getLastUpdated().toISOString()
  }));
  return { ok: true, events: events };
}

// ---------------------------------------------------------------- Google Drive
// Dossier « CRM Alpes Désembouage / <sous-dossier> », créé s'il n'existe pas.
function dossier(sousDossier) {
  const racines = DriveApp.getFoldersByName(DOSSIER_DRIVE);
  const racine = racines.hasNext() ? racines.next() : DriveApp.createFolder(DOSSIER_DRIVE);
  if (!sousDossier) return racine;
  let courant = racine;
  String(sousDossier).split('/').forEach((nom) => {
    const it = courant.getFoldersByName(nom);
    courant = it.hasNext() ? it.next() : courant.createFolder(nom);
  });
  return courant;
}

// Archive un PDF (facture, avoir…) envoyé par le CRM — ne remplace jamais un fichier existant.
function driveSave(d) {
  const nom = String(d.name || 'document.pdf').replace(/[\\/:*?"<>|]/g, '_');
  const cible = dossier(String(d.folder || 'Documents').replace(/[^\w\- /àâçéèêëîïôûùüÿ]/gi, '_'));
  if (cible.getFilesByName(nom).hasNext()) return { ok: true, existing: true };
  cible.createFile(Utilities.newBlob(Utilities.base64Decode(d.base64), d.type || 'application/pdf', nom));
  return { ok: true };
}

// Sauvegarde complète du CRM : à lancer chaque semaine par un déclencheur (voir crm/README.md).
function sauvegardeHebdo() {
  const rep = UrlFetchApp.fetch(URL_SUPABASE + '/rest/v1/rpc/backup_export', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: CLE_PUBLIQUE },
    payload: JSON.stringify({ p_secret: CLE_SAUVEGARDE }),
    muteHttpExceptions: true
  });
  const moi = Session.getEffectiveUser().getEmail();
  if (rep.getResponseCode() !== 200) {
    MailApp.sendEmail(moi, '⚠️ Sauvegarde du CRM échouée', 'La sauvegarde hebdomadaire du CRM a échoué (' + rep.getResponseCode() + ') :\n\n' + rep.getContentText());
    throw new Error('Sauvegarde échouée : ' + rep.getContentText());
  }
  const contenu = rep.getContentText();
  const data = JSON.parse(contenu);
  const nom = 'sauvegarde-crm-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd') + '.json';
  const cible = dossier('Sauvegardes');
  const existants = cible.getFilesByName(nom);
  while (existants.hasNext()) existants.next().setTrashed(true);
  cible.createFile(Utilities.newBlob(contenu, 'application/json', nom));

  // On ne garde que les dernières sauvegardes
  const fichiers = [];
  const it = cible.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^sauvegarde-crm-/.test(f.getName())) fichiers.push(f); }
  fichiers.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(SAUVEGARDES_GARDEES).forEach((f) => f.setTrashed(true));

  Logger.log('Sauvegarde OK : ' + nom + ' — ' + (data.clients || []).length + ' clients, ' + (data.quotes || []).length + ' devis, ' + (data.invoices || []).length + ' factures.');
}

function reponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
