import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('salesforceContextUtils', () => {
	let client;

	beforeAll(async () => {
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('getOrgAndUserDetails', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'getOrgAndUserDetails'
		});
		expect(result?.structuredContent?.user?.id).toBeTruthyAndDump(result?.structuredContent);
	});

	test('getState', async () => {
		const result = await client.callTool('salesforceContextUtils', {action: 'getState'});

		// ÚS DEL MATCHER PERSONALITZAT
		// Si no és true, escriu structuredContent a .test-artifacts/
		expect(result?.structuredContent?.state?.org?.user?.id).toBeTruthyAndDump(result?.structuredContent);
	});

	test('loadRecordPrefixesResource', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'loadRecordPrefixesResource'
		});
		const content = result?.content;
		expect(Array.isArray(content)).toBe(true);

		// expect(content.some(item => item.type === 'resource_link' && item.uri)).toBeTruthy(content); // TODO: REACTIVAR

		const structuredContent = result?.structuredContent;
		expect(structuredContent).toBeTruthy();
		expect(typeof structuredContent).toBe('object');
		expect(Array.isArray(structuredContent)).toBe(false);
		expect(Object.keys(structuredContent).length).toBeGreaterThan(0);
	}, 15_000);

	test('getCurrentDatetime', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'getCurrentDatetime'
		});
		expect(result?.structuredContent?.now).toBeTruthy();
		expect(result?.structuredContent?.timezone).toBeTruthy();
	});

	test('clearCache', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'clearCache'
		});
		expect(result?.structuredContent?.status).toBe('success');
		expect(result?.structuredContent?.action).toBe('clearCache');
	});

	test('reportIssue', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'reportIssue',
			issueDescription: 'Test issue for validation',
			issueToolName: 'testTool'
		});
		expect(result?.structuredContent?.success).toBe(true);
		expect(result.structuredContent.issueId).toBeTruthy();
	});
});
