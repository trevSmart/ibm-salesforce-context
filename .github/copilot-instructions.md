# IBM Salesforce Context MCP Server

IBM Salesforce Context is a Node.js Model Context Protocol (MCP) server that provides Salesforce org context to IDE AI agents for development, querying, and operations.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

- **Bootstrap the repository**:
  - `npm ci` -- installs dependencies in ~15 seconds. NEVER CANCEL.
  - Note: Node v22.7.0+ required (engines specified in package.json). Lower versions show warnings but work.
  - Salesforce CLI available locally: `npm install @salesforce/cli --save-dev` -- takes ~52 seconds. NEVER CANCEL.

- **Linting and code quality**:
  - `npm run lint:fix` -- runs Biome linter/formatter in ~1 second. NEVER CANCEL.
  - Uses comprehensive Biome v2 configuration with strict rules
  - Schema warning about 2.2.2 vs 2.2.3 is harmless

- **CLI functionality**:
  - `node bin/cli.js --help` -- shows CLI usage (~0.4 seconds)
  - `node bin/cli.js --version` -- shows version info (~0.4 seconds)
  - `node bin/cli.js --transport stdio` -- starts stdio transport (default)
  - `node bin/cli.js --transport http --port 3000` -- starts HTTP transport
  - Auto port selection: if port busy, automatically uses next available port

- **HTTP server mode**:
  - `npm run start` -- equivalent to `node index.js --transport http`
  - Server starts in ~1 second with automatic port management
  - Endpoints: `/` (HTML status), `/healthz` (JSON), `/status` (JSON), `/mcp` (MCP protocol)
  - Root endpoint provides beautiful dashboard with server status

- **Testing (requires Salesforce setup)**:
  - `npm test` -- runs Vitest tests. NEVER CANCEL: takes 30-45 seconds with SF org, 2+ minutes without (due to timeouts). Set timeout to 300+ seconds.
  - Tests require: Salesforce CLI connected to org, optionally SF project structure
  - Without SF org: all tests fail with "Org details not available" - this is expected
  - Parallel test execution optimized for 31% speed improvement (30+ test files)
  - Retry mechanism: tests retry up to 2 times on failure

## Validation Scenarios

**ALWAYS test these complete scenarios after making changes:**

- **CLI validation**: Run `node bin/cli.js --help` and `node bin/cli.js --version` - both should complete in <1 second
- **HTTP server startup**: Start server with `node bin/cli.js --transport http`, verify it starts within 5 seconds, shows "Server started" message
- **MCP protocol validation**: Send initialize request to HTTP `/mcp` endpoint with proper headers:
  ```bash
  curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
  ```
  Should return proper MCP initialization response with server capabilities.
- **Stdio transport validation**: Echo JSON MCP message to stdio transport, verify proper MCP response format
- **Port management**: Start multiple HTTP servers, verify automatic port selection works

## Prerequisites and Environment

**For basic development (no testing)**:
- Node.js v22.7.0+ (lower versions work with warnings)
- No additional dependencies required

**For testing and full functionality**:
- Salesforce CLI: `npm install @salesforce/cli --save-dev` or global install
- Salesforce org connection: `sf org display --json` should succeed
- Optionally: Salesforce project structure (`sfdx-project.json` and `force-app/main/default/`)

**To create test Salesforce project**:
```bash
sf project generate --name SalesforceTestProject --output-dir ./test-project
```

**Check Salesforce prerequisites**:
```bash
sf version  # Should show Salesforce CLI version
sf org display --json  # Should show org details or "No default environment" error
```

## Build and Publishing

- **No traditional build process** - runs directly from source
- **Publishing pipeline**: `dev/publish-package.sh` - complex script with obfuscation, validation, and NPM publishing
- **Code obfuscation**: JavaScript files are obfuscated for distribution while preserving ES module exports
- **Three-tier testing**: source tests, obfuscated build tests, published package validation via npx

## Common Workflows

**Quick development validation**:
```bash
npm ci
npm run lint:fix
node bin/cli.js --help
node bin/cli.js --transport http --port 3001 &
curl -s http://localhost:3001/healthz
kill %1
```

**Full testing workflow** (requires Salesforce org):
```bash
npm ci
npm install @salesforce/cli --save-dev  # if not already installed
sf org display --json  # verify org connection
npm test  # NEVER CANCEL: 30s-2min depending on org setup
npm run lint:fix
```

## Key Files and Directories

**Entry points**:
- `bin/cli.js` - CLI entry point (thin wrapper to index.js)
- `index.js` - Main server entry with argument parsing
- `src/mcp-server.js` - Core MCP server implementation

**Configuration**:
- `package.json` - Project config, scripts, dependencies
- `biome.json` - Linting and formatting rules (comprehensive)
- `vitest.config.ts` - Test configuration with timeouts and retry
- `tsconfig.json` - TypeScript support for development

**Testing**:
- `test/` - 30+ test files organized by feature
- `test/setup.ts` - Test setup with server initialization
- Tests use parallel execution for performance

**Development tools**:
- `dev/publish-package.sh` - Publishing pipeline with obfuscation
- `dev/startMcpInspector.sh` - MCP Inspector launcher (macOS-specific)

## Transport Modes

**Stdio Transport** (default):
- For MCP client integration (VS Code, Cursor, Claude Desktop)
- Input/output via stdin/stdout with JSON-RPC messages
- Use for production IDE integrations

**HTTP Transport**:
- For development, testing, debugging
- Provides web interface, health checks, direct HTTP endpoints
- Auto port management (3000, 3001, 3002, etc.)
- Server-Sent Events for MCP protocol responses

## Troubleshooting

**Server crashes with "Org details not available"**:
- Expected behavior without Salesforce org connection
- Server initializes successfully but cannot load Salesforce tools
- Use `MCP_REPORT_ISSUE_DRY_RUN=true` environment variable for testing

**Port conflicts**:
- HTTP transport automatically finds available ports
- Error message shows which port is being used instead

**Test failures**:
- Without Salesforce org: all tests fail with timeout/connection errors - this is expected
- With Salesforce org: failures indicate actual issues to investigate

**Node version warnings**:
- Engine requirements prefer Node 22.7.0+ but lower versions work
- Warnings about @modelcontextprotocol/inspector engine requirements are harmless