# Agent instructions for IBM Salesforce MCP Server

## Project description

### Overview

IBM Salesforce MCP Server is a Model Context Protocol (MCP) server built in Node.js that provides context AI agents (usually IDE AI agents) to help the user complete Salesforce related tasks, connecting to the Salesforce org either retrieving the necessary information or performing operations.

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

## Coding

- To run linting run:
    ```
    npm run lint:fix
    ```

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

    export SF_ACCESS_TOKEN=$(curl -s -X POST "https://test.salesforce.com/    services/oauth2/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password" \
      -d "client_id=$SF_ORG_CLIENT_ID" \
      -d "client_secret=$SF_ORG_CLIENT_SECRET" \
      -d "username=$SF_ORG_CLIENT_USERNAME" \
      -d "password=$SF_ORG_CLIENT_PASSWORD" | \
      grep -o '"access_token":"[^"]*' | \
      cut -d':' -f2 | \
      tr -d '"')

    sf org login access-token --instance-url $SF_ORG_URL --no-prompt --set-default
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

Tests are written with Vitest and are located in the `test` directory.

- To run all tests use:
    ```
    npm run test
    ```

- To run specific tests:
    ```
    npm run test -- --run describeObject.test.js executeSoqlQuery.test.js
    ```

## Pull requests

Always run linting after commiting.

## Reference

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

- [MCP Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

- ["Everything" MCP example server](https://github.com/modelcontextprotocol/servers/tree/main/src/everything)

- [Salesforce CLI command reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)

- [Playwright library documentation](https://playwright.dev/docs/api/class-playwright)