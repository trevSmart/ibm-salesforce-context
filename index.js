import {createLogger} from './src/lib/logger.js';
import {mcpServer, setupServer} from './src/mcp-server.js';

export async function main(rawTransport) {
	try {
		// Load package.json for dynamic name and version
		const {readFileSync} = await import('node:fs');
		const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

		// Handle special arguments
		if (rawTransport === '--help') {
			console.log('IBM Salesforce MCP Server');
			console.log('');
			console.log('Usage:');
			console.log(`  ${pkg.name} [OPTIONS]`);
			console.log('');
			console.log('Options:');
			console.log('  --stdio     Use stdio transport (default)');
			console.log('  --http      Use HTTP transport');
			console.log('  --help      Show this help message');
			console.log('  --version   Show version information');
			console.log('');
			console.log('Examples:');
			console.log(`  ${pkg.name} --stdio`);
			console.log(`  ${pkg.name} --http`);
			console.log('');
			console.log('Environment Variables:');
			console.log('  LOG_LEVEL              Log level (default: info)');
			console.log('  MCP_HTTP_PORT          HTTP port for --http transport (default: 3000)');
			console.log('  WORKSPACE_FOLDER_PATHS Workspace paths (comma-separated)');
			process.exit(0);
		}

		if (rawTransport === '--version') {
			console.log(`IBM Salesforce MCP Server v${pkg.version}`);
			process.exit(0);
		}

		// Require -- prefix for transport arguments
		if (!(rawTransport && rawTransport.startsWith('--'))) {
			console.error('❌ Error: Transport argument must start with --');
			console.error(`Usage: ${pkg.name} --stdio | --http`);
			console.error(`Run "${pkg.name} --help" for more information`);
			process.exit(1);
		}

		const transport = rawTransport.replace(/^--/, '').toLowerCase();
		if (transport !== 'stdio' && transport !== 'http') {
			console.error('❌ Error: Invalid transport argument');
			console.error('Valid options: --stdio | --http');
			console.error(`Run "${pkg.name} --help" for more information`);
			process.exit(1);
		}
		await setupServer(transport);
	} catch (error) {
		const logger = createLogger();
		logger.error(error, 'Error starting IBM MCP Salesforce server');
		await mcpServer.close();
		process.exit(1);
	}
}

// Pass raw CLI argument; main() handles defaults and normalization
main(process.argv[2]);
