

import {createMcpClient, disconnectMcpClient} from '../testMcpClient.js';

describe('executeAnonymousApex', () => {
	let client;

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient();
	});

	afterAll(async () => {
		await disconnectMcpClient(client);
	});

	test('simple', async () => {
		// Verificar que el client està definit
		expect(client).toBeTruthy();

		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "System.debug('Hello from MCP tool test');\nSystem.debug('Current time: ' + Datetime.now());",
			mayModify: false
		});
		expect(result).toBeTruthy();

		// Comprovem que el resultat té l'estructura esperada
		if (result?.structuredContent?.success !== undefined) {
			expect(result.structuredContent.success).toBe(true);
		}

		if (result?.structuredContent?.logs) {
			expect(result.structuredContent.logs).toContain('Hello from MCP tool test');
		}
	});

	test('with modification', async () => {
		const result = await client.callTool('executeAnonymousApex', {
			apexCode: "Account acc = new Account(Name='Test Account');\ninsert acc;\nSystem.debug('Created account: ' + acc.Id);",
			mayModify: true
		});

		expect(result?.structuredContent?.success).toBeTruthy(result?.structuredContent);
	});
});
