

import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('getRecentlyViewedRecords', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getRecentlyViewedRecords', async () => {
		const result = await client.callTool('getRecentlyViewedRecords', {});
		const structuredContent = result?.structuredContent;

		console.error('🔥 structuredContent', structuredContent);

		expect(structuredContent?.records).toBeTruthy(structuredContent);
		expect(Array.isArray(structuredContent.records)).toBe(true);
		expect(typeof structuredContent.totalSize).toBe('number');
		expect(structuredContent.totalSize).toBeGreaterThan(0);
	});
});
