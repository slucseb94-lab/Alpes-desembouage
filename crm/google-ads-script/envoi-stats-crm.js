/**
 * CRM Alpes Désembouage — envoi automatique des statistiques Google Ads vers le CRM.
 *
 * Installation (une seule fois) : Google Ads → Outils → Actions groupées → Scripts → « + » (nouveau script)
 *  1. Coller tout ce fichier, remplacer COLLER_ICI_LA_CLE par la clé affichée dans le CRM (Réglages → Publicité).
 *  2. « Autoriser » puis « Exécuter » une première fois : les chiffres depuis le 1er janvier sont envoyés.
 *  3. Fréquence : « Tous les jours », vers 6 h du matin.
 *
 * Le script n'envoie que des chiffres agrégés par jour et par campagne (clics, impressions, coût, conversions) :
 * aucune donnée personnelle.
 */
var CLE_SECRETE = 'COLLER_ICI_LA_CLE';
var URL_CRM = 'https://mgkbhucggqrkrtoyhjwi.supabase.co/rest/v1/rpc/ads_upsert';
var CLE_PUBLIQUE = 'sb_publishable_uKPWZqfI6BG4AOTL2uvAuQ_Mz7J6VdR';

function main() {
  // Toute l'année en cours à chaque exécution (peu de données ; Google corrige parfois les chiffres des jours passés)
  var tz = AdsApp.currentAccount().getTimeZone();
  var debut = Utilities.formatDate(new Date(new Date().getFullYear(), 0, 1), tz, 'yyyy-MM-dd');
  var periode = "segments.date BETWEEN '" + debut + "' AND '" + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + "'";

  var requete = 'SELECT segments.date, campaign.name, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions ' +
    'FROM campaign WHERE ' + periode + ' AND metrics.impressions > 0';
  var lignes = [];
  var it = AdsApp.search(requete);
  while (it.hasNext()) {
    var r = it.next();
    lignes.push({
      day: r.segments.date,
      campaign: r.campaign.name,
      clicks: Number(r.metrics.clicks || 0),
      impressions: Number(r.metrics.impressions || 0),
      cost: Math.round(Number(r.metrics.costMicros || 0) / 10000) / 100,
      conversions: Number(r.metrics.conversions || 0)
    });
  }

  var rep = UrlFetchApp.fetch(URL_CRM, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: CLE_PUBLIQUE },
    payload: JSON.stringify({ p_secret: CLE_SECRETE, p_platform: 'google', p_rows: lignes }),
    muteHttpExceptions: true
  });
  var code = rep.getResponseCode();
  if (code !== 200) throw new Error('Envoi au CRM refusé (' + code + ') : ' + rep.getContentText());
  Logger.log('Envoyé au CRM : ' + lignes.length + ' ligne(s) — ' + rep.getContentText());
}
