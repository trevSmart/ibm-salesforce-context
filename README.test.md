# Test Execution with Shared MCP Client

This project uses a shared MCP client for all tests, significantly improving performance when running multiple tests.

## How it works

Instead of creating a new MCP client for each test file, we use a single global client that is shared across all tests. This is achieved through:

1. A global MCP client created in `__tests__/setup.js`
2. Jest configuration to use this global configuration file
3. Each test file accesses the global client instead of creating a new one

## Advantages

- **Improved performance**: Only one MCP server is started for all tests
- **Fewer resources**: Fewer processes and simultaneous connections
- **Faster tests**: Elimination of overhead from creating and destroying clients for each test

## How to run the tests

To run all tests:

```bash
npm test
```

To run a specific test:

```bash
npm test -- -t "test name"
```

To run tests from a specific file:

```bash
npm test -- __tests__/tools/apexDebugLogs.test.js
```

## Test file structure

Each test file follows this structure:

```javascript
describe('toolName', () => {
  let client;

  beforeAll(() => {
    // Use the global shared client
    client = global.sharedMcpClient;
    // We don't assert here, we'll do it in the first test
  });

  test('first test', async () => {
    // Verify that the client is defined
    expect(client).toBeDefined();

    // Rest of the test...
  });

  // More tests...
});
```

## Maintenance

If you need to add a new test file, follow the pattern above. There's no need to create a new client or disconnect it at the end, as this is done automatically in the global configuration file.