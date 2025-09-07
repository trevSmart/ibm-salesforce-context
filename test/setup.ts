import {beforeAll, afterAll, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {setupServer, readyPromise, mcpServer} from '../src/mcp-server.js';
import {stopHttpServer} from '../src/lib/transport.js';

const port = 3000 + Number(process.env.VITEST_WORKER_ID || 0);
process.env.MCP_HTTP_PORT = String(port);

beforeAll(async () => {
        const artifactsDir = path.join(process.cwd(), '.test-artifacts');
        try {
                if (fs.existsSync(artifactsDir)) {
                        fs.rmSync(artifactsDir, {recursive: true, force: true});
                }
        } catch (err) {
                console.error('No s’ha pogut netejar .test-artifacts:', err);
        }

        await setupServer('http');
        await readyPromise;
});

afterAll(async () => {
        await stopHttpServer();
        await mcpServer.close();
});

// Helper per noms de fitxer
function slug(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// Escriu artifact a fitxer
function writeArtifact(testName: string, label: string, data: unknown) {
	const dir = path.join(process.cwd(), '.test-artifacts');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${Date.now()}_${slug(testName)}_${slug(label)}.json`);
	fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
	return file;
}

// Matcher personalitzat: si no és true, bolca `dump` a .test-artifacts
expect.extend({
	toBeTruthyAndDump(received: unknown, dump: unknown) {
		const pass = Boolean(received);
		if (pass) {
			return { pass: true, message: () => 'value was true' };
		}
		// biome-ignore lint/suspicious/noMisplacedAssertion: <és un expect.extend>
		const testName = expect.getState().currentTestName ?? 'unknown-test';
		// Handle undefined dump gracefully
		const dumpData = dump !== undefined ? dump : { received, error: 'dump was undefined' };
		const file = writeArtifact(testName, 'structuredContent', dumpData);
		return {
			pass: false,
			message: () => `expected true, got ${String(received)}. Dump guardat a: ${file}`
		};
	}
});

declare module 'vitest' {
	interface Assertion {
		toBeTrueAndDump(dump: unknown): void;
	}
}
