

import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('describeObject', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	describe.concurrent('reads', () => {
		test('with non-existent object', async () => {
			const result = await client.callTool('describeObject', {
				sObjectName: 'NonExistentObject__c'
			});
			expect(result.isError).toBeTruthy();
			expect(Array.isArray(result?.content)).toBe(true);
			expect(result?.content?.length).toBeGreaterThan(0);
			expect(result?.content?.[0]?.type).toBe('text');
			expect(result?.content?.[0]?.text.toLowerCase()).toContain('error');
		});
	});

	test('Account', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account'
		});
		console.log('Result:', JSON.stringify(result, null, 2));
		expect(result).toBeTruthy();
		expect(result?.structuredContent).toBeTruthy();
		expect(result.structuredContent.name).toBe('Account');
		expect(Array.isArray(result.structuredContent.fields)).toBe(true);
		expect(result.structuredContent.fields.length).toBeGreaterThan(0);
	});

	test('with includeFields false', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'Account',
			includeFields: false
		});
		expect(result).toBeTruthy();
		expect(result?.structuredContent).toBeTruthy();
		expect(result?.structuredContent?.wasCached).toBeTruthy();
	});

	test('withtoolingApi object', async () => {
		const result = await client.callTool('describeObject', {
			sObjectName: 'ApexLog',
			useToolingApi: true
		});
		expect(result).toBeTruthy();
		expect(result?.structuredContent).toBeTruthy();
		expect(Array.isArray(result?.structuredContent?.fields)).toBe(true);
		expect(result?.structuredContent?.fields.length).toBeGreaterThan(0);
	});
});
