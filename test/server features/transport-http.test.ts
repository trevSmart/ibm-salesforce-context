import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import fetch from 'node-fetch';

interface McpResponse {
	jsonrpc: string;
	id?: number;
	result?: {
		protocolVersion: string;
		serverInfo: {
			name: string;
		};
		sessionId?: string;
		tools?: Array<{ name: string }>;
		resources?: Array<unknown>;
		prompts?: Array<{ name: string }>;
	};
	error?: {
		message: string;
	};
}

describe('MCP HTTP Connection Test', () => {
	let serverProcess: ChildProcess | null = null;
	let sessionId: string | null = null;
	const baseUrl = 'http://localhost:3000/mcp';

	beforeAll(async () => {
		// Start MCP server in HTTP mode
		console.log('🚀 Starting MCP server in HTTP mode...');
		serverProcess = spawn('npm', ['start'], {
			stdio: 'pipe',
			cwd: process.cwd()
		});

		// Wait for server to be ready
		await waitForServer(baseUrl, 30000);
		console.log('✅ MCP server started successfully');
	}, 35000);

	afterAll(async () => {
		// Close session if exists
		if (sessionId) {
			try {
				await fetch(baseUrl, {
					method: 'DELETE',
					headers: {
						'mcp-session-id': sessionId
					}
				});
				console.log('🔌 Session closed');
			} catch (error) {
				console.warn('Warning: Could not close session:', error);
			}
		}

		// Kill server process
		if (serverProcess) {
			serverProcess.kill();
			console.log('🛑 MCP server stopped');
		}
	});

	it('should initialize MCP session successfully', async () => {
		const initRequest = {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {
					roots: { listChanged: true },
					sampling: {}
				},
				clientInfo: {
					name: 'vitest-test-client',
					version: '1.0.0'
				}
			}
		};

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json, text/event-stream'
			},
			body: JSON.stringify(initRequest)
		});

		expect(response.ok).toBe(true);

		const data = await response.json() as McpResponse;
		expect(data.jsonrpc).toBe('2.0');
		expect(data.result).toBeDefined();
		expect(data.result.protocolVersion).toBe('2025-06-18');
		expect(data.result.serverInfo).toBeDefined();
		expect(data.result.serverInfo.name).toBe('IBM Salesforce MCP Server');

		// Extract session ID for subsequent requests
		sessionId = data.result.sessionId;
		expect(sessionId).toBeDefined();
		expect(typeof sessionId).toBe('string');

		console.log(`✅ Session initialized with ID: ${sessionId}`);
	}, 10000);

	it('should list available tools', async () => {
		expect(sessionId).toBeDefined();

		const toolsRequest = {
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list'
		};

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json, text/event-stream',
				'mcp-session-id': sessionId || ''
			},
			body: JSON.stringify(toolsRequest)
		});

		expect(response.ok).toBe(true);

		const data = await response.json() as McpResponse;
		expect(data.jsonrpc).toBe('2.0');
		expect(data.result).toBeDefined();
		expect(data.result.tools).toBeDefined();
		expect(Array.isArray(data.result.tools)).toBe(true);

		// Check for expected tools
		const toolNames = data.result.tools.map((tool: { name: string }) => tool.name);
		expect(toolNames).toContain('salesforceMcpUtils');
		expect(toolNames).toContain('executeSoqlQuery');
		expect(toolNames).toContain('describeObject');
		expect(toolNames).toContain('getRecord');

		console.log(`✅ Found ${data.result.tools.length} available tools`);
		console.log('Available tools:', toolNames);
	});

	it('should list available resources', async () => {
		expect(sessionId).toBeDefined();

		const resourcesRequest = {
			jsonrpc: '2.0',
			id: 3,
			method: 'resources/list'
		};

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json, text/event-stream',
				'mcp-session-id': sessionId || ''
			},
			body: JSON.stringify(resourcesRequest)
		});

		expect(response.ok).toBe(true);

		const data = await response.json() as McpResponse;
		expect(data.jsonrpc).toBe('2.0');
		expect(data.result).toBeDefined();
		expect(data.result.resources).toBeDefined();
		expect(Array.isArray(data.result.resources)).toBe(true);

		console.log(`✅ Found ${data.result.resources.length} available resources`);
	});

	it('should list available prompts', async () => {
		expect(sessionId).toBeDefined();

		const promptsRequest = {
			jsonrpc: '2.0',
			id: 4,
			method: 'prompts/list'
		};

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json, text/event-stream',
				'mcp-session-id': sessionId || ''
			},
			body: JSON.stringify(promptsRequest)
		});

		expect(response.ok).toBe(true);

		const data = await response.json() as McpResponse;
		expect(data.jsonrpc).toBe('2.0');
		expect(data.result).toBeDefined();
		expect(data.result.prompts).toBeDefined();
		expect(Array.isArray(data.result.prompts)).toBe(true);

		// Check for expected prompts
		const promptNames = data.result.prompts.map((prompt: { name: string }) => prompt.name);
		expect(promptNames).toContain('apex-run-script');
		expect(promptNames).toContain('tools-basic-run');

		console.log(`✅ Found ${data.result.prompts.length} available prompts`);
		console.log('Available prompts:', promptNames);
	});

	it('should handle invalid session ID gracefully', async () => {
		const toolsRequest = {
			jsonrpc: '2.0',
			id: 5,
			method: 'tools/list'
		};

		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json, text/event-stream',
				'mcp-session-id': 'invalid-session-id'
			},
			body: JSON.stringify(toolsRequest)
		});

		expect(response.status).toBe(400);

		const data = await response.json() as McpResponse;
		expect(data.error).toBeDefined();
		expect(data.error.message).toContain('No valid session ID');

		console.log('✅ Invalid session ID handled correctly');
	});
});

/**
 * Wait for server to be ready by polling the endpoint
 */
async function waitForServer(url: string, timeoutMs: number = 30000): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'accept': 'application/json, text/event-stream'
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 0,
					method: 'initialize',
					params: {
						protocolVersion: '2025-06-18',
						capabilities: {},
						clientInfo: { name: 'health-check', version: '1.0.0' }
					}
				})
			});

			if (response.ok) {
				return;
			}
		} catch (_error) {
			// Server not ready yet, continue waiting
		}

		await new Promise(resolve => setTimeout(resolve, 1000));
	}

	throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}
