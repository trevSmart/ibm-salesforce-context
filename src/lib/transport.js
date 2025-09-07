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
