#!/bin/sh
set -e

# Script compatible amb sh (POSIX). Treu dependència de bash.

# Processa opcions de línia de comandes
SKIP_TESTS=false
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -h|--help)
      echo "Ús: $0 [--skip-tests]"
      echo ""
      echo "Opcions:"
      echo "  --skip-tests    Salta l'execució de tots els tests (no recomanat)"
      echo "  -h, --help      Mostra aquesta ajuda"
      echo ""
      echo "Exemples:"
      echo "  $0              Executa tots els tests (recomanat)"
      echo "  $0 --skip-tests Salta tots els tests (ús avançat)"
      exit 0
      ;;
    *)
      echo "Opció desconeguda: $1"
      echo "Ús: $0 [--skip-tests]"
      echo "Executa '$0 --help' per veure l'ajuda completa"
      exit 1
      ;;
  esac
done

# Obté el nom del paquet des de package.json
package_name=$(node -p "require('./package.json').name")
# Obté la versió publicada a NPM (si existeix)
published_version=$(npm view "$package_name" version 2>/dev/null || true)

echo "\033[38;2;255;140;0mScript de publicació a NPM de $package_name\033[0m"
echo "\033[38;2;255;140;0mTrevor Smart, 2025\033[0m"
if [ "$SKIP_TESTS" = "true" ]; then
  echo "\033[38;2;255;165;0m⚠️ Mode --skip-tests activat: es saltaran tots els tests\033[0m"
  echo "\033[38;2;255;165;0m   Això inclou: tests bàsics, tests contra build ofuscada i validació npx\033[0m"
  echo "\033[38;2;255;165;0m   Ús només en casos d'emergència o desenvolupament avançat\033[0m"
fi
echo

# Gestió de la versió abans dels tests
if [ -n "$published_version" ]; then
  tmpfile=$(mktemp)
  jq --arg v "$published_version" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

current_version=$(node -p "require('./package.json').version")
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
new_patch=$((patch + 1))
proposed_version="$major.$minor.$new_patch"

# Mostra instrucció clara i demana la nova versió amb compte enrere
echo "\033[38;5;99mVersió $current_version\033[0m\033[36m --> \033[1m$proposed_version\033[22m.\033[0m\033[95m Accepta (↵) o indica'n una altra:\033[0m"

# Funció per mostrar el compte enrere (compatible POSIX, sense 'local')
# Ús: countdown <segons> "Missatge"
# Exemple: countdown 15 "Acceptant automàticament $proposed_version"
countdown() {
  seconds="$1"
  [ -n "$2" ] && msg="$2" || msg="Compte enrere"
  [ -z "$seconds" ] && seconds=5

  while [ "$seconds" -gt 0 ]; do
    # \r tornar a l'inici de línia; \033[K neteja la línia
    printf "\r\033[K\033[95m⏰ %s: %ds\033[0m" "$msg" "$seconds"
    sleep 1
    seconds=$((seconds - 1))
  done
  printf "\r\033[K\033[95m✓ %s\033[0m\n" "$msg"
}

# Llegeix input amb timeout de 15 segons
new_version=""

# Implementació manual amb processos en background per aturar el compte
# enrere en el primer keypress (POSIX, sense 'read -t').

# Fitxers temporals per a senyals d'estat
temp_timeout_file=$(mktemp)
temp_input_file=$(mktemp)
temp_input_done=$(mktemp)
rm -f "$temp_timeout_file" "$temp_input_done"  # es crearan quan pertoqui

# Procés de compte enrere
(
  countdown 5 "Acceptant automàticament $proposed_version"
  echo "timeout" > "$temp_timeout_file"
) &
countdown_pid=$!

# Listener d'entrada: llegeix caràcter a caràcter de /dev/tty.
# En el primer caràcter deté el compte enrere. Acaba quan rep newline.
(
  : > "$temp_input_file"
  # Guarda i configura TTY en mode no canònic per captar tecles immediatament
  old_tty=$(stty -g </dev/tty 2>/dev/null || true)
  trap 'stty "$old_tty" </dev/tty 2>/dev/null || true' EXIT INT TERM
  stty -icanon min 1 time 1 </dev/tty 2>/dev/null || true

  while :; do
    # Surt si ja ha expirat el temps
    if [ -f "$temp_timeout_file" ]; then
      break
    fi
    # dd bloqueja fins que rep 1 byte o expira (time)
    c=$(dd if=/dev/tty bs=1 count=1 2>/dev/null || true)
    # Si no hi ha res, torna a comprovar
    [ -z "$c" ] && continue
    # Primer keypress: atura compte enrere
    kill "$countdown_pid" 2>/dev/null || true
    # Desa el caràcter
    printf "%s" "$c" >> "$temp_input_file"
    # Si és newline, marca com finalitzat
    last_char=$(printf "%s" "$c" | tail -c 1)
    if [ "x$last_char" = "x\n" ]; then
      : > "$temp_input_done"
      break
    fi
  done
) &
listener_pid=$!

# Espera fins que l'usuari prem Enter (input_done) o expira el compte enrere
while :; do
  if [ -f "$temp_input_done" ]; then
    # L'usuari ha acabat d'escriure; neteja countdown i llegeix la línia
    kill "$countdown_pid" 2>/dev/null || true
    wait "$countdown_pid" 2>/dev/null || true
    # Llegeix tot el que s'ha escrit (eliminant el trailing newline)
    new_version=$(tr -d '\r' < "$temp_input_file" | sed 's/\n$//')
    printf "\r\033[K"
    break
  fi
  if [ -f "$temp_timeout_file" ]; then
    # Timeout: accepta versió proposada
    wait "$countdown_pid" 2>/dev/null || true
    new_version="$proposed_version"
    break
  fi
  sleep 0.2
done

# Neteja fitxers temporals
rm -f "$temp_timeout_file" "$temp_input_file" "$temp_input_done"

# Si l'usuari no ha introduït res, utilitza la versió proposada
if [ -z "$new_version" ]; then
  new_version="$proposed_version"
fi

# Valida el format de la versió
echo "$new_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "\033[91mError: Format de versió invàlid. El format ha de ser 'major.minor.patch' (ex: 1.2.3)\033[0m"
  exit 1
}

echo

# Executa els tests utilitzant el framework de test configurat (si no s'han saltat)
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\033[95mExecutant tests bàsics de funcionament del servidor...\033[0m"
  TEST_OUTPUT=$(mktemp)
  npm run test -- --silent | tee "$TEST_OUTPUT"

  # Comprova si els tests han passat correctament
  if ! grep -q '🎉 All tests passed!' "$TEST_OUTPUT"; then
    echo "\033[95mS'han detectat errors als tests. Aturant la build.\033[0m"
    rm -f "$TEST_OUTPUT"
    exit 1
  fi

  echo
  echo "\033[92m✓ Tots els tests han passat correctament.\033[0m"
  rm -f "$TEST_OUTPUT"
else
  echo "\033[95m⚠️  Saltant tests bàsics (--skip-tests activat)\033[0m"
fi

# No facis fallar el script si el paquet encara no existeix a NPM
npm view "$package_name" version > /dev/null 2>&1 || true

cp package.json package.json.bak
cp index.js index.js.bak

restore_versions() {
  echo
  echo "\033[95mRestauració de la versió original de package.json i index.js...\033[0m"
  if [ ! -f package.json.bak ] || [ ! -f index.js.bak ]; then
    echo "\033[91mATENCIÓ: No s'ha trobat package.json.bak o index.js.bak per restaurar!\033[0m"
    return 1
  fi
  mv package.json.bak package.json
  mv index.js.bak index.js
}
# En sh no hi ha 'ERR'; es farà restore manual en cas d'error

npm version $new_version --no-git-tag-version > /dev/null 2>&1

echo

# Actualitza deeplinks del README abans de preparar dist
node dev/updateReadmeDeeplinks.js > /dev/null 2>&1 || true

# Clona el codi font a dist (amb exclusions de .npmignore)
echo "\033[95mGenerant pkg amb el codi ofuscat...\033[0m"
echo
rm -rf dist || {
  echo "\033[91m❌ Error eliminant directori dist:\033[0m"
  echo "   Error: $?"
  echo "   Directori actual: $(pwd)"
  echo "   Contingut:"
  ls -la dist/ 2>&1 || echo "   No es pot llistar"
  restore_versions
  exit 1
}

mkdir dist || {
  echo "\033[91m❌ Error creant directori dist:\033[0m"
  echo "   Error: $?"
  echo "   Directori actual: $(pwd)"
  echo "   Permisos del directori pare:"
  ls -ld . 2>&1 || echo "   No es poden veure els permisos"
  restore_versions
  exit 1
}

rsync -a --exclude-from=.npmignore ./ ./dist/ || {
  echo "\033[91m❌ Error copiant fitxers a dist:\033[0m"
  echo "   Error: $?"
  restore_versions
  exit 1
}

# Sortida silenciosa per aquestes línies tret que VERBOSE=1
: "${VERBOSE:=0}"
# Ensure vecho never returns non-zero under set -e
vecho() {
  if [ "${VERBOSE}" = "1" ]; then
    printf "%s\n" "$*"
  fi
  return 0
}
vecho "\033[95mPreparant llista de noms exportats per preservar...\033[0m"

# Construeix una llista de noms exportats (ESM) per reservar-los durant l'ofuscació
reserved_tmp=$(mktemp)
# export function|class|const|let|var NAME
grep -RhoE "export[[:space:]]+(function|class|const|let|var)[[:space:]]+[A-Za-z_][$A-Za-z0-9_]*" dist 2>/dev/null | awk '{print $NF}' >> "$reserved_tmp" || true
# export { a, b as c }
grep -RhoE "export[[:space:]]*\{[^}]+\}" dist 2>/dev/null \
  | sed -E 's/.*\{([^}]*)\}.*/\1/' \
  | tr ',' '\n' \
  | sed -E 's/[[:space:]]+as[[:space:]]+.*$//' \
  | sed -E 's/^\s+|\s+$//g' \
  | grep -E '^[A-Za-z_][$A-Za-z0-9_]*$' >> "$reserved_tmp" || true

# Construeix patró per a --reserved-names (separat per comes)
OBF_RESERVED=$(sort -u "$reserved_tmp" | awk 'BEGIN{ORS=","} {printf "^%s$", $0} END{print ""}' | sed 's/,$//')
rm -f "$reserved_tmp"

if [ -n "$OBF_RESERVED" ]; then
  vecho "   Noms reservats: $(echo "$OBF_RESERVED" | tr ',' ' ')"
else
  vecho "   Cap nom exportat detectat per reservar."
fi

echo "\033[96mOfuscant els fitxers JavaScript (preservant exports ESM)...\033[0m"
find dist -name '*.js' | while read -r file; do
  echo "   $file..."

  # Evita ofuscar scripts amb shebang (ex. CLI), per evitar problemes de processament i preservar la capçalera
  if head -n 1 "$file" | grep -q '^#!'; then
    echo "   (omès - script amb shebang)"
    continue
  fi

  # Continua: ofuscar també ESM però preservant els noms exportats i desactivant self-defending

  OBF_LOG=$(mktemp)
  obf_tmp="${file%.js}.obf.tmp.js"   # IMPORTANT: ha d'acabar en .js per evitar directoris fantasma

  ./node_modules/.bin/javascript-obfuscator "$file" \
    --output "$obf_tmp" \
    --compact true \
    --target node \
    --debug-protection false \
    --unicode-escape-sequence true \
    --identifier-names-generator hexadecimal \
    --rename-globals false \
    --string-array true \
    --self-defending false \
    --string-array-threshold 0.75 \
    ${OBF_RESERVED:+--reserved-names "$OBF_RESERVED"} \
    >"$OBF_LOG" 2>&1 || {
      echo "❌ Error ofuscant $file"
      echo "—— Sortida de l'obfuscador ——"
      sed -n '1,200p' "$OBF_LOG"
      rm -f "$OBF_LOG" "$obf_tmp"
      restore_versions
      exit 1
    }

  # Valida que el codi ofuscat és vàlid abans de substituir
  if ! node --check "$obf_tmp" 2>/dev/null; then
    echo "❌ Error: El codi ofuscat per $file no és vàlid JavaScript"
    echo "—— Contingut del fitxer ofuscat ——"
    head -n 10 "$obf_tmp"
    rm -f "$OBF_LOG" "$obf_tmp"
    restore_versions
    exit 1
  fi

  # Substitueix l’original de forma segura
  if command -v install >/dev/null 2>&1; then
    install -m 0644 "$obf_tmp" "$file"
  else
    cp -f "$obf_tmp" "$file"
  fi
  rm -f "$OBF_LOG" "$obf_tmp"
done

echo

# Assegura que el CLI tingui permisos d'execució (per si rsync els perdés)
chmod +x dist/bin/cli.js 2>/dev/null || true

echo "\033[96mCodificant els fitxers Markdown...\033[0m"
# Codifica tots els fitxers .md de totes les carpetes (incloent static)
find dist -name '*.md' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

echo

echo "\033[96mCodificant els fitxers Apex...\033[0m"
# Codifica tots els fitxers .apex de totes les carpetes (incloent static)
find dist -name '*.apex' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

# Neteja arxius que no calin dins el paquet i prepara package.json minimal
rm -f dist/.npmignore
echo
jq '{
  name, version, description, main, type, browser, bin, keywords, author, dependencies, engines
} + { files: ["index.js", "src", "bin", "README.md", "LICENSE"] }' package.json > dist/package.json
cd dist && npm install
cd ..

# Re-executa els tests, ara utilitzant el servidor MCP de la build ofuscada a dist/ (si no s'han saltat)
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\n\033[95mExecutant tests contra el servidor ofuscat (dist/)...\033[0m"
  TEST_DIST_OUTPUT=$(mktemp)
  # Indica al runner que arrenqui el servidor des de dist/index.js
  # Usa un camí absolut per evitar resolucions relatives incorrectes
  MCP_TEST_SERVER_PATH="$(pwd)/dist/index.js" npm run test -- --silent | tee "$TEST_DIST_OUTPUT"

  if ! grep -q '🎉 All tests passed!' "$TEST_DIST_OUTPUT"; then
    echo "\033[91m❌ Els tests contra la build ofuscada han fallat.\033[0m"
    rm -f "$TEST_DIST_OUTPUT"
    restore_versions
    exit 1
  fi

  rm -f "$TEST_DIST_OUTPUT"
  echo
  echo "\033[95m✓ Tests amb el paquet ofuscat completats correctament.\033[0m"
else
  echo "\033[95m⚠️  Saltant tests contra el servidor ofuscat (--skip-tests activat)\033[0m"
fi
echo
echo "\033[95mVols continuar amb la publicació del paquet a NPM? (S/n)\033[0m"
# Si stdin no està disponible (entorn no interactiu), 'read' fallarà.
# En aquest cas, assumim Enter per defecte (Sí) per evitar bloquejos.
if ! IFS= read -r resposta; then
  resposta=""
fi
# Normalitza: elimina CR/espais i passa a minúscules
resposta_norm=$(printf '%s' "$resposta" \
  | tr -d '\r' \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
  | tr '[:upper:]' '[:lower:]')
# Accepta valors típics d'acceptació i Enter per defecte (Sí)
case "$resposta_norm" in
  ""|s|si|sí|y|yes)
    :
    ;;
  n|no)
    echo
    echo "\033[95mPublicació cancel·lada per l'usuari.\033[0m"
    exit 1
    ;;
  *)
    echo
    echo "\033[95mEntrada no reconeguda. Publicació cancel·lada per seguretat.\033[0m"
    exit 1
    ;;
esac

echo
echo "\033[95mPublicant el paquet a NPM (des de dist/)...\033[0m"
PUBLISH_OUTPUT=$(mktemp)

# Canvia al directori dist i executa npm publish amb redireccions separades (més robust)
cd dist
# 'set -e' would terminate the script immediately on a non-zero exit here,
# preventing us from showing the captured npm error output. Temporarily disable
# it so we can handle the error and surface useful diagnostics.
set +e
npm publish --access public > "$PUBLISH_OUTPUT" 2>&1
publish_status=$?
set -e
if [ $publish_status -ne 0 ]; then
  echo "\033[91m❌ Error publicant el paquet a NPM:\033[0m"
  cat "$PUBLISH_OUTPUT"
  rm -f "$PUBLISH_OUTPUT"
  cd ..  # Torna al directori original
  restore_versions
  exit 1
fi
cd ..  # Torna al directori original

# Mostra les línies de notice si l'execució ha estat exitosa (sense parèntesis a l'script)
while IFS= read -r line; do
  case "$line" in
    "npm notice name:"*|"npm notice version:"*|"npm notice shasum:"*|"npm notice total files:"*)
      printf "   \033[96mnpm notice\033[0m%s\n" "${line#npm notice}"
      ;;
  esac
done < "$PUBLISH_OUTPUT"
rm -f "$PUBLISH_OUTPUT"

echo

# Tercer pas de validació: provar el paquet publicat amb npx (si no s'han saltat els tests)
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\033[95mIniciant tercera validació amb el paquet publicat via npx...\033[0m"

  # Espera per propagació de registres i neteja cau
  echo "   Esperant 10s per propagació de NPM..."
  sleep 10
  echo "   Netejant cau de NPM..."
  npm cache clean --force >/dev/null 2>&1 || true

  # Determina el nom del binari (primer key del camp "bin" de package.json)
  bin_name=$(node -p "(p=>Object.keys(p.bin||{})[0]||'') (require('./package.json'))")
  if [ -z "$bin_name" ]; then
    echo "\033[91m❌ No s'ha trobat cap entrada 'bin' a package.json. No es pot validar via npx.\033[0m"
    restore_versions
    exit 1
  fi

  # Pre-check: comproveu que npx pot resoldre i executar el binari
  echo "   Validant resolució del binari amb npx..."
  if ! npx -y -p "$package_name@$new_version" which "$bin_name" >/dev/null 2>&1; then
    echo "\033[91m❌ El binari '$bin_name' no es pot resoldre via npx per al paquet $package_name@$new_version.\033[0m"
    echo "   Sugg.: comproveu el camp 'bin' de dist/package.json i que 'bin/cli.js' existeixi al paquet publicat."
    restore_versions
    exit 1
  fi

  echo "   Executant tests amb \033[96mnpx -y -p $package_name@$new_version $bin_name --stdio\033[0m"
  TEST_NPX_OUTPUT=$(mktemp)
  MCP_TEST_SERVER_SPEC="npx:$package_name@$new_version#$bin_name" \
    npm run test -- --silent | tee "$TEST_NPX_OUTPUT"

  if ! grep -q '🎉 All tests passed!' "$TEST_NPX_OUTPUT"; then
    echo "\033[91m❌ Els tests contra el paquet publicat via npx han fallat.\033[0m"
    rm -f "$TEST_NPX_OUTPUT"
    restore_versions
    exit 1
  fi

  rm -f "$TEST_NPX_OUTPUT"

  echo
  echo "\033[95m✓ Validació final (npx) completada correctament.\033[0m"
else
  echo "\033[95m⚠️  Saltant validació final via npx (--skip-tests activat)\033[0m"
fi

echo "\033[95mFinalitzant...\033[0m"

# Advertència final si s'han saltat els tests
if [ "$SKIP_TESTS" = "true" ]; then
  echo
  echo "\033[38;2;255;165;0m⚠️  ATENCIÓ: S'han saltat tots els tests amb --skip-tests\033[0m"
  echo "\033[38;2;255;165;0m   El paquet s'ha publicat sense validació de qualitat\033[0m"
  echo "\033[38;2;255;165;0m   Es recomana executar els tests manualment abans d'usar el paquet\033[0m"
fi

# Neteja backups només quan TOT ha anat bé
rm -f package.json.bak index.js.bak
