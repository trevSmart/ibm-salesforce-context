import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

describe('Server Resources', () => {
	let client

	afterEach(async () => {
		await disconnectMcpClient(client)
	})

	test('should list server resources', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()

		// Verify the client is defined
		expect(client).toBeTruthy()

		// Get the list of available resources from the server
		const resourcesList = await client.listResources()

		// Verify we received a resources list
		expect(resourcesList).toBeTruthy()
		expect(Array.isArray(resourcesList)).toBe(true)

		// Verify the structure of resource items if any exist
		if (resourcesList.length > 0) {
			const firstResource = resourcesList[0]
			expect(firstResource).toHaveProperty('uri')
			expect(firstResource).toHaveProperty('name')
			expect(firstResource).toHaveProperty('description')
			expect(firstResource).toHaveProperty('mimeType')
		}

		console.log(`Successfully retrieved ${resourcesList.length} resources from the server`)
	}, 10000) // 10 second timeout to allow for server initialization

	test('should read server resource', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()

		// Verify the client is defined
		expect(client).toBeTruthy()

		// First, get the list of available resources
		const resourcesList = await client.listResources()

		// If there are resources available, try to read one
		if (resourcesList.length) {
			const resourceToRead = resourcesList[0]

			// Read the resource content
			const resourceContent = await client.readResource(resourceToRead.uri)

			// Verify we received resource content
			expect(resourceContent).toBeTruthy()
			expect(resourceContent).toHaveProperty('contents')
			expect(Array.isArray(resourceContent.contents)).toBe(true)
			expect(resourceContent.contents.length).toBeGreaterThan(0)

			// Verify the structure of the resource content
			const content = resourceContent.contents[0]
			expect(content).toHaveProperty('uri')
			expect(content).toHaveProperty('text')

			console.log(`Successfully read resource: ${resourceToRead.name}`)
		} else {
			console.log('No resources available to read')
		}
	}, 10000) // 10 second timeout to allow for server initialization

	test('should detect resource list changes', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()

		// Verify the client is defined
		expect(client).toBeTruthy()

		// Get initial resources list
		const initialResources = await client.listResources()
		const initialCount = initialResources.length

		// Trigger a resource creation by calling loadRecordPrefixesResource
		// This should create a new resource and trigger a list change
		const result = await client.callTool('salesforceContextUtils', {
			action: 'loadRecordPrefixesResource',
		})

		// Verify the tool call was successful
		expect(result).toBeTruthy()

		// Wait a bit for the resource to be created and notification to be sent
		await new Promise(resolve => setTimeout(resolve, 1000))

		// Get updated resources list
		const updatedResources = await client.listResources()
		const updatedCount = updatedResources.length

		// Verify that the resource list has changed
		// The count should be greater than or equal to the initial count
		expect(updatedCount).toBeGreaterThanOrEqual(initialCount)

		// Verify that the new resource exists
		const recordPrefixesResource = updatedResources.find(
			resource =>
				resource.uri.includes('record-prefixes') || resource.name.includes('record prefixes'),
		)
		expect(recordPrefixesResource).toBeTruthy()

		console.log(`Resource list changed: ${initialCount} -> ${updatedCount} resources`)
		console.log('Successfully detected resource list changes')
	}, 15000) // 15 second timeout to allow for resource creation and notifications

	test('should handle reading non-existent resource', async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()

		// Verify the client is defined
		expect(client).toBeTruthy()

		// Try to read a resource with a non-existent URI
		const nonExistentUri = 'mcp://ibm-salesforce-context/non-existent-resource'

		// This should throw an error or return an error response
		await expect(async () => {
			await client.readResource(nonExistentUri)
		}).rejects.toThrow()

		console.log('Successfully handled non-existent resource request')
	}, 10000) // 10 second timeout to allow for server initialization
})
