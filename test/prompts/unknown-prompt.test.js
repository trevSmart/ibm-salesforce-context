import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('unknown-prompt', () => {
	let client

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)
	})

	test('prompt does not exist', async () => {
		await expect(
			client.getPrompt('non-existent-prompt', {
				argValue: 'argValue',
			}),
		).rejects.toThrow()
	})
})
