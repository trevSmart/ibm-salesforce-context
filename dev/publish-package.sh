#!/bin/sh
set -e

# Script compatible with sh (POSIX). Removes bash dependency.

# Process command line options
SKIP_TESTS=false
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--skip-tests]"
      echo ""
      echo "Options:"
      echo "  --skip-tests    Skip running all tests (not recommended)"
      echo "  -h, --help      Show this help"
      echo ""
      echo "Examples:"
      echo "  $0              Run all tests (recommended)"
      echo "  $0 --skip-tests Skip all tests (advanced use)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-tests]"
      echo "Run '$0 --help' for complete help"
      exit 1
      ;;
  esac
done

# Get package name from package.json
package_name=$(node -p "require('./package.json').name")
# Get published version from NPM (if exists)
published_version=$(npm view "$package_name" version 2>/dev/null || true)

echo "\033[38;2;255;140;0mNPM Publishing Script for $package_name\033[0m"
echo "\033[38;2;255;140;0mTrevor Smart, 2025\033[0m"
if [ "$SKIP_TESTS" = "true" ]; then
  echo "\033[38;2;255;165;0m⚠️ --skip-tests mode activated: all tests will be skipped\033[0m"
  echo "\033[38;2;255;165;0m   This includes: basic tests, tests against obfuscated build, and npx validation\033[0m"
  echo "\033[38;2;255;165;0m   Use only in emergency or advanced development cases\033[0m"
fi
echo

# Version management before tests
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

# Show clear instruction and ask for new version with countdown
echo "\033[38;5;99mVersion $current_version\033[0m\033[36m --> \033[1m$proposed_version\033[22m.\033[0m\033[95m Accept (↵) or specify another:\033[0m"

# Function to display countdown (POSIX compatible, without 'local')
# Usage: countdown <seconds> "Message"
# Example: countdown 15 "Automatically accepting $proposed_version"
countdown() {
  seconds="$1"
  [ -n "$2" ] && msg="$2" || msg="Countdown"
  [ -z "$seconds" ] && seconds=5

  while [ "$seconds" -gt 0 ]; do
    # \r return to start of line; \033[K clear line
    printf "\r\033[K\033[95m⏰ %s: %ds\033[0m" "$msg" "$seconds"
    sleep 1
    seconds=$((seconds - 1))
  done
  printf "\r\033[K\033[95m✓ %s\033[0m\n" "$msg"
}

# Read input with 15 second timeout
new_version=""

# Manual implementation with background processes to stop countdown
# on first keypress (POSIX, without 'read -t').

# Temporary files for status signals
temp_timeout_file=$(mktemp)
temp_input_file=$(mktemp)
temp_input_done=$(mktemp)
rm -f "$temp_timeout_file" "$temp_input_done"  # will be created when needed

# Countdown process
(
  countdown 5 "Automatically accepting $proposed_version"
  echo "timeout" > "$temp_timeout_file"
) &
countdown_pid=$!

# Input listener: reads character by character from /dev/tty.
# Stops countdown on first character. Ends when it receives newline.
(
  : > "$temp_input_file"
  # Save and configure TTY in non-canonical mode to capture keys immediately
  old_tty=$(stty -g </dev/tty 2>/dev/null || true)
  trap 'stty "$old_tty" </dev/tty 2>/dev/null || true' EXIT INT TERM
  stty -icanon min 1 time 1 </dev/tty 2>/dev/null || true

  while :; do
    # Exit if timeout has already expired
    if [ -f "$temp_timeout_file" ]; then
      break
    fi
    # dd blocks until it receives 1 byte or expires (time)
    c=$(dd if=/dev/tty bs=1 count=1 2>/dev/null || true)
    # If nothing, check again
    [ -z "$c" ] && continue
    # First keypress: stop countdown
    kill "$countdown_pid" 2>/dev/null || true
    # Save the character
    printf "%s" "$c" >> "$temp_input_file"
    # If it's a newline, mark as finished
    last_char=$(printf "%s" "$c" | tail -c 1)
    if [ "x$last_char" = "x\n" ]; then
      : > "$temp_input_done"
      break
    fi
  done
) &
listener_pid=$!

# Wait until user presses Enter (input_done) or countdown expires
while :; do
  if [ -f "$temp_input_done" ]; then
    # User has finished typing; clean up countdown and read the line
    kill "$countdown_pid" 2>/dev/null || true
    wait "$countdown_pid" 2>/dev/null || true
    # Read everything that was written (removing trailing newline)
    new_version=$(tr -d '\r' < "$temp_input_file" | sed 's/\n$//')
    printf "\r\033[K"
    break
  fi
  if [ -f "$temp_timeout_file" ]; then
    # Timeout: accept proposed version
    wait "$countdown_pid" 2>/dev/null || true
    new_version="$proposed_version"
    break
  fi
  sleep 0.2
done

# Clean up temporary files
rm -f "$temp_timeout_file" "$temp_input_file" "$temp_input_done"

# If user didn't enter anything, use proposed version
if [ -z "$new_version" ]; then
  new_version="$proposed_version"
fi

# Validate version format
echo "$new_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "\033[91mError: Invalid version format. Format must be 'major.minor.patch' (e.g., 1.2.3)\033[0m"
  exit 1
}

echo

# Run tests
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\033[95mRunning basic server functionality tests...\033[0m"
  TEST_OUTPUT=$(mktemp)
  ./node_modules/.bin/vitest --silent --run --retry=2 --reporter=dot | tee "$TEST_OUTPUT"

  # Check if tests passed successfully
  # Look for successful test completion patterns
  if ! grep -qE 'Tests[[:space:]]+[0-9]+ passed' "$TEST_OUTPUT" || grep -qE '(failed|error|Error)' "$TEST_OUTPUT"; then
    echo "\033[95mErrors detected in tests. Stopping build.\033[0m"
    rm -f "$TEST_OUTPUT"
    exit 1
  fi

  echo
  echo "\033[92m✓ All tests passed successfully.\033[0m"
  rm -f "$TEST_OUTPUT"
else
  echo "\033[95m⚠️  Skipping basic tests (--skip-tests activated)\033[0m"
fi

# Don't fail the script if package doesn't exist on NPM yet
npm view "$package_name" version > /dev/null 2>&1 || true

cp package.json package.json.bak
cp index.js index.js.bak

restore_versions() {
  echo
  echo "\033[95mRestoring original version of package.json and index.js...\033[0m"
  if [ ! -f package.json.bak ] || [ ! -f index.js.bak ]; then
    echo "\033[91mWARNING: Could not find package.json.bak or index.js.bak to restore!\033[0m"
    return 1
  fi
  mv package.json.bak package.json
  mv index.js.bak index.js
}
# In sh there's no 'ERR'; manual restore will be done in case of error

npm version $new_version --no-git-tag-version > /dev/null 2>&1

echo

# Update README deeplinks before preparing dist
node dev/updateReadmeDeeplinks.js > /dev/null 2>&1 || true

# Clone source code to dist (with .npmignore exclusions)
echo "\033[95mGenerating pkg with obfuscated code...\033[0m"
echo
rm -rf dist || {
  echo "\033[91m❌ Error removing dist directory:\033[0m"
  echo "   Error: $?"
  echo "   Current directory: $(pwd)"
  echo "   Contents:"
  ls -la dist/ 2>&1 || echo "   Cannot list"
  restore_versions
  exit 1
}

mkdir dist || {
  echo "\033[91m❌ Error creating dist directory:\033[0m"
  echo "   Error: $?"
  echo "   Current directory: $(pwd)"
  echo "   Parent directory permissions:"
  ls -ld . 2>&1 || echo "   Cannot view permissions"
  restore_versions
  exit 1
}

rsync -a --exclude-from=.npmignore ./ ./dist/ || {
  echo "\033[91m❌ Error copying files to dist:\033[0m"
  echo "   Error: $?"
  restore_versions
  exit 1
}

# Silent output for these lines unless VERBOSE=1
: "${VERBOSE:=0}"
# Ensure vecho never returns non-zero under set -e
vecho() {
  if [ "${VERBOSE}" = "1" ]; then
    printf "%s\n" "$*"
  fi
  return 0
}
vecho "\033[95mPreparing list of exported names to preserve...\033[0m"

# Build a list of exported names (ESM) to reserve during obfuscation
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

# Build pattern for --reserved-names (comma-separated)
OBF_RESERVED=$(sort -u "$reserved_tmp" | awk 'BEGIN{ORS=","} {printf "^%s$", $0} END{print ""}' | sed 's/,$//')
rm -f "$reserved_tmp"

if [ -n "$OBF_RESERVED" ]; then
  vecho "   Reserved names: $(echo "$OBF_RESERVED" | tr ',' ' ')"
else
  vecho "   No exported names detected to reserve."
fi

echo "\033[96mObfuscating JavaScript files (preserving ESM exports)...\033[0m"
find dist -name '*.js' | while read -r file; do
  echo "   $file..."

  # Avoid obfuscating scripts with shebang (e.g., CLI), to prevent processing issues and preserve header
  if head -n 1 "$file" | grep -q '^#!'; then
    echo "   (skipped - script with shebang)"
    continue
  fi

  # Continue: also obfuscate ESM but preserve exported names and disable self-defending

  OBF_LOG=$(mktemp)
  obf_tmp="${file%.js}.obf.tmp.js"   # IMPORTANT: must end in .js to avoid ghost directories

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
      echo "❌ Error obfuscating $file"
      echo "—— Obfuscator output ——"
      sed -n '1,200p' "$OBF_LOG"
      rm -f "$OBF_LOG" "$obf_tmp"
      restore_versions
      exit 1
    }

  # Validate that obfuscated code is valid before replacing
  if ! node --check "$obf_tmp" 2>/dev/null; then
    echo "❌ Error: Obfuscated code for $file is not valid JavaScript"
    echo "—— Obfuscated file content ——"
    head -n 10 "$obf_tmp"
    rm -f "$OBF_LOG" "$obf_tmp"
    restore_versions
    exit 1
  fi

  # Replace original safely
  if command -v install >/dev/null 2>&1; then
    install -m 0644 "$obf_tmp" "$file"
  else
    cp -f "$obf_tmp" "$file"
  fi
  rm -f "$OBF_LOG" "$obf_tmp"
done

echo

# Ensure CLI has execution permissions (in case rsync lost them)
chmod +x dist/bin/cli.js 2>/dev/null || true

echo "\033[96mEncoding Markdown files...\033[0m"
# Encode all .md files in all folders (including static)
find dist -name '*.md' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

echo

echo "\033[96mEncoding Apex files...\033[0m"
# Encode all .apex files in all folders (including static)
find dist -name '*.apex' | while read -r file; do
  if [ -f "$file" ]; then
    b64file="$file.pam"
    base64 -i "$file" -o "$b64file"
    rm -f "$file"
    echo "   $file"
  fi
done

# Clean up unnecessary files in the package and prepare minimal package.json
rm -f dist/.npmignore
echo
jq '{
  name, version, description, main, type, browser, bin, keywords, author, dependencies, engines
} + { files: ["index.js", "src", "bin", "README.md", "LICENSE"] }' package.json > dist/package.json
cd dist && npm install
cd ..

# Re-run tests, now using the MCP server from the obfuscated build in dist/ (if not skipped)
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\n\033[95mRunning tests against obfuscated server (dist/)...\033[0m"
  TEST_DIST_OUTPUT=$(mktemp)

  # Copy test files to dist/ and run tests from there so setup.ts can detect the correct paths
  cp -r test dist/ 2>/dev/null || true

  # Change to dist directory to run tests from there (so process.cwd() ends with /dist)
  cd dist
  ../node_modules/.bin/vitest --silent --run --retry=2 --reporter=dot | tee "$TEST_DIST_OUTPUT"
  cd ..

  if ! grep -qE 'Tests[[:space:]]+[0-9]+ passed' "$TEST_DIST_OUTPUT" || grep -qE '(failed|error|Error)' "$TEST_DIST_OUTPUT"; then
    echo "\033[91m❌ Tests against the obfuscated build have failed.\033[0m"
    rm -f "$TEST_DIST_OUTPUT"
    restore_versions
    exit 1
  fi

  rm -f "$TEST_DIST_OUTPUT"
  echo
  echo "\033[95m✓ Tests with the obfuscated package completed successfully.\033[0m"
else
  echo "\033[95m⚠️  Skipping tests against obfuscated server (--skip-tests activated)\033[0m"
fi
echo
echo "\033[95mDo you want to continue with publishing the package to NPM? (Y/n)\033[0m"

# Use a more robust input method that works after the complex countdown logic
# Create temporary files for input handling
temp_response_file=$(mktemp)
temp_response_done=$(mktemp)

# Input listener for the confirmation prompt
(
  : > "$temp_response_file"
  # Save and configure TTY in non-canonical mode to capture keys immediately
  old_tty=$(stty -g </dev/tty 2>/dev/null || true)
  trap 'stty "$old_tty" </dev/tty 2>/dev/null || true' EXIT INT TERM
  stty -icanon min 1 time 1 </dev/tty 2>/dev/null || true

  while :; do
    # dd blocks until it receives 1 byte or expires (time)
    c=$(dd if=/dev/tty bs=1 count=1 2>/dev/null || true)
    # If nothing, check again
    [ -z "$c" ] && continue
    # Save the character
    printf "%s" "$c" >> "$temp_response_file"
    # If it's a newline, mark as finished
    last_char=$(printf "%s" "$c" | tail -c 1)
    if [ "x$last_char" = "x\n" ]; then
      : > "$temp_response_done"
      break
    fi
  done
) &
response_listener_pid=$!

# Wait for user input with a timeout
timeout_seconds=30
timeout_reached=false
for i in $(seq 1 $timeout_seconds); do
  if [ -f "$temp_response_done" ]; then
    break
  fi
  if [ $i -eq $timeout_seconds ]; then
    timeout_reached=true
    break
  fi
  sleep 1
done

# Clean up the listener process
kill "$response_listener_pid" 2>/dev/null || true
wait "$response_listener_pid" 2>/dev/null || true

# Read the response
if [ -f "$temp_response_done" ]; then
  response=$(tr -d '\r' < "$temp_response_file" | sed 's/\n$//')
else
  response=""
fi

# Clean up temporary files
rm -f "$temp_response_file" "$temp_response_done"

# Normalize: remove CR/spaces and convert to lowercase
response_norm=$(printf '%s' "$response" \
  | tr -d '\r' \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
  | tr '[:upper:]' '[:lower:]')

# Handle timeout case
if [ "$timeout_reached" = "true" ]; then
  echo
  echo "\033[95mNo response received within $timeout_seconds seconds. Publication cancelled for safety.\033[0m"
  exit 1
fi

# Accept typical acceptance values and Enter by default (Yes)
case "$response_norm" in
  ""|y|yes|s|si)
    :
    ;;
  n|no)
    echo
    echo "\033[95mPublication cancelled by user.\033[0m"
    exit 1
    ;;
  *)
    echo
    echo "\033[95mUnrecognized input '$response_norm'. Publication cancelled for safety.\033[0m"
    exit 1
    ;;
esac

echo
echo "\033[95mPublishing package to NPM (from dist/)...\033[0m"
PUBLISH_OUTPUT=$(mktemp)

# Change to dist directory and run npm publish with separate redirections (more robust)
cd dist
# 'set -e' would terminate the script immediately on a non-zero exit here,
# preventing us from showing the captured npm error output. Temporarily disable
# it so we can handle the error and surface useful diagnostics.
set +e
npm publish --access public > "$PUBLISH_OUTPUT" 2>&1
publish_status=$?
set -e
if [ $publish_status -ne 0 ]; then
  echo "\033[91m❌ Error publishing package to NPM:\033[0m"
  cat "$PUBLISH_OUTPUT"
  rm -f "$PUBLISH_OUTPUT"
  cd ..  # Return to original directory
  restore_versions
  exit 1
fi
cd ..  # Return to original directory

# Show notice lines if execution was successful (no parentheses in the script)
while IFS= read -r line; do
  case "$line" in
    "npm notice name:"*|"npm notice version:"*|"npm notice shasum:"*|"npm notice total files:"*)
      printf "   \033[96mnpm notice\033[0m%s\n" "${line#npm notice}"
      ;;
  esac
done < "$PUBLISH_OUTPUT"
rm -f "$PUBLISH_OUTPUT"

echo

# Third validation step: test the published package with npx (if tests weren't skipped)
if [ "$SKIP_TESTS" = "false" ]; then
  echo "\033[95mStarting third validation with the published package via npx...\033[0m"

  # Wait for registry propagation and clear cache
  echo "   Waiting 10s for NPM propagation..."
  sleep 10
  echo "   Clearing NPM cache..."
  npm cache clean --force >/dev/null 2>&1 || true

  # Determine binary name (first key of the "bin" field in package.json)
  bin_name=$(node -p "(p=>Object.keys(p.bin||{})[0]||'') (require('./package.json'))")
  if [ -z "$bin_name" ]; then
    echo "\033[91m❌ No 'bin' entry found in package.json. Cannot validate via npx.\033[0m"
    restore_versions
    exit 1
  fi

  # Pre-check: verify that npx can resolve and execute the binary
  echo "   Validating binary resolution with npx..."
  if ! npx -y -p "$package_name@$new_version" which "$bin_name" >/dev/null 2>&1; then
    echo "\033[91m❌ Binary '$bin_name' cannot be resolved via npx for package $package_name@$new_version.\033[0m"
    echo "   Sugg.: check the 'bin' field in dist/package.json and that 'bin/cli.js' exists in the published package."
    restore_versions
    exit 1
  fi

  echo "   Running tests with \033[96mnpx -y -p $package_name@$new_version $bin_name --stdio\033[0m"
  TEST_NPX_OUTPUT=$(mktemp)
  MCP_TEST_SERVER_SPEC="npx:$package_name@$new_version#$bin_name" \
    .node_modules/.bin/vitest -- --silent --run --retry=2 --reporter=dot | tee "$TEST_NPX_OUTPUT"

  if ! grep -qE 'Tests[[:space:]]+[0-9]+ passed' "$TEST_NPX_OUTPUT" || grep -qE '(failed|error|Error)' "$TEST_NPX_OUTPUT"; then
    echo "\033[91m❌ Tests against the published package via npx have failed.\033[0m"
    rm -f "$TEST_NPX_OUTPUT"
    restore_versions
    exit 1
  fi

  rm -f "$TEST_NPX_OUTPUT"

  echo
  echo "\033[95m✓ Final validation (npx) completed successfully.\033[0m"
else
  echo "\033[95m⚠️  Skipping final validation via npx (--skip-tests activated)\033[0m"
fi

echo "\033[95mFinalizing...\033[0m"

# Final warning if tests were skipped
if [ "$SKIP_TESTS" = "true" ]; then
  echo
  echo "\033[38;2;255;165;0m⚠️  WARNING: All tests were skipped with --skip-tests\033[0m"
  echo "\033[38;2;255;165;0m   The package was published without quality validation\033[0m"
  echo "\033[38;2;255;165;0m   It's recommended to run tests manually before using the package\033[0m"
fi

# Clean up backups only when EVERYTHING went well
rm -f package.json.bak index.js.bak