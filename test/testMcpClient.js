import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE_URL = `http://localhost:${process.env.MCP_HTTP_PORT || '3000'}/mcp`;

let sharedClient;

export async function createMcpClient() {
        if (sharedClient) {
                return sharedClient;
        }

        const transport = new StreamableHTTPClientTransport(BASE_URL);
        const coreClient = new Client(
                {name: 'vitest-test-client', version: '1.0.0'},
                {capabilities: {logging: {}}, prompts: {}}
        );
        await coreClient.connect(transport);

        // Sleep for 2 seconds before proceeding to ensure the server is ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        sharedClient = {
                listResources: async () => (await coreClient.listResources()).resources,
                readResource: async (uri) => await coreClient.readResource({uri}),
                callTool: async (name, args) => coreClient.callTool({name, arguments: args}),
                getPrompt: async (name, args) => coreClient.getPrompt({name, arguments: args}),
                listTools: async () => (await coreClient.listTools()).tools,
                disconnect: async () => coreClient.close()
        };

        return sharedClient;
}

// Intentionally left as a no-op to retain the shared client during tests
export async function disconnectMcpClient() {
        // no operation
}

export async function shutdownMcpClient() {
        if (sharedClient && typeof sharedClient.disconnect === 'function') {
                await sharedClient.disconnect();
                sharedClient = undefined;
        }
}

export async function listTools(client) {
        return client.listTools();
}
