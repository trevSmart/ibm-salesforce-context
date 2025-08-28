#!/bin/bash
set -e

# Obté el nom del paquet des de package.json
package_name=$(node -p "require('./package.json').name")
# Obté la versió publicada a NPM (si existeix)
published_version=$(npm view "$package_name" version 2>/dev/null || true)

echo "\033[38;2;255;140;0mScript de publicació a NPM de $package_name\033[0m"
echo "\033[38;2;255;140;0mTrevor Smart, 2025\033[0m"
echo

# Executa els tests utilitzant el framework de test configurat
echo "\033[95mExecutant tests bàsics de funcionament del servidor...\033[0m"
echo
TEST_OUTPUT=$(mktemp)
npm run test -- --quiet | tee "$TEST_OUTPUT"

# Comprova si els tests han passat correctament
if ! grep -q '🎉 All tests passed!' "$TEST_OUTPUT"; then
  echo "\033[95mS'han detectat errors als tests. Aturant la build.\033[0m"
  rm -f "$TEST_OUTPUT"
  exit 1
fi

echo
echo "\033[95m✅ Tots els tests han passat correctament.\033[0m"
rm -f "$TEST_OUTPUT"

if [ -n "$published_version" ]; then
  tmpfile=$(mktemp)
  jq --arg v "$published_version" '.version = $v' package.json > "$tmpfile" && mv "$tmpfile" package.json
fi

current_version=$(node -p "require('./package.json').version")
major=$(echo $current_version | cut -d. -f1)
minor=$(echo $current_version | cut -d. -f2)
patch=$(echo $current_version | cut -d. -f3)
new_patch=$((patch + 1))
proposed_version="$major.$minor.$(printf '%02d' $new_patch)"

echo "\033[95mVersió actual: $current_version"
echo "Versió proposada: $proposed_version"
echo
echo "Vols utilitzar la versió proposada o introduir una altra? (p/altra):\033[0m"
read -r resposta

if [[ "$resposta" =~ ^[Pp]$ ]]; then
  new_version="$proposed_version"
  echo "\033[95mUtilitzant versió proposada: $new_version\033[0m"
else
  echo "\033[95mIntrodueix la nova versió (format: major.minor.patch, ex: 1.2.3):\033[0m"
  read -r custom_version

  # Valida el format de la versió
  if [[ ! "$custom_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "\033[91mError: Format de versió invàlid. Ha de ser major.minor.patch (ex: 1.2.3)\033[0m"
    exit 1
  fi

  new_version="$custom_version"
  echo "\033[95mUtilitzant versió personalitzada: $new_version\033[0m"
fi

echo
echo "\033[95mATENCIÓ: S'actualitzarà la versió a la $new_version i es publicarà a NPM (versió actual: $published_version). Vols continuar? (S/n)\033[0m"
read -r resposta
if [[ ! "$resposta" =~ ^[Ss]$ ]]; then
  echo
  echo "\033[95mOperació cancel·lada per l'usuari.\033[0m"
  exit 1
fi

npm view "$package_name" version > /dev/null 2>&1

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
trap restore_versions ERR

npm version $new_version --no-git-tag-version > /dev/null 2>&1

echo

# Actualitza deeplinks del README abans de preparar dist
node dev/updateReadmeDeeplinks.js > /dev/null 2>&1 || true

# Clona el codi font a dist (amb exclusions de .npmignore)
rm -rf dist
mkdir dist
rsync -a --exclude-from=.npmignore ./ ./dist/

echo "\033[95mOfuscant els fitxers JavaScript (sense canviar noms exportats)...\033[0m"
find dist -name '*.js' | while read -r file; do
  echo "   $file..."

  # Evita ofuscar scripts amb shebang (ex. CLI), per evitar problemes de processament i preservar la capçalera
  if head -n 1 "$file" | grep -q '^#!'; then
    echo "   (omès - script amb shebang)"
    continue
  fi

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
    --self-defending true \
    --string-array-threshold 0.75 \
    >"$OBF_LOG" 2>&1 || {
      echo "❌ Error ofuscant $file"
      echo "—— Sortida de l'obfuscador ——"
      sed -n '1,200p' "$OBF_LOG"
      rm -f "$OBF_LOG" "$obf_tmp"
      exit 1
    }

  # Substitueix l’original de forma segura
  if command -v install >/dev/null 2>&1; then
    install -m 0644 "$obf_tmp" "$file"
  else
    cp -f "$obf_tmp" "$file"
  fi
  rm -f "$OBF_LOG" "$obf_tmp"
done

echo

echo "\033[95mNota: Els fitxers .apex es codifiquen en base64 (igual que els Markdown) per preservar el contingut.\033[0m"
echo

echo "\033[95mCodificant els fitxers Markdown...\033[0m"
# Codifica tots els fitxers .md de totes les carpetes (incloent static)
echo "   Buscant fitxers Markdown..."

# Compta i codifica els fitxers .md
md_count=0
find dist -name '*.md' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
    md_count=$((md_count + 1))
  fi
done

echo "   Total fitxers Markdown codificats: $md_count"

echo

echo "\033[95mCodificant els fitxers Apex...\033[0m"
# Codifica tots els fitxers .apex de totes les carpetes (incloent static)
echo "   Buscant fitxers Apex..."

# Compta i codifica els fitxers .apex
apex_count=0
find dist -name '*.apex' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
    apex_count=$((apex_count + 1))
  fi
done

echo "   Total fitxers Apex codificats: $apex_count"

# Neteja arxius que no calin dins el paquet i prepara package.json minimal
rm -f dist/.npmignore

echo "\033[95mPreparant package.json minimal per publicar...\033[0m"
jq '{
  name, version, description, main, type, browser, bin, keywords, author, dependencies, engines
} + { files: ["index.js", "src", "bin", "README.md", "LICENSE"] }' package.json > dist/package.json

echo

echo "\033[95mPublicant el paquet a NPM (des de dist/)...\033[0m"
PUBLISH_OUTPUT=$(mktemp)

# Canvia al directori dist i executa npm publish
cd dist
if ! npm publish --access public > "$PUBLISH_OUTPUT" 2>&1; then
  echo "\033[91m❌ Error publicant el paquet a NPM:\033[0m"
  cat "$PUBLISH_OUTPUT"
  rm -f "$PUBLISH_OUTPUT"
  cd ..  # Torna al directori original
  exit 1
fi
cd ..  # Torna al directori original

# Mostra les línies de notice si l'execució ha estat exitosa
grep -E 'npm notice (name:|version:|shasum:|total files:)' "$PUBLISH_OUTPUT" | while read -r line; do
  printf "   \033[96mnpm notice\033[0m%s\n" "${line#npm notice}"
done
rm -f "$PUBLISH_OUTPUT"

echo

echo "\033[95mFinalitzant...\033[0m"
trap - ERR
rm -f package.json.bak index.js.bak
echo