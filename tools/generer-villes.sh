#!/usr/bin/env bash
# Génère les pages « désembouage + ville » (référencement local) :
#   - tools/ville-template.html : le modèle commun à toutes les pages
#   - tools/villes/<ville>.sh   : le texte propre à chaque ville
# Pour ajouter une ville : créer tools/villes/<ville>.sh, l'ajouter à la liste VILLES ci-dessous, relancer ce script.
# Le script met aussi à jour sitemap.xml et la liste de villes de la page d'accueil (entre les repères VILLES).
set -euo pipefail
shopt -u patsub_replacement 2>/dev/null || true
cd "$(dirname "$0")/.."

VILLES="chambery albertville aix-les-bains annecy grenoble annemasse thonon-les-bains"
# Genève : texte prêt dans tools/villes/geneve.sh, ajouter "geneve" à la liste quand on voudra publier la page.
SITE="https://www.alpes-desembouage.fr"
TODAY="$(date +%Y-%m-%d)"

# Blocs repris tels quels de la page d'accueil (une seule source : index.html)
PROCESS="$(sed -n '/<!-- PROCESS -->/,/<!-- LA SOCIETE -->/p' index.html | sed '1d;$d')"
AVIS="$(sed -n '/<!-- AVIS GOOGLE -->/,/<!-- CONTACT -->/p' index.html | sed '1d;$d')"
TPL="$(cat tools/ville-template.html)"

declare -A NOMS
for slug in $VILLES; do
  NOMS[$slug]="$( source "tools/villes/$slug.sh"; printf '%s' "$NOM" )"
done

# Liste de liens pour le pied de page, et pour la page d'accueil
FOOTER_VILLES=""
HOME_LINKS=""
for slug in $VILLES; do
  FOOTER_VILLES+="<a href=\"/desembouage-$slug/\">${NOMS[$slug]}</a> · "
  HOME_LINKS+="          <a href=\"/desembouage-$slug/\">Désembouage à ${NOMS[$slug]}</a>"$'\n'
done
FOOTER_VILLES="${FOOTER_VILLES% · }"

for slug in $VILLES; do
  source "tools/villes/$slug.sh"
  CODE="${DEPT#*(}"; CODE="${CODE%)}"
  TITLE="Désembouage à $NOM ($CODE) | Alpes Désembouage"

  COMMUNES_HTML=""
  IFS=',' read -ra LIST <<< "$COMMUNES"
  for c in "${LIST[@]}"; do COMMUNES_HTML+="          <li>$(echo "$c" | sed 's/^ *//')</li>"$'\n'; done
  COMMUNES_HTML="${COMMUNES_HTML%$'\n'}"

  AUTRES=""
  for other in $VILLES; do
    [ "$other" = "$slug" ] && continue
    AUTRES+="          <a href=\"/desembouage-$other/\">Désembouage à ${NOMS[$other]}</a>"$'\n'
  done
  AUTRES="${AUTRES%$'\n'}"

  out="$TPL"
  out="${out//'{{PROCESS}}'/$PROCESS}"
  out="${out//'{{AVIS}}'/$AVIS}"
  out="${out//'{{COMMUNES_HTML}}'/$COMMUNES_HTML}"
  out="${out//'{{AUTRES_VILLES}}'/$AUTRES}"
  out="${out//'{{FOOTER_VILLES}}'/$FOOTER_VILLES}"
  out="${out//'{{TITLE}}'/$TITLE}"
  out="${out//'{{DESC}}'/$DESC}"
  out="${out//'{{INTRO1}}'/$INTRO1}"
  out="${out//'{{INTRO2}}'/$INTRO2}"
  out="${out//'{{SECTEUR}}'/$SECTEUR}"
  out="${out//'{{FAQ_Q}}'/$FAQ_Q}"
  out="${out//'{{FAQ_R}}'/$FAQ_R}"
  out="${out//'{{DEPT}}'/$DEPT}"
  out="${out//'{{SLUG}}'/$slug}"
  out="${out//'{{NOM}}'/$NOM}"

  mkdir -p "desembouage-$slug"
  printf '%s\n' "$out" > "desembouage-$slug/index.html"
  echo "page créée : desembouage-$slug/index.html"
done

# Plan du site pour Google
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  echo "  <url>"
  echo "    <loc>$SITE/</loc>"
  echo "    <lastmod>$TODAY</lastmod>"
  echo "    <changefreq>monthly</changefreq>"
  echo "    <priority>1.0</priority>"
  echo "  </url>"
  for slug in $VILLES; do
    echo "  <url>"
    echo "    <loc>$SITE/desembouage-$slug/</loc>"
    echo "    <lastmod>$TODAY</lastmod>"
    echo "    <changefreq>monthly</changefreq>"
    echo "    <priority>0.8</priority>"
    echo "  </url>"
  done
  echo '</urlset>'
} > sitemap.xml
echo "plan du site mis à jour : sitemap.xml"

# Liste de villes de la page d'accueil (entre les repères <!-- VILLES:debut --> et <!-- VILLES:fin -->)
if grep -q '<!-- VILLES:debut -->' index.html; then
  printf '%s' "$HOME_LINKS" > tools/.villes-accueil.tmp
  awk 'FNR==NR { blk = blk $0 "\n"; next }
       /<!-- VILLES:debut -->/ { print; printf "%s", blk; skip = 1; next }
       /<!-- VILLES:fin -->/ { skip = 0 }
       !skip { print }' tools/.villes-accueil.tmp index.html > tools/.index.tmp
  mv tools/.index.tmp index.html
  rm -f tools/.villes-accueil.tmp
  echo "liste de villes de l'accueil mise à jour"
fi
