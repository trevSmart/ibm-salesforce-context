## <img src="docs/assets/images/ibm-logo.webp" alt="IBM logo" width="52" style="position: relative; margin-right: 4px; top: 4px;"/> IBM Salesforce Context

An MCP server by IBM that provides Salesforce org context to your IDE AI agent

### Key features
- **Salesforce Integration**: Seamless connection to Salesforce orgs for AI-powered development
- **MCP Protocol**: Built on the Model Context Protocol for IDE integration
- **Parallel Test Execution**: Intelligent test grouping for 31% faster test execution
- **Automated Code Review**: GitHub Actions workflows for continuous code quality
- **Security Scanning**: Automated vulnerability detection and dependency management
- **Code Quality**: Biome integration with comprehensive rule sets

### Requirements
- Node.js v22.7.0 or newer
- Salesforce CLI connected to an org (only for internal testing)
- VS Code, Cursor, Windsurf, Claude Desktop or any other IDE supporting MCP

### 🚀 Automated Code Review System

This project includes a comprehensive automated code review system powered by GitHub Actions:

#### **Pull Request Workflows**
- **Automated Checks**: Runs on every PR with linting, testing, and security scans
- **Code Quality Analysis**: Biome integration with detailed reporting
- **Security Audits**: Automated vulnerability detection and dependency scanning
- **Multi-Node Testing**: Ensures compatibility across Node.js versions

#### **Code Review Features**
- **Automated Feedback**: Bot comments with detailed analysis and recommendations
- **Quality Metrics**: Code complexity, maintainability, and best practices checks
- **Issue Templates**: Standardized reporting for bugs, features, and code quality issues
- **Pull Request Templates**: Structured PR submissions with comprehensive checklists

#### **Security & Monitoring**
- **CodeQL Analysis**: Advanced security scanning for JavaScript vulnerabilities
- **Dependabot Integration**: Automated dependency updates with security focus
- **Scheduled Health Checks**: Weekly automated code quality assessments
- **Vulnerability Reporting**: Automatic issue creation for security concerns

#### **Workflow Triggers**
- Pull requests and pushes to main branches
- Weekly scheduled health checks
- Manual workflow triggering for on-demand analysis

### Getting started

First, add IBM Salesforce Context to your client. A typical configuration looks like this:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest"
      ]
    }
  }
}
```

### Command Line Interface

IBM Salesforce Context supports comprehensive CLI arguments for configuration:

#### Basic Usage

```bash
# Use stdio transport (default)
test_research4

# Use HTTP transport
test_research4 --transport http

# Use HTTP transport with custom port
test_research4 --transport http --port 8080

# HTTP transport automatically finds available port if default is occupied
test_research4 --transport http  # Will use 3001, 3002, etc. if 3000 is busy

# Set log level
test_research4 --transport stdio --log-level debug

# Set workspace paths
test_research4 --transport http --workspace /path/to/project

# Show help
test_research4 --help

# Show version
test_research4 --version
```

#### CLI Arguments

| Argument | Description | Default | Example |
|----------|-------------|---------|---------|
| `--transport TYPE` | Transport type: `stdio` or `http` | `stdio` | `--transport http` |
| `--log-level LEVEL` | Set log level | `info` | `--log-level debug` |
| `--port PORT` | HTTP port for http transport (auto-finds available if occupied) | `3000` | `--port 8080` |
| `--workspace PATHS` | Workspace paths (comma-separated) | - | `--workspace /path/to/project` |
| `--help` | Show help message | - | `--help` |
| `--version` | Show version information | - | `--version` |

#### Environment Variables

Environment variables can be used for default configuration (overridden by CLI arguments):

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MCP_TRANSPORT` | Transport type: `stdio` or `http` | `stdio` | `MCP_TRANSPORT=http` |
| `LOG_LEVEL` | Log level | `info` | `LOG_LEVEL=debug` |
| `MCP_HTTP_PORT` | HTTP port for http transport (auto-finds available if occupied) | `3000` | `MCP_HTTP_PORT=8080` |
| `WORKSPACE_FOLDER_PATHS` | Workspace paths (comma-separated) | - | `WORKSPACE_FOLDER_PATHS=/path/to/project` |

#### Automatic Port Management

When using HTTP transport, the server automatically handles port conflicts:

- **Default Behavior**: Starts on port 3000 (or specified port)
- **Port Conflict Detection**: If the requested port is occupied, automatically finds the next available port
- **User Notification**: Displays a warning message when using an alternative port
- **Port Range**: Checks up to 10 consecutive ports starting from the requested port
- **Error Handling**: Clear error messages if no ports are available

Example output when port 3000 is occupied:
```
⚠️  Port 3000 is occupied. Using port 3001 instead.
🚀 MCP HTTP server running on port 3001
```

#### HTTP Endpoints

When running in HTTP mode, the server provides several useful endpoints:

##### Root Status Page
```bash
# Open in browser or use curl
curl http://localhost:3000/
```

Returns a beautiful HTML dashboard showing:
- Server status and uptime
- Salesforce CLI version and org connection status
- Available MCP tools and resources
- Environment information
- Real-time status updates

The root page serves as the default landing page when accessing the server in a web browser.

##### Health Check Endpoint
```bash
curl http://localhost:3000/healthz
```

Returns basic health information:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "activeSessions": 2,
  "serverType": "MCP HTTP Server",
  "version": "1.0.0"
}
```

##### Detailed Status Endpoint
```bash
curl http://localhost:3000/status
```

Returns comprehensive server information including:
- Server details (name, version, uptime)
- Active MCP sessions
- Salesforce CLI version and org connection status
- Available MCP tools and resources
- Environment information

#### Priority Order

Configuration values are applied in the following priority order:

1. **CLI Arguments** (highest priority)
2. **Environment Variables** (medium priority)
3. **Defaults** (lowest priority)

#### Examples

```bash
# CLI argument overrides environment variable
MCP_TRANSPORT=http test_research4 --transport stdio  # Result: stdio

# Environment variable when no CLI argument
MCP_TRANSPORT=http test_research4  # Result: http

# Default when no CLI or environment variable
test_research4  # Result: stdio

# Complex configuration
test_research4 --transport http --port 3001 --log-level debug --workspace /path/to/project
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522salesforce%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522test_research4%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522salesforce%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522test_research4%2540latest%2522%255D%257D)

<details><summary><b>Install in VS Code</b></summary>
After installation, IBM Salesforce Context will be available for use with your GitHub Copilot agent in VS Code.
</details>

<details>
<summary><b>Install in Cursor</b></summary>

#### Click the button to install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=salesforce&config=eyJjb21tYW5kIjoibnB4IHRlc3RfcmVzZWFyY2g0QGxhdGVzdCJ9)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx test_research4`. You can also verify config or add command like arguments via clicking `Edit`.

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

You can customize the server with CLI arguments:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "http",
        "--port",
        "8080",
        "--log-level",
        "debug"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use following configuration:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

You can customize with additional CLI arguments:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "http",
        "--port",
        "3000",
        "--log-level",
        "info"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use following configuration:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

You can customize with CLI arguments:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "http",
        "--port",
        "3000"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Use the Claude Code CLI to add IBM Salesforce Context:

```bash
# Basic installation
claude mcp add salesforce npx test_research4@latest

# With CLI arguments
claude mcp add salesforce "npx test_research4@latest --transport http --port 3000"
```
</details>

<details>
<summary><b>Install in Gemini CLI</b></summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use following configuration:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

You can customize with CLI arguments:

```js
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": [
        "test_research4@latest",
        "--transport",
        "http",
        "--port",
        "3000",
        "--log-level",
        "debug"
      ]
    }
  }
}
```
</details>

## 🧪 Testing

The project includes a comprehensive testing system with **parallel execution support** for significantly faster test runs.

### Test Execution

```bash
# Run all tests
npm test

# Run specific tests
npm test -- --tests "describeObject,executeSoqlQuery"

# Test parallel execution logic
node test/test-parallel.js
```

### Parallel Execution Benefits

- **31% faster execution** (from ~48s to ~30.5s)
- **19 tests run in parallel** after initialization
- **Automatic dependency resolution** ensures correct test order
- **Limited concurrency** (max 5) prevents overwhelming Salesforce

### Test Phases

```
Phase 0-2: Sequential initialization (3 tests)
Phase 3: Parallel execution (19 tests) ← Major time savings
Phase 4-7: Sequential operations (8 tests)
```

For detailed information, see [Parallel Execution Documentation](docs/parallel-execution.md).

## License
See the LICENSE file for details.
