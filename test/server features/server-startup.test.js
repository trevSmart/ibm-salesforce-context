
import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('Server Startup', () => {
	let client;

	afterEach(async () => {
		await disconnectMcpClient(client);
	});

	test('should start the MCP server successfully', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();

		// Verify the client is defined
		expect(client).toBeTruthy();

		// Test that we can call a simple tool to verify server is working
		const result = await client.callTool('salesforceContextUtils', {
			action: 'getState'
		});
		expect(result).toBeTruthy();
		expect(result.structuredContent).toBeTruthy();

		console.log('Server started successfully and tools are accessible');
	}, 10000); // 10 second timeout to allow for server initialization
});
