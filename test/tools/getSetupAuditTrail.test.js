import fs from 'node:fs'
import path from 'node:path'
import { TestData } from '../test-data.js'
import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('getSetupAuditTrail', () => {
	let client

	function deleteAuditTrailFile() {
		// Delete tmp/SetupAuditTrail.csv if it exists
		const tmpFilePath = path.join('tmp', 'SetupAuditTrail.csv')
		try {
			fs.unlinkSync(tmpFilePath)
		} catch {
			// File doesn't exist or other error, continue
		}
	}

	beforeAll(async () => {
		client = await createMcpClient()
		deleteAuditTrailFile()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)
		deleteAuditTrailFile()
	})

	test.skipIf(process.env.SKIP_OPTIONAL_TESTS === 'true')(
		'basic',
		async () => {
			// Verificar que el client està definit
			expect(client).toBeTruthy()

			const result = await client.callTool('getSetupAuditTrail', { lastDays: 7 })

			expect(result).toBeTruthy()
			expect(result?.structuredContent?.filters).toBeTruthy()
			expect(typeof result.structuredContent.setupAuditTrailFileTotalRecords).toBe('number')
			expect(Array.isArray(result.structuredContent.records)).toBe(true)
		},
		60_000,
	)

	test('cached with user filter', async () => {
		const result = await client.callTool('getSetupAuditTrail', {
			lastDays: 14,
			user: TestData.salesforce.testUser,
		})

		expect(result).toBeTruthy()
		expect(result?.structuredContent?.filters).toBeTruthy()
		expect(result.structuredContent.filters.user).toBe(TestData.salesforce.testUser)
	}, 2_000)
})
