// Dynamic imports are used here to avoid loading transport-specific modules
// unless they're needed. This keeps stdio sessions lightweight by skipping
// Express/crypto and avoids pulling in the stdio transport when running over
// HTTP.

/**
 * Finds the next available port starting from the given port
 * @param {number} startPort - Port to start checking from
 * @param {number} maxAttempts - Maximum number of ports to check
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(startPort, maxAttempts = 10) {
	const {createServer} = await import('node:net');

	for (let i = 0; i < maxAttempts; i++) {
		const port = startPort + i;
		try {
			await new Promise((resolve, reject) => {
				const server = createServer();
				server.listen(port, () => {
					server.close(() => resolve(port));
				});
				server.on('error', (err) => {
					if (err.code === 'EADDRINUSE') {
						reject(new Error(`Port ${port} is in use`));
					} else {
						reject(err);
					}
				});
			});
			return port;
		} catch {
			if (i === maxAttempts - 1) {
				throw new Error(`No available ports found starting from ${startPort}. Tried ${maxAttempts} ports.`);
			}
		}
	}
}

let httpServer;

/**
 * Connects the provided MCP server to the requested transport.
 * Handlers should be registered on the server before this function is called.
 *
 * @param {McpServer} mcpServer - The MCP server instance to connect
 * @param {'stdio'|'http'} transportType - Type of transport to connect
 */
export async function connectTransport(mcpServer, transportType) {
	switch (transportType) {
		case 'stdio': {
			const {StdioServerTransport} = await import('@modelcontextprotocol/sdk/server/stdio.js');
			await mcpServer.connect(new StdioServerTransport()).then(() => new Promise((r) => setTimeout(r, 400)));
			return;
		}
		case 'http': {
			const express = (await import('express')).default;
			const {randomUUID} = await import('node:crypto');
			const {StreamableHTTPServerTransport} = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
			const {isInitializeRequest} = await import('@modelcontextprotocol/sdk/types.js');

			const app = express();
			app.use(express.json());

			const transports = {};

			app.post('/mcp', async (req, res) => {
				const sessionId = req.headers['mcp-session-id'];
				let transport;

				if (sessionId && transports[sessionId]) {
					transport = transports[sessionId];
				} else if (!sessionId && isInitializeRequest(req.body)) {
					transport = new StreamableHTTPServerTransport({
						sessionIdGenerator: () => randomUUID(),
						onsessioninitialized: (sid) => {
							transports[sid] = transport;
						}
					});

					transport.onclose = () => {
						if (transport.sessionId) {
							delete transports[transport.sessionId];
						}
					};

					await mcpServer.connect(transport);
				} else {
					res.status(400).json({
						jsonrpc: '2.0',
						error: {
							code: -32000,
							message: 'Bad Request: No valid session ID provided'
						},
						id: null
					});
					return;
				}

				await transport.handleRequest(req, res, req.body);
			});

			const handleSessionRequest = async (req, res) => {
				const sessionId = req.headers['mcp-session-id'];
				if (!(sessionId && transports[sessionId])) {
					res.status(400).send('Invalid or missing session ID');
					return;
				}

				const transport = transports[sessionId];
				await transport.handleRequest(req, res);
			};

			app.get('/mcp', handleSessionRequest);
			app.delete('/mcp', handleSessionRequest);

			// Root endpoint - serve status page as default
			app.get('/', async (_req, res) => {
				try {
					const {exec} = await import('node:child_process');
					const {promisify} = await import('node:util');
					const execAsync = promisify(exec);

					// Get Salesforce CLI version
					let sfVersion = 'Not available';
					try {
						const {stdout} = await execAsync('sf version --json');
						const sfInfo = JSON.parse(stdout);
						sfVersion = sfInfo.sfdx || sfInfo.sf || 'Unknown';
					} catch {
						// SF CLI not available or error
					}

					// Get current org info from server state
					const orgInfo = mcpServer.state?.org;

					// Get server capabilities
					const capabilities = mcpServer.getCapabilities ? mcpServer.getCapabilities() : {};

					// Get available tools and resources
					let toolsInfo = [];
					let resourcesInfo = [];
					try {
						// Get tools list
						const toolsResponse = await mcpServer.server.request(
							{
								method: 'tools/list',
								params: {}
							},
							{}
						);
						toolsInfo = toolsResponse.tools || [];

						// Get resources list
						const resourcesResponse = await mcpServer.server.request(
							{
								method: 'resources/list',
								params: {}
							},
							{}
						);
						resourcesInfo = resourcesResponse.resources || [];
					} catch (error) {
						// If we can't get tools/resources info, continue without it
						console.warn('Could not retrieve tools/resources info:', error.message);
					}

					const statusInfo = {
						server: {
							name: 'IBM Salesforce Context server',
							version: process.env.npm_package_version || 'unknown',
							status: 'running',
							uptime: process.uptime(),
							timestamp: new Date().toISOString(),
							transport: 'HTTP',
							port: process.env.MCP_HTTP_PORT || 3000
						},
						sessions: {
							active: Object.keys(transports).length,
							total: Object.keys(transports).length
						},
						salesforce: {
							cliVersion: sfVersion,
							orgConnected: Boolean(orgInfo?.username),
							orgInfo: orgInfo?.username
								? {
										username: orgInfo.username,
										orgId: orgInfo.id,
										instanceUrl: orgInfo.instanceUrl,
										alias: orgInfo.alias,
										apiVersion: orgInfo.apiVersion,
										userName: orgInfo.user?.name,
										profileName: orgInfo.user?.profileName
									}
								: null
						},
						mcp: {
							capabilities: capabilities,
							tools: {
								count: toolsInfo.length,
								available: toolsInfo.map((tool) => ({
									name: tool.name,
									description: tool.description
								}))
							},
							resources: {
								count: resourcesInfo.length,
								available: resourcesInfo.map((resource) => ({
									uri: resource.uri,
									name: resource.name,
									description: resource.description
								}))
							}
						},
						environment: {
							nodeVersion: process.version,
							platform: process.platform,
							arch: process.arch
						}
					};

					// Serve HTML page with status information
					const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IBM Salesforce Context server Status</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #0066cc, #004499);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .status-card {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            border-left: 4px solid #0066cc;
        }
        .status-card h3 {
            margin: 0 0 15px 0;
            color: #0066cc;
            font-size: 1.2em;
        }
        .status-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .status-item:last-child {
            border-bottom: none;
        }
        .status-label {
            font-weight: 500;
            color: #666;
        }
        .status-value {
            color: #333;
            font-family: monospace;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 500;
            text-transform: uppercase;
        }
        .status-running {
            background: #d4edda;
            color: #155724;
        }
        .status-connected {
            background: #d1ecf1;
            color: #0c5460;
        }
        .status-disconnected {
            background: #f8d7da;
            color: #721c24;
        }
        .tools-list, .resources-list {
            max-height: 200px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .tool-item, .resource-item {
            background: white;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 4px;
            border: 1px solid #e9ecef;
        }
        .tool-name, .resource-name {
            font-weight: 500;
            color: #0066cc;
        }
        .tool-desc, .resource-desc {
            font-size: 0.9em;
            color: #666;
            margin-top: 2px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
        }
        .endpoints {
            margin-top: 20px;
        }
        .endpoint-link {
            display: inline-block;
            margin: 5px 10px;
            padding: 8px 16px;
            background: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .endpoint-link:hover {
            background: #004499;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>IBM Salesforce Context server</h1>
            <p>Model Context Protocol Server Status Dashboard</p>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>Server Status</h3>
                <div class="status-item">
                    <span class="status-label">Status</span>
                    <span class="status-value">
                        <span class="status-badge status-running">${statusInfo.server.status}</span>
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label">Version</span>
                    <span class="status-value">${statusInfo.server.version}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Uptime</span>
                    <span class="status-value">${Math.floor(statusInfo.server.uptime / 3600)}h ${Math.floor((statusInfo.server.uptime % 3600) / 60)}m</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Transport</span>
                    <span class="status-value">${statusInfo.server.transport}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Port</span>
                    <span class="status-value">${statusInfo.server.port}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Active Sessions</span>
                    <span class="status-value">${statusInfo.sessions.active}</span>
                </div>
            </div>

            <div class="status-card">
                <h3>Salesforce Connection</h3>
                <div class="status-item">
                    <span class="status-label">CLI Version</span>
                    <span class="status-value">${statusInfo.salesforce.cliVersion}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Org Connected</span>
                    <span class="status-value">
                        <span class="status-badge ${statusInfo.salesforce.orgConnected ? 'status-connected' : 'status-disconnected'}">
                            ${statusInfo.salesforce.orgConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </span>
                </div>
                ${
					statusInfo.salesforce.orgInfo
						? `
                <div class="status-item">
                    <span class="status-label">Username</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.username}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">User Name</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.userName || 'N/A'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Profile</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.profileName || 'N/A'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Org ID</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.orgId}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Alias</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.alias || 'N/A'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Instance URL</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.instanceUrl}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">API Version</span>
                    <span class="status-value">${statusInfo.salesforce.orgInfo.apiVersion || 'N/A'}</span>
                </div>
                `
						: ''
				}
            </div>

            <div class="status-card">
                <h3>MCP Tools</h3>
                <div class="status-item">
                    <span class="status-label">Available Tools</span>
                    <span class="status-value">${statusInfo.mcp.tools.count}</span>
                </div>
                <div class="tools-list">
                    ${statusInfo.mcp.tools.available
						.map(
							(tool) => `
                        <div class="tool-item">
                            <div class="tool-name">${tool.name}</div>
                            <div class="tool-desc">${tool.description}</div>
                        </div>
                    `
						)
						.join('')}
                </div>
            </div>

            <div class="status-card">
                <h3>MCP Resources</h3>
                <div class="status-item">
                    <span class="status-label">Available Resources</span>
                    <span class="status-value">${statusInfo.mcp.resources.count}</span>
                </div>
                <div class="resources-list">
                    ${statusInfo.mcp.resources.available
						.map(
							(resource) => `
                        <div class="resource-item">
                            <div class="resource-name">${resource.name}</div>
                            <div class="resource-desc">${resource.description}</div>
                        </div>
                    `
						)
						.join('')}
                </div>
            </div>

            <div class="status-card">
                <h3>Environment</h3>
                <div class="status-item">
                    <span class="status-label">Node.js Version</span>
                    <span class="status-value">${statusInfo.environment.nodeVersion}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Platform</span>
                    <span class="status-value">${statusInfo.environment.platform}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Architecture</span>
                    <span class="status-value">${statusInfo.environment.arch}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Updated</span>
                    <span class="status-value">${new Date(statusInfo.server.timestamp).toLocaleString()}</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="endpoints">
                <a href="/status" class="endpoint-link">JSON Status</a>
                <a href="/healthz" class="endpoint-link">Health Check</a>
            </div>
            <p>IBM Salesforce Context - a Model Context Protocol implementation</p>
        </div>
    </div>
</body>
</html>`;

					res.status(200).set('Content-Type', 'text/html').send(html);
				} catch (error) {
					res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
    <title>IBM Salesforce Context server - Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .error { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #d32f2f; }
    </style>
</head>
<body>
    <div class="error">
        <h1>Server Error</h1>
        <p>Failed to load status information: ${error.message}</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
    </div>
</body>
</html>`);
				}
			});

			// Health check endpoint
			app.get('/healthz', async (_req, res) => {
				try {
					// Basic health check - server is running and can handle requests
					const healthStatus = {
						status: 'healthy',
						timestamp: new Date().toISOString(),
						activeSessions: Object.keys(transports).length,
						serverType: 'MCP HTTP Server',
						version: process.env.npm_package_version || 'unknown'
					};

					res.status(200).json(healthStatus);
				} catch (error) {
					res.status(503).json({
						status: 'unhealthy',
						timestamp: new Date().toISOString(),
						error: error.message
					});
				}
			});

			// Detailed status page endpoint
			app.get('/status', async (_req, res) => {
				try {
					const {exec} = await import('node:child_process');
					const {promisify} = await import('node:util');
					const execAsync = promisify(exec);

					// Get Salesforce CLI version
					let sfVersion = 'Not available';
					try {
						const {stdout} = await execAsync('sf version --json');
						const sfInfo = JSON.parse(stdout);
						sfVersion = sfInfo.sfdx || sfInfo.sf || 'Unknown';
					} catch {
						// SF CLI not available or error
					}

					// Get current org info from server state
					const orgInfo = mcpServer.state?.org;

					// Get server capabilities
					const capabilities = mcpServer.getCapabilities ? mcpServer.getCapabilities() : {};

					// Get available tools and resources
					let toolsInfo = [];
					let resourcesInfo = [];
					try {
						// Get tools list
						const toolsResponse = await mcpServer.server.request(
							{
								method: 'tools/list',
								params: {}
							},
							{}
						);
						toolsInfo = toolsResponse.tools || [];

						// Get resources list
						const resourcesResponse = await mcpServer.server.request(
							{
								method: 'resources/list',
								params: {}
							},
							{}
						);
						resourcesInfo = resourcesResponse.resources || [];
					} catch (error) {
						// If we can't get tools/resources info, continue without it
						console.warn('Could not retrieve tools/resources info:', error.message);
					}

					const statusInfo = {
						server: {
							name: 'IBM Salesforce Context server',
							version: process.env.npm_package_version || 'unknown',
							status: 'running',
							uptime: process.uptime(),
							timestamp: new Date().toISOString(),
							transport: 'HTTP',
							port: process.env.MCP_HTTP_PORT || 3000
						},
						sessions: {
							active: Object.keys(transports).length,
							total: Object.keys(transports).length
						},
						salesforce: {
							cliVersion: sfVersion,
							orgConnected: Boolean(orgInfo?.username),
							orgInfo: orgInfo?.username
								? {
										username: orgInfo.username,
										orgId: orgInfo.id,
										instanceUrl: orgInfo.instanceUrl,
										alias: orgInfo.alias,
										apiVersion: orgInfo.apiVersion,
										userName: orgInfo.user?.name,
										profileName: orgInfo.user?.profileName
									}
								: null
						},
						mcp: {
							capabilities: capabilities,
							tools: {
								count: toolsInfo.length,
								available: toolsInfo.map((tool) => ({
									name: tool.name,
									description: tool.description
								}))
							},
							resources: {
								count: resourcesInfo.length,
								available: resourcesInfo.map((resource) => ({
									uri: resource.uri,
									name: resource.name,
									description: resource.description
								}))
							}
						},
						environment: {
							nodeVersion: process.version,
							platform: process.platform,
							arch: process.arch
						}
					};

					res.status(200).json(statusInfo);
				} catch (error) {
					res.status(500).json({
						error: 'Failed to get status information',
						message: error.message,
						timestamp: new Date().toISOString()
					});
				}
			});

			const requestedPort = Number.parseInt(process.env.MCP_HTTP_PORT, 10) || 3000;
			try {
				const port = await findAvailablePort(requestedPort);
				if (port !== requestedPort) {
					console.log(`⚠️  Port ${requestedPort} is occupied. Using port ${port} instead.`);
				}
				httpServer = app.listen(port, () => {
					console.log(`🚀 MCP HTTP server running on port ${port}`);
				});
			} catch (error) {
				throw new Error(`Failed to start HTTP server: ${error.message}`);
			}
			return;
		}
		default:
			throw new Error(`Unsupported transport type: ${transportType}`);
	}
}

export default connectTransport;

export async function stopHttpServer() {
	return new Promise((resolve) => {
		if (httpServer) {
			httpServer.close(() => {
				httpServer = undefined;
				resolve();
			});
		} else {
			resolve();
		}
	});
}
