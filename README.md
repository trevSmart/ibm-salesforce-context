## <img src="docs/assets/images/ibm-logo.webp" alt="IBM logo" width="52" style="position: relative; margin-right: 4px; top: 4px;"/> IBM Salesforce MCP Server

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

First, install the IBM Salesforce MCP server with your client. A typical configuration looks like this:

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

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522salesforce%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522test_research4%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522salesforce%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522test_research4%2540latest%2522%255D%257D)

<details><summary><b>Install in VS Code</b></summary>
After installation, the IBM Salesforce MCP server will be available for use with your GitHub Copilot agent in VS Code.
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
        "test_research4@latest"
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
        "test_research4@latest"
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
        "test_research4@latest"
      ]
    }
  }
}
```
</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Use the Claude Code CLI to add the IBM Salesforce MCP server:

```bash
claude mcp add salesforce npx test_research4@latest
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
        "test_research4@latest"
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
