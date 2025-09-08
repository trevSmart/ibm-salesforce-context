import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('call-all-tools', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('prompt', async () => {
		const result = await client.getPrompt('tools-basic-run', {});
		const hasMessages = result?.messages;
		const isArray = Array.isArray(result?.messages);
		const isValidMessages = hasMessages && isArray;

		expect(isValidMessages).toBe(true);
		expect(result.messages.length).toBeGreaterThan(0);
		expect(['assistant', 'user']).toContain(result.messages[0].role);
		expect(result.messages[0].content?.type).toBeTruthy();
		expect(result.messages[0].content?.text).toBeTruthy();

		// Validate that the prompt contains the expected content structure
		const promptText = result.messages[0].content.text;
		expect(promptText).toContain('comprehensive, safe run');
		expect(promptText).toContain('salesforceContextUtils');
		expect(promptText).toContain('getRecentlyViewedRecords');
		expect(promptText).toContain('executeSoqlQuery');
		expect(promptText).toContain('describeObject');
		expect(promptText).toContain('Tool Execution Count');
		expect(promptText).toContain('Success/Error Count');
		expect(promptText).toContain('Excluded Tools List');
	});
});
