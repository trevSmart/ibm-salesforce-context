import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('getApexClassCodeCoverage', () => {
	let client

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)
	})

	test('getApexClassCodeCoverage', async () => {
		const result = await client.callTool('getApexClassCodeCoverage', {
			classNames: ['TestMCPTool'],
		})
		expect(result?.structuredContent?.classes).toBeTruthy()
		expect(Array.isArray(result.structuredContent.classes)).toBe(true)

		if (result.structuredContent.classes.length > 0) {
			const classCoverage = result.structuredContent.classes[0]
			expect(classCoverage.className).toBeTruthy()
			expect(typeof classCoverage.percentage).toBe('number')
		}
	})
})
