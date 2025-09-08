import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('salesforceContextUtils', () => {
	let client

	beforeAll(async () => {
		client = await createMcpClient()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)
	})

	test('getOrgAndUserDetails', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'getOrgAndUserDetails',
		})
		expect(result?.structuredContent?.user?.id).toBeTruthyAndDump(result?.structuredContent)
	})

	test('getState', async () => {
		const result = await client.callTool('salesforceContextUtils', { action: 'getState' })

		// ÚS DEL MATCHER PERSONALITZAT
		// Si no és true, escriu structuredContent a .test-artifacts/
		expect(result?.structuredContent?.state?.org?.user?.id).toBeTruthyAndDump(
			result?.structuredContent,
		)
	})

	test('loadRecordPrefixesResource', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'loadRecordPrefixesResource',
		})
		const content = result?.content
		expect(Array.isArray(content)).toBe(true)

		// expect(content.some(item => item.type === 'resource_link' && item.uri)).toBeTruthy(content); // TODO: REACTIVAR

		const structuredContent = result?.structuredContent
		expect(structuredContent).toBeTruthy()
		expect(typeof structuredContent).toBe('object')
		expect(Array.isArray(structuredContent)).toBe(false)
		expect(Object.keys(structuredContent).length).toBeGreaterThan(0)
	}, 15000)

	test('getCurrentDatetime', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'getCurrentDatetime',
		})
		expect(result?.structuredContent?.now).toBeTruthy()
		expect(result?.structuredContent?.timezone).toBeTruthy()
	})

	test('clearCache', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'clearCache',
		})
		expect(result?.structuredContent?.status).toBe('success')
		expect(result?.structuredContent?.action).toBe('clearCache')
	})

	test('reportIssue with valid detailed description', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'reportIssue',
			issueDescription: 'When executing SOQL query "SELECT Id FROM Account LIMIT 1" using executeSoqlQuery tool, getting error "INVALID_FIELD: No such column \'Id\' on entity \'Account\'" despite Id being a standard field. This occurs consistently in the current org environment.',
			issueToolName: 'executeSoqlQuery',
		})
		console.log('Valid test result:', JSON.stringify(result, null, 2))
		expect(result?.structuredContent?.success).toBe(true)
		expect(result.structuredContent.issueId).toBeTruthy()
	})

	test('reportIssue with insufficient details should fail', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'reportIssue',
			issueDescription: 'There is a problem with the tool and it is not working properly for me',
			issueToolName: 'testTool',
		})
		console.log('Invalid test result:', JSON.stringify(result, null, 2))
		expect(result.isError).toBe(true)
		expect(result.content[0].text).toMatch(/too generic|lacks sufficient technical details/)
	})

	test('reportIssue with generic description should fail', async () => {
		const result = await client.callTool('salesforceContextUtils', {
			action: 'reportIssue',
			issueDescription: 'I need help with this tool because it is not working for me',
			issueToolName: 'testTool',
		})
		console.log('Generic test result:', JSON.stringify(result, null, 2))
		expect(result.isError).toBe(true)
		expect(result.content[0].text).toMatch(/too generic|lacks sufficient technical details/)
	})
})
