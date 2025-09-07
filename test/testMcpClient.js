import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE_URL = `http://localhost:${process.env.MCP_HTTP_PORT || '3000'}/mcp`;

export async function createMcpClient() {
        const transport = new StreamableHTTPClientTransport(BASE_URL);
        const coreClient = new Client(
                {name: 'vitest-test-client', version: '1.0.0'},
                {capabilities: {logging: {}}}
        );
        await coreClient.connect(transport);

        // Sleep for 2 seconds before proceeding to ensure the server is ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        return {
                listResources: async () => (await coreClient.listResources()).resources,
                readResource: async (uri) => await coreClient.readResource({uri}),
                callTool: async (name, args) => coreClient.callTool({name, arguments: args}),
                listTools: async () => (await coreClient.listTools()).tools,
                disconnect: async () => coreClient.close()
        };
}

export async function disconnectMcpClient(client) {
        if (client && typeof client.disconnect === 'function') {
                await client.disconnect();
        }
}

export async function listTools(client) {
        return client.listTools();
}
