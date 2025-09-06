import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

function parseCliArgs(args) {
	const config = {
		transport: null,
		logLevel: null,
		httpPort: null,
		workspacePaths: null
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === '--help' || arg === '--version') {
			config.transport = arg;
			break;
		}

		if (arg === '--transport' && i + 1 < args.length) {
			const transportValue = args[i + 1];
			if (transportValue === 'stdio' || transportValue === 'http') {
				config.transport = `--${transportValue}`;
			} else {
				throw new Error(`Invalid transport value: ${transportValue}. Must be 'stdio' or 'http'`);
			}
			i++; // Skip next argument as it's the value
		} else if (arg === '--log-level' && i + 1 < args.length) {
			config.logLevel = args[i + 1];
			i++; // Skip next argument as it's the value
		} else if (arg === '--port' && i + 1 < args.length) {
			config.httpPort = Number.parseInt(args[i + 1], 10);
			i++; // Skip next argument as it's the value
		} else if (arg === '--workspace' && i + 1 < args.length) {
			config.workspacePaths = args[i + 1];
			i++; // Skip next argument as it's the value
		} else if (arg.startsWith('--')) {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return config;
}

export async function main(rawArgs) {
	try {
		// Load package.json for dynamic name and version
		const {readFileSync} = await import('node:fs');
		const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

		// Parse CLI arguments
		const config = parseCliArgs(rawArgs);

		// Handle special arguments
		if (config.transport === '--help') {
			console.log('IBM Salesforce MCP Server');
			console.log('');
			console.log('Usage:');
			console.log(`  ${pkg.name} [OPTIONS]`);
			console.log('');
			console.log('Options:');
			console.log('  --transport TYPE     Transport type: stdio or http (overrides MCP_TRANSPORT)');
			console.log('  --log-level LEVEL    Set log level (overrides LOG_LEVEL)');
			console.log('  --port PORT         Set HTTP port for http transport (overrides MCP_HTTP_PORT)');
			console.log('  --workspace PATHS   Set workspace paths (overrides WORKSPACE_FOLDER_PATHS)');
			console.log('  --help              Show this help message');
			console.log('  --version           Show version information');
			console.log('');
			console.log('Examples:');
			console.log(`  ${pkg.name} --transport stdio`);
			console.log(`  ${pkg.name} --transport http --port 8080`);
			console.log(`  ${pkg.name} --transport stdio --log-level debug`);
			console.log(`  ${pkg.name} --transport http --workspace /path/to/project`);
			console.log('');
			console.log('Environment Variables (overridden by CLI arguments):');
			console.log('  MCP_TRANSPORT           Transport type: stdio or http (default: stdio)');
			console.log('  LOG_LEVEL              Log level (default: info)');
			console.log('  MCP_HTTP_PORT          HTTP port for http transport (default: 3000)');
			console.log('  WORKSPACE_FOLDER_PATHS Workspace paths (comma-separated)');
			process.exit(0);
		}

		if (config.transport === '--version') {
			console.log(`IBM Salesforce MCP Server v${pkg.version}`);
			process.exit(0);
		}

		// Determine transport with priority: CLI > Environment > Default
		let transport;
		if (config.transport) {
			// CLI argument has highest priority
			transport = config.transport.replace(/^--/, '').toLowerCase();
		} else if (process.env.MCP_TRANSPORT) {
			// Environment variable has medium priority
			transport = process.env.MCP_TRANSPORT.toLowerCase();
		} else {
			// Default to stdio
			transport = 'stdio';
		}

		// Validate transport value
		if (transport !== 'stdio' && transport !== 'http') {
			console.error('❌ Error: Invalid transport value');
			console.error(`Valid options: stdio | http`);
			console.error(`Received: ${transport}`);
			console.error(`Run "${pkg.name} --help" for more information`);
			process.exit(1);
		}

		// Apply CLI arguments with priority over environment variables
		if (config.logLevel) {
			process.env.LOG_LEVEL = config.logLevel;
		}
		if (config.httpPort) {
			process.env.MCP_HTTP_PORT = config.httpPort.toString();
		}
		if (config.workspacePaths) {
			process.env.WORKSPACE_FOLDER_PATHS = config.workspacePaths;
		}

		await setupServer(transport);
	} catch (error) {
		const logger = createLogger();
		logger.error(error, 'Error starting IBM MCP Salesforce server');
		await mcpServer.close();
		process.exit(1);
	}
}

// Pass all CLI arguments; main() handles parsing and normalization
main(process.argv.slice(2));
