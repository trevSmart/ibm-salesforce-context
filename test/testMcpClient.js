import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {TestMcpClient} from 'microscope-mcp-client';

const SERVER_PATH = resolve(process.cwd(), 'index.js');

/**
 * Start the MCP server process using spawn
 */
async function startMcpServer() {
	return new Promise((resolve, reject) => {
		// Parsejar la especificació del servidor com ho fa el client principal
		let cmd;
		let args;

		if (SERVER_PATH.startsWith('npx:')) {
			const spec = SERVER_PATH.slice('npx:'.length);
			const parts = spec.split(' ');
			const pkgSpec = parts[0];
			const additionalArgs = parts.slice(1);

			// Separar arguments de npx dels arguments del servidor MCP
			const npxArgs = [];
			const serverMCPArgs = [];

			for (const arg of additionalArgs) {
				if (arg === '-y' || arg === '--yes' || arg === '--package' || arg === '-p') {
					npxArgs.push(arg);
				} else {
					serverMCPArgs.push(arg);
				}
			}

			// Si l'usuari no ha especificat -y, l'afegim automàticament
			const finalNpxArgs = npxArgs.includes('-y') ? npxArgs : ['-y', ...npxArgs];

			cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
			args = [...finalNpxArgs, pkgSpec, ...serverMCPArgs];
		} else {
			// Script local - utilitzar Node.js per executar el servidor Salesforce MCP
			cmd = process.execPath;
			args = [SERVER_PATH];
		}

		const child = spawn(cmd, args, {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {...process.env, noUpdateNotifier: '1'}
		});

		// Timeout per evitar que el test s'queda penjat
		const timeout = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error('Server startup timeout'));
		}, 10_000);

		child.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});

		// Esperar una mica perquè el servidor s'inicialitzi
		setTimeout(() => {
			clearTimeout(timeout);
			resolve(child);
		}, 2000);
	});
}

/**
 * Create MCP client and connect to server
 */
export async function createMcpClient() {
	let serverProcess = null;
	let mcpClient = null;

	try {
		// Start the MCP server
		serverProcess = await startMcpServer();

		// Create client instance
		mcpClient = new TestMcpClient();

		// Connect to server using script
		const serverTarget = {
			kind: 'script',
			path: SERVER_PATH,
			interpreter: 'node',
			args: []
		};

		await mcpClient.connect(serverTarget, {quiet: true});
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Store server process reference for cleanup
		mcpClient._serverProcess = serverProcess;

		return mcpClient;
	} catch (error) {
		// Cleanup on error
		if (serverProcess) {
			try {
				serverProcess.kill('SIGTERM');
			} catch (cleanupError) {
				console.warn('Error killing server process:', cleanupError.message);
			}
		}
		throw error;
	}
}

/**
 * Disconnect MCP client and cleanup server process
 */
export async function disconnectMcpClient(client) {
	if (client) {
		try {
			await client.disconnect();
		} catch (error) {
			console.warn('Error disconnecting MCP client:', error.message);
		}

		// Kill server process if it exists
		if (client._serverProcess) {
			try {
				client._serverProcess.kill('SIGTERM');
			} catch (error) {
				console.warn('Error killing server process:', error.message);
			}
		}

		// Give some time for cleanup
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

export async function listTools(client) {
	return await client.getTools();
}
