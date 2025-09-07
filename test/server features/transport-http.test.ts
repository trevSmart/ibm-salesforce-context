import {describe, it, expect, afterAll} from 'vitest';
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
        let sessionId: string | null = null;
        const baseUrl = `http://localhost:${process.env.MCP_HTTP_PORT || '3000'}/mcp`;

        afterAll(async () => {
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
		expect(data.result.serverInfo.name).toBe('IBM Salesforce Context');

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
		expect(toolNames).toContain('salesforceContextUtils');
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

/* No waitForServer helper needed: setup.ts ensures server is ready */
