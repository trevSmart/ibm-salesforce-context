import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('executeSoqlQuery', () => {
	let client

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)
	})

	test('basic query', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: 'SELECT Id, Name FROM Account LIMIT 3',
		})
		const sc = result?.structuredContent
		expect(sc).toBeTruthy()
		expect(Array.isArray(sc.records)).toBe(true)
		expect(sc.records.length).toBeGreaterThan(0)

		const r = sc.records[0]
		expect(r.Id).toBeTruthy()
		expect(r.Name).toBeTruthy()
	})

	test('with no results', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: "SELECT Id, Name FROM Account WHERE Name = 'NonExistentAccount12345' LIMIT 1",
		})
		const sc = result?.structuredContent
		expect(sc).toBeTruthy()
		expect(Array.isArray(sc.records)).toBe(true)
		expect(sc.records.length).toBe(0)
	})

	test('with Tooling API', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: 'SELECT Id, Name FROM ApexClass LIMIT 3',
			useToolingApi: true,
		})
		const sc = result?.structuredContent
		expect(sc).toBeTruthy()
		expect(Array.isArray(sc.records)).toBe(true)
	})

	test('with Tooling API and no results', async () => {
		const result = await client.callTool('executeSoqlQuery', {
			query: "SELECT Id, Name FROM ApexClass WHERE Name = 'NonExistentApexClass12345' LIMIT 1",
			useToolingApi: true,
		})
		const sc = result?.structuredContent
		expect(sc).toBeTruthy()
		expect(Array.isArray(sc.records)).toBe(true)
		expect(sc.records.length).toBe(0)
	})
})
