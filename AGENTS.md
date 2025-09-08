# Agent instructions for IBM Salesforce Context MCP Server

## Project description

### Overview

IBM Salesforce Context is a Model Context Protocol (MCP) server built in Node.js that provides context AI agents (usually IDE AI agents) to help the user complete Salesforce related tasks, connecting to the Salesforce org either retrieving the necessary information or perfsorming operations.

- Built in Node.js
- Implements [Model Context Protocol (MCP)](https://modelcontextprotocol.io/specification/) through its official Typescript SDK [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk). Extensive use of the protocol features:
    - Tools
    - Resources and resource links
    - Roots
    - Prompts
    - Elicitation
    - Completion
    - Sampling
    - Progress notifications
    - Logging
- Linting with Biome 2
- Testing with Vitest

### Prerequisites

- Node.js > v22
- Salesforce CLI logged to a Salesforce org
- MCP Client (usually an IDE like VS Code, Cursor or Claude Desktop)

### Features

- Automatic management of Salesforce connection through Salesforce CLI watcher
- Both HTTP and stdio transport support
- Exposes MCP tools and resources to help the IDE AI agent performe Salesforce related tasks like:
    - Performing DML operations
    - Retrieving SObject schema
    - Querying Salesforce data with SOQL
    - Executing anonymous Apex scripts
    - Running Apex tests and retrieving Apex classes test coverage
    - Retriving Setup Audit Trail data
    - Calling Salesforce REST, Tooling and Composite APIs
    - Managing and retrieving Apex debug logs
- Automatic Salesforce CLI version updating
- Automatic daily SObject definition retrieval
- Built-in issue reporting tool

## Development

- All literals including comments and documentation must be in English.
- To run linting run:
    ```
    npm run lint:fix
    ```

### README Management

The project includes automated README management to keep package name references synchronized:

- **Automatic Updates**: GitHub Actions automatically update README.md when package.json changes
- **Manual Updates**: Run `npm run update-readme` to manually update README.md with current package name
- **Placeholder System**: Use `<package-name>` in README.md, which gets replaced with the actual package name
- **Integration**: The update script runs automatically during package publishing

The `dev/updateReadme.js` script handles:
- Replacing `<package-name>` placeholders with the actual package name from package.json
- Updating deeplinks for IDE installations
- Maintaining consistency across all documentation

## Testing

### Testing prerequisites

- Salesforce CLI needs to be available in the working directory.

  - Check with:

    ```
    sf version
    ```

  - If check fails, run the following command and check again:

    ```
    npm install @salesforce/cli --save-dev
    ```

- Salesforce CLI must be logged to a Salesforce org.

  - Check with:

    ```
    sf org display --json
    ```

  - If check fails, run the following commands and check again:

    ```
    source .env

    response=$(curl -s -X POST "https://test.salesforce.com/services/oauth2/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password" \
      -d "client_id=$SF_ORG_CLIENT_ID" \
      -d "client_secret=$SF_ORG_CLIENT_SECRET" \
      -d "username=$SF_ORG_CLIENT_USERNAME" \
      -d "password=$SF_ORG_CLIENT_PASSWORD")

    export SF_ACCESS_TOKEN=$(echo "$response" | jq -r '.access_token')
    export SF_INSTANCE_URL=$(echo "$response" | jq -r '.instance_url')

    sf org login access-token --instance-url $SF_INSTANCE_URL --no-prompt --set-default
    ```

- Some tools requiere the working directory to be the root of a Salesforce project.

  - Check with:
    ```
    [ -f sfdx-project.json ] && [ -d force-app/main/default/ ] && echo "OK" || echo "NOT OK"
    ```
  - If check fails, run the following command and check again:
    ```
    sf project generate --name SalesforceTestProject
    ```

### Running tests

- #### Vitest test scripts

  Tests are written with Vitest and are located in the `test` directory.
  Currently tests only use stdio transport so they are not suitable for testing HTTP transport.

- To run all tests use:

  ```
  npm run test
  ```

- To run specific tests:

  ```
  npm run test -- --run describeObject.test.js executeSoqlQuery.test.js
  ```

#### Interacting with the MCP server in HTTP mode

- Boot the MCP server in HTTP mode working in the Salesforce project directory:
  ```
  echo WORKSPACE_FOLDER_PATHS=<PATH_TO_SALESFORCE_PROJECT> >> .env

  npm run start
  ```

- Use curl to send valid MCP requests with JSON-RPC messages to the server. For example:

  - Initialization request to get the session ID:

    ```
    curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {
          "roots": {"listChanged": true},
          "sampling": {}
        },
        "clientInfo": {
          "name": "curl-test-client",
          "version": "1.0.0"
        }
      }
    }'
    ```

  - Get tools list request
    ```
    curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "mcp-session-id: <SESSION_ID>" \
    -d '{
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/list"
    }'
    ```
  - Disconnect request
    ```
    curl -X DELETE http://localhost:3000/mcp \
    -H "mcp-session-id: <SESSION_ID>"
    ```

- #### (STILL NOT AVAILABLE!!) Using the MiCroscoPe MCP Client command line interface

  The MiCroscoPe client is available as a dev dependency (microscope-mcp-client). It can connect to the MCP server through stdio transport and provides an interface command line interface to operate the MCP server.

  You can run it with:
  ```
  microscope --server local_mcp_server.js #For local servers

  ```

## Pull requests

Always run linting after commiting.

## Reference

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

- [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

- ["Everything" MCP example server](https://github.com/modelcontextprotocol/servers/tree/main/src/everything)

- [Salesforce CLI command reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)

- [Playwright library documentation](https://playwright.dev/docs/api/class-playwright)