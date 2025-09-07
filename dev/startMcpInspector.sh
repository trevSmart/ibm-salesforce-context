# MCP Inspector launcher script
# Marc Pla, april 2025

BROWSER="safari" #"system", "chrome", "safari"

clear

# Add a function to manage processes
cleanup() {
    pkill -f "@modelcontextprotocol/inspector" 2>/dev/null || true
    pkill -f "node.*index.js" 2>/dev/null || true
    rm -f "$temp_file"
}

# Register cleanup function for script exit
trap cleanup EXIT

printf "\033[1mTerminating existing MCP Inspector processes\033[0m...\n"
cleanup
echo ""

printf "\033[1mLoading environment variables\033[0m...\n"
MCP_SALESFORCE_PATH="/Users/marcpla/Documents/Feina/Projectes/mcp/ibm-salesforce-context/"
cd "$MCP_SALESFORCE_PATH"
if [ -f ".env" ]; then
    # Load all variables at once
    set -a
    source .env
    set +a

    # Verify all required variables are defined
    # required_vars=("SfApiVersion" "SfLoginUrl" "SfClientId" "SfClientSecret" "SfUsername" "SfPassword" "SfAgentforceAgentId")
    required_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "Error: Variable $var is not defined in .env file"
            echo "    Current value: ${!var}"
            exit 1
        else
            value="${!var}"
            if [ ${#value} -gt 15 ]; then
                echo "    $var: ${value:0:15}..."
            else
                echo "    $var: $value"
            fi
        fi
    done
fi


# Function to show a spinner and detect server startup
show_spinner() {
    local temp_file=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local server_ready=false
    local timeout=45  # 45 seconds maximum
    local start_time=$(date +%s)

    while ! $server_ready; do
        # Check timeout
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        if [ $elapsed -ge $timeout ]; then
            printf "\r\033[1mStarting MCP Inspector server\033[0m... ✗  \n"
            echo "Error: Timeout waiting for server to start"
            echo "Last server messages:"
            tail -n 10 "$temp_file"
            exit 1
        fi

        # Check for server readiness using multiple methods
        # Method 1: Check for old message format
        if grep -q "MCP Inspector is up and running at" "$temp_file"; then
            sleep 2
            server_ready=true
        fi

        # Method 2: Check if server is listening on a port
        local port=$(lsof -i | grep node | grep LISTEN | awk '{print $9}' | grep -o '[0-9]*$' | head -1)
        if [ -n "$port" ]; then
            # Verify it's the MCP Inspector by checking HTML content
            if curl -s http://localhost:$port | grep -q "MCP Inspector"; then
                sleep 2
                server_ready=true
            fi
        fi

        for i in $(seq 0 9); do
            printf "\r\033[1mStarting MCP Inspector server\033[0m... \033[38;5;208m%s\033[0m  " "${spinstr:$i:1}"
            sleep $delay
        done
    done
    printf "\r\033[1mStarting MCP Inspector server\033[0m... \033[32m✓\033[0m  \n"
}

get_browser() {
    local browser_name
    case $BROWSER in
        "chrome")
            browser_name="Google Chrome"
            ;;
        "safari")
            browser_name="Safari"
            ;;
        "system")
            local browser_bundle_id=$(defaults read com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers | grep 'LSHandlerRoleAll.*http' -B 1 | grep LSHandlerURLScheme -A 1 | grep bundleid | cut -d'"' -f2)
            case $browser_bundle_id in
                "com.google.chrome")
                    browser_name="Google Chrome"
                    ;;
                "com.apple.safari")
                    browser_name="Safari"
                    ;;
                "org.mozilla.firefox")
                    browser_name="Firefox"
                    ;;
                *)
                    browser_name="Unknown"
                    ;;
            esac
            ;;
        *)
            browser_name="Unknown"
            ;;
    esac
    echo "$browser_name"
}

close_previous_browser_tabs() {
    local browser=$(get_browser)
    case $browser in
        "Google Chrome")
            osascript <<EOF
            tell application "Google Chrome"
                set windowList to every window
                repeat with theWindow in windowList
                    set tabList to every tab of theWindow
                    repeat with theTab in tabList
                        if (URL of theTab contains "127.0.0.1") then
                            close theTab
                        end if
                    end repeat
                end repeat
            end tell
EOF
            ;;
        "Safari")
            osascript <<EOF
            tell application "Safari"
                activate
                try
                    repeat with w in windows
                        try
                            repeat with t in tabs of w
                                if (URL of t contains "127.0.0.1") then
                                    tell w
                                        set current tab to t
                                        close current tab
                                    end tell
                                end if
                            end repeat
                        end try
                    end repeat
                end try
            end tell
EOF
            ;;
        "Firefox")
            osascript <<EOF
            tell application "Firefox"
                set windowList to every window
                repeat with theWindow in windowList
                    set tabList to every tab of theWindow
                    repeat with theTab in tabList
                        if (URL of theTab contains "127.0.0.1") then
                            close theTab
                        end if
                    end repeat
                end repeat
            end tell
EOF
            ;;
    esac
}

open_new_browser_tab() {
    local url=$1
    local browser=$(get_browser)

    case $browser in
        "Google Chrome")
            open -a "Google Chrome" "$url"
            ;;
        "Safari")
            open -a "Safari" "$url"
            ;;
        *)
            # For Firefox or unknown, use default browser
            open "$url"
            ;;
    esac
}

# Ensure no previous processes are running
echo ""
cleanup

# Create temporary file for output
temp_file=$(mktemp)

# Execute inspector in background and redirect output to temp file
SERVER_COMMAND="node /Users/marcpla/Documents/Feina/Projectes/mcp/ibm-salesforce-context/index.js"

# Define allowed variables
INSPECTOR_ENV_VARS=(WORKSPACE_FOLDER_PATHS SF_MCP_AGENTFORCE_AGENT_ID)
for var in "${INSPECTOR_ENV_VARS[@]}"; do
    value="${!var}"
    if [ -n "$value" ]; then
        INSPECTOR_ARGS+=" -e $var=$value"
    fi
done

export MCP_AUTO_OPEN_ENABLED=false
npx @modelcontextprotocol/inspector --config "$MCP_SALESFORCE_PATH/dev/mcpInspectorConfig.json" --server ibm-salesforce-context > "$temp_file" 2>&1 &
# npx @modelcontextprotocol/inspector $SERVER_COMMAND $INSPECTOR_ARGS > "$temp_file" 2>&1 &

# Save process PID
server_pid=$!

# Show spinner while waiting for server to start
show_spinner "$temp_file"

# Find the MCP Inspector URL
# First try the old way
# url=$(grep "MCP Inspector is up and running at " "$temp_file" | sed 's/.*running at \(http[^ ]*\).*/\1/')
url=$(awk '/MCP Inspector is up and running at/{getline; print $1}' "$temp_file")

# If not found, try to detect it from the listening ports
if [ -z "$url" ]; then
    port=$(lsof -i | grep node | grep LISTEN | awk '{print $9}' | grep -o '[0-9]*$' | head -1)
    if [ -n "$port" ]; then
        if curl -s http://localhost:$port | grep -q "MCP Inspector"; then
            url="http://localhost:$port"
        fi
    fi
fi

if [ -n "$url" ]; then
    # Show server output in real time
    echo ""
    echo "MCP Inspector is running at $url"
    tail -n 2 "$temp_file"

    echo ""
    printf "\033[1mOpening UI\033[0m in $(get_browser) browser:\n"
    echo "    Closing previous tabs..."
    close_previous_browser_tabs
    echo "    Opening new tab..."
    open_new_browser_tab "$url"

    echo ""
    printf "\033[1mServer output\033[0m (Ctrl+C to stop):\n"
    echo ""
    tail -n 0 -f "$temp_file"
    tail_pid=$!

    # Wait for main process
    wait $server_pid
else
    echo "Error: Failed to start MCP server"
    echo "Checking process status..."
    if ps -p $server_pid > /dev/null; then
        echo "Server process still running (PID: $server_pid)"
        echo "Last server messages:"
        # tail -n 2 "$temp_file"
        tail -n 20 "$temp_file"
    else
        echo "Server process not running"
    fi
    exit 1
fi

