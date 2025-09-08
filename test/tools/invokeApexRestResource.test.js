import { TestData } from '../test-data.js'
import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('invokeApexRestResource', () => {
	let client

	beforeAll(async () => (client = await createMcpClient()))

	afterAll(async () => await disconnectMcpClient(client))

	test('GET', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName:
				TestData.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'GET',
		})
		expect(result?.structuredContent?.endpoint).toBeTruthy()
		expect(result.structuredContent.request).toBeTruthy()
		expect(result.structuredContent.responseBody).toBeTruthy()
		expect(result.structuredContent.request.method).toBe('GET')
		expect(typeof result.structuredContent.status).toBe('number')
	})

	test('POST', async () => {
		const result = await client.callTool('invokeApexRestResource', {
			apexClassOrRestResourceName:
				TestData.salesforce.testApexRestResourceData.apexClassOrRestResourceName,
			operation: 'POST',
			bodyObject: { test: 'data' },
		})
		expect(result?.structuredContent?.endpoint).toBeTruthy()
		expect(result.structuredContent.request.method).toBe('POST')
		expect(result.structuredContent.responseBody).toBeTruthy()
	})
})
