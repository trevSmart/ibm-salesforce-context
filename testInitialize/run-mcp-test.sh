#!/bin/bash

# Script per executar el test del servidor MCP
# Canvia al directori del projecte i executa el script TypeScript amb tsx

PROJECT_PATH="/Users/marcpla/Documents/Feina/Projectes/mcp/ibm-salesforce-context"
SCRIPT_PATH="./testInitialize/mcp-test-script.ts"

echo ""

cd "$PROJECT_PATH" || {
    echo "❌ Error: No s'ha pogut canviar al directori del projecte"
    exit 1
}

# Executa el script TypeScript amb tsx
npx tsx "$SCRIPT_PATH"
