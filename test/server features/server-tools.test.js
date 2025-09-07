
import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('Server tools', () => {
	let client;

	afterEach(async () => {
		await disconnectMcpClient(client);
		// Additional cleanup time
		await new Promise(resolve => setTimeout(resolve, 2000));
	});

	test('should retrieve the list of available tools from the server', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();

		// Verify the client is defined
		expect(client).toBeTruthy();

		// Get the list of available tools from the server
		const toolsList = await client.listTools();

		// Verify we received a tools list
		expect(toolsList).toBeTruthy();
		expect(Array.isArray(toolsList)).toBe(true);
		expect(toolsList.length).toBeGreaterThan(0);

		// Verify the structure of tool items
		const firstTool = toolsList[0];
		expect(firstTool).toHaveProperty('name');
		expect(firstTool).toHaveProperty('description');
		// MCP spec: tools expose `inputSchema` (not `parameters`)
		expect(firstTool).toHaveProperty('inputSchema');

		// Verify some expected tools are present
		const toolNames = toolsList.map(tool => tool.name);
		expect(toolNames).toContain('salesforceContextUtils');
		expect(toolNames).toContain('executeAnonymousApex');
		expect(toolNames).toContain('describeObject');

		console.log(`Successfully retrieved ${toolsList.length} tools from the server`);
	}, 10000); // 10 second timeout to allow for server initialization
});
