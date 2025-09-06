import {describe, test, expect, beforeEach, afterEach} from 'vitest';
import {createServer} from 'node:net';

// Mock console methods to capture warning messages
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Transport Port Fallback', () => {
	let capturedWarnings = [];
	let capturedLogs = [];
	let capturedErrors = [];
	let testServer;

	beforeEach(() => {
		// Clear captured messages
		capturedWarnings = [];
		capturedLogs = [];
		capturedErrors = [];

		// Mock console methods to capture output
		console.warn = (...args) => {
			capturedWarnings.push(args.join(' '));
			originalConsoleWarn(...args);
		};
		console.log = (...args) => {
			capturedLogs.push(args.join(' '));
			originalConsoleLog(...args);
		};
		console.error = (...args) => {
			capturedErrors.push(args.join(' '));
			originalConsoleError(...args);
		};
	});

	afterEach(async () => {
		// Restore original console methods
		console.warn = originalConsoleWarn;
		console.log = originalConsoleLog;
		console.error = originalConsoleError;

		// Clean up test server if it exists
		if (testServer) {
			await new Promise((resolve) => {
				testServer.close(resolve);
			});
			testServer = null;
		}
	});

	test('should find available port when default port is in use', async () => {
		// Start a test server on port 3000 to make it unavailable
		testServer = createServer();
		await new Promise((resolve) => {
			testServer.listen(3000, resolve);
		});

		// Test the port availability functions directly
		const {isPortAvailable, findAvailablePort} = await import('../../../src/lib/transport.js');

		// Test that port 3000 is not available (because our test server is using it)
		const isPort3000Available = await isPortAvailable(3000);
		expect(isPort3000Available).toBe(false);

		// Test that we can find an available port starting from 3000
		const availablePort = await findAvailablePort(3000);
		expect(availablePort).toBeGreaterThan(3000);
		expect(availablePort).toBeLessThanOrEqual(3010); // Should find one within 10 attempts

		// Verify the found port is actually available
		const isFoundPortAvailable = await isPortAvailable(availablePort);
		expect(isFoundPortAvailable).toBe(true);
	}, 10000);

	test('should handle case when no ports are available', async () => {
		// This test would require mocking many ports as unavailable
		// For now, we'll test the error handling logic
		const {findAvailablePort} = await import('../../../src/lib/transport.js');

		// Test with a very high starting port and low max attempts to trigger error
		await expect(findAvailablePort(65000, 1)).rejects.toThrow('No available port found');
	});
});
