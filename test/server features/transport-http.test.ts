import fetch from 'node-fetch'
import { afterAll, describe, expect, it } from 'vitest'
import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

interface McpResponse {
	jsonrpc: string
	id?: number
	result?: {
		protocolVersion: string
		serverInfo: {
			name: string
		}
		sessionId?: string
		tools?: Array<{ name: string }>
		resources?: Array<unknown>
		prompts?: Array<{ name: string }>
	}
	error?: {
		message: string
	}
}

// Helper function to parse SSE responses
async function parseSseResponse(response: {
	text(): Promise<string>
}): Promise<McpResponse | null> {
	const responseText = await response.text()

	// First try to parse as regular JSON
	try {
		return JSON.parse(responseText) as McpResponse
	} catch {
		// If that fails, try SSE parsing
		const lines = responseText.split('\n')

		for (const line of lines) {
			if (line.startsWith('data: ')) {
				try {
					return JSON.parse(line.slice(6)) as McpResponse
				} catch {
					// Skip invalid JSON lines
				}
			}
		}
	}
	return null
}

describe('MCP HTTP Connection Test', () => {
	let sessionId: string | null = null
	let client: ReturnType<typeof createMcpClient> extends Promise<infer T> ? T : never = null
	const baseUrl = `http://localhost:${process.env.MCP_HTTP_PORT || '3000'}/mcp`

	afterAll(async () => {
		if (client) {
			await disconnectMcpClient(client)
		}
		if (sessionId) {
			try {
				await fetch(baseUrl, {
					method: 'DELETE',
					headers: {
						'mcp-session-id': sessionId,
					},
				})
			} catch (error) {
				console.warn('Warning: Could not close session:', error)
			}
		}
	})

	it('should initialize MCP session successfully', async () => {
		const initRequest = {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {
					roots: { listChanged: true },
					sampling: {},
				},
				clientInfo: {
					name: 'vitest-test-client',
					version: '1.0.0',
				},
			},
		}

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify(initRequest),
		})

		expect(response.ok).toBeTruthyAndDump(true)

		// Parse SSE response
		const data = await parseSseResponse(response)
		expect(data).toBeDefined()
		expect(data?.jsonrpc).toBe('2.0')
		expect(data?.result).toBeDefined()
		expect(data?.result?.protocolVersion).toBe('2025-06-18')
		expect(data?.result?.serverInfo).toBeDefined()
		expect(data?.result?.serverInfo?.name).toBe('IBM Salesforce Context')

		// Extract session ID from response headers
		sessionId = response.headers.get('mcp-session-id') || response.headers.get('session-id')
		expect(sessionId).toBeDefined()
		expect(typeof sessionId).toBe('string')

		// Create MCP client and verify org details
		client = await createMcpClient()
		expect(client).toBeDefined()

		const result = await client.callTool('salesforceContextUtils', {
			action: 'getOrgAndUserDetails',
		})

		const structuredContent = result?.structuredContent
		expect(structuredContent).toBeTruthy()
		expect(structuredContent.org).toBeTruthy()
		expect(structuredContent.org.id).toBeTruthy()
		expect(structuredContent.user).toBeTruthy()
		expect(structuredContent.user.id).toBeTruthy()
	}, 10000)

	it('should list available tools', async () => {
		expect(sessionId).toBeDefined()

		const toolsRequest = {
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
		}

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
				'mcp-session-id': sessionId || '',
			},
			body: JSON.stringify(toolsRequest),
		})

		expect(response.ok).toBe(true)

		const data = await parseSseResponse(response)
		expect(data).toBeDefined()
		expect(data?.jsonrpc).toBe('2.0')
		expect(data?.result).toBeDefined()
		expect(data?.result?.tools).toBeDefined()
		expect(Array.isArray(data?.result?.tools)).toBe(true)

		// Check for expected tools
		const toolNames = data?.result?.tools?.map((tool: { name: string }) => tool.name) || []
		expect(toolNames).toContain('salesforceContextUtils')
		expect(toolNames).toContain('executeSoqlQuery')
		expect(toolNames).toContain('describeObject')
		expect(toolNames).toContain('getRecord')

		console.log(`✅ Found ${data?.result?.tools?.length || 0} available tools`)
		console.log('Available tools:', toolNames)
	})

	it('should list available resources', async () => {
		expect(sessionId).toBeDefined()

		const resourcesRequest = {
			jsonrpc: '2.0',
			id: 3,
			method: 'resources/list',
		}

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
				'mcp-session-id': sessionId || '',
			},
			body: JSON.stringify(resourcesRequest),
		})

		expect(response.ok).toBe(true)

		const data = await parseSseResponse(response)
		expect(data).toBeDefined()
		expect(data?.jsonrpc).toBe('2.0')
		expect(data?.result).toBeDefined()
		expect(data?.result?.resources).toBeDefined()
		expect(Array.isArray(data?.result?.resources)).toBe(true)

		console.log(`✅ Found ${data?.result?.resources?.length || 0} available resources`)
	})

	it('should list available prompts', async () => {
		expect(sessionId).toBeDefined()

		const promptsRequest = {
			jsonrpc: '2.0',
			id: 4,
			method: 'prompts/list',
		}

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
				'mcp-session-id': sessionId || '',
			},
			body: JSON.stringify(promptsRequest),
		})

		expect(response.ok).toBe(true)

		const data = await parseSseResponse(response)
		expect(data).toBeDefined()
		expect(data?.jsonrpc).toBe('2.0')
		expect(data?.result).toBeDefined()
		expect(data?.result?.prompts).toBeDefined()
		expect(Array.isArray(data?.result?.prompts)).toBe(true)

		// Check for expected prompts
		const promptNames = data?.result?.prompts?.map((prompt: { name: string }) => prompt.name) || []
		expect(promptNames).toContain('apex-run-script')
		expect(promptNames).toContain('tools-basic-run')

		console.log(`✅ Found ${data?.result?.prompts?.length || 0} available prompts`)
		console.log('Available prompts:', promptNames)
	})

	it('should handle invalid session ID gracefully', async () => {
		const toolsRequest = {
			jsonrpc: '2.0',
			id: 5,
			method: 'tools/list',
		}

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
				'mcp-session-id': 'invalid-session-id',
			},
			body: JSON.stringify(toolsRequest),
		})

		expect(response.status).toBe(400)

		// For error responses, try both SSE and JSON parsing
		const responseClone = response.clone()
		let data = await parseSseResponse(response)
		if (!data) {
			// If SSE parsing fails, try JSON parsing
			try {
				const responseText = await responseClone.text()
				data = JSON.parse(responseText) as McpResponse
			} catch (_e) {
				// If both fail, check the response text
				const responseText = await responseClone.text()
				console.log('Error response text:', responseText)
			}
		}

		expect(data).toBeDefined()
		expect(data?.error).toBeDefined()
		expect(data?.error?.message).toContain('No valid session ID')

		console.log('✅ Invalid session ID handled correctly')
	})
})

/* No waitForServer helper needed: setup.ts ensures server is ready */
