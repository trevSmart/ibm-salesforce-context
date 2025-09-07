#!/usr/bin/env -S npx tsx

import {spawn} from 'child_process';
import {setTimeout as sleep} from 'timers/promises';

interface ServerOutput {
	port?: number;
	ready: boolean;
}

class MCPTester {
	private serverProcess: any;
	private serverOutput: string = '';
	private port: number | null = null;
	private sessionId: string | null = null;

	constructor(private projectPath: string) {}

	private getTimestamp(): string {
		const now = new Date();
		return now.toTimeString().split(' ')[0]; // HH:MM:SS format
	}

	private log(message: string): void {
		console.log(`\n[${this.getTimestamp()}] ${message}`);
	}

	async startServer(): Promise<ServerOutput> {
		this.log('🚀 Arrencant el servidor MCP en mode HTTP en procés fill...');

		return new Promise((resolve, reject) => {
			// Canvia al directori del projecte
			process.chdir(this.projectPath);

			// Arrenca el servidor en background (procés fill)
			this.serverProcess = spawn('npm', ['run', 'start'], {
				stdio: ['ignore', 'pipe', 'pipe'], // Ignora stdin completament
				env: {...process.env, MCP_TRANSPORT: 'http'},
				detached: false, // No detach per poder controlar-lo
				cwd: this.projectPath // Assegura que està al directori correcte
			});

			let outputBuffer = '';
			let portFound = false;
			let serverReady = false;

			const checkOutput = (data: Buffer) => {
				const output = data.toString();
				this.log(`📝 Server output: ${output.trim()}\n`);
				outputBuffer += output;

				// Busca el port al output
				const portMatch = output.match(/HTTP server running on port (\d+)/);
				if (portMatch && !portFound) {
					this.port = Number.parseInt(portMatch[1], 10);
					portFound = true;
					this.log(`✅ Servidor arrencat al port ${this.port}`);
				}

				// Comprova si el servidor està llest
				if ((output.includes('Connected to HTTP transport') || output.includes('MCP HTTP server running on port')) && portFound && !serverReady) {
					serverReady = true;
					resolve({port: this.port, ready: true});
				}
			};

			// Connecta els event listeners
			this.serverProcess.stdout.on('data', checkOutput);
			this.serverProcess.stderr.on('data', checkOutput);

			this.serverProcess.on('error', (error: Error) => {
				console.error('❌ Error arrencant el servidor:', error);
				reject(error);
			});

			this.serverProcess.on('exit', (code: number, signal: string) => {
				this.log(`ℹ️  Procés servidor finalitzat - Codi: ${code}, Senyal: ${signal}`);
				if (!serverReady) {
					reject(new Error(`El servidor es va aturar abans d'estar llest. Codi: ${code}`));
				}
			});

			// Timeout de 30 segons
			const timeout = global.setTimeout(() => {
				if (!portFound) {
					console.error('\n⏰ Timeout esperant que el servidor arrenci\n');
					this.stopServer().catch(console.error);
					reject(new Error('Timeout esperant que el servidor arrenci'));
				}
			}, 30000);

			// Cancel·la el timeout quan el servidor estigui llest
			this.serverProcess.on('ready', () => {
				global.clearTimeout(timeout);
			});
		});
	}

	async waitForServerReady(): Promise<void> {
		if (!this.port) {
			throw new Error('Port no disponible');
		}
	}

	async sendInitializeRequest(): Promise<any> {
		if (!this.port) {
			throw new Error('Port no disponible');
		}

		const initRequest = {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {
					roots: {listChanged: true},
					sampling: {}
				},
				clientInfo: {
					name: 'test-client',
					version: '1.0.0'
				}
			}
		};

		try {
			const response = await fetch(`http://localhost:${this.port}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json, text/event-stream'
				},
				body: JSON.stringify(initRequest)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Extreu el session ID dels headers de resposta primer
			const sessionId = response.headers.get('mcp-session-id');
			if (sessionId) {
				this.sessionId = sessionId;
				this.log(`🔑 Session ID: ${this.sessionId}`);
			}

			// Comprova el tipus de contingut de la resposta
			const contentType = response.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				// Resposta JSON normal
				const result = await response.json();
				this.log('✅ Inicialització completada (JSON response)');
				console.log('Response:', JSON.stringify(result, null, 2));
				return result;
			} else if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
				// Resposta SSE o text - intenta parsejar manualment
				const text = await response.text();
				this.log('📝 Rebut resposta text/SSE, intentant parsejar...');

				// Si és SSE, busca les dades JSON dins dels events
				if (text.includes('event: message') || text.includes('data: ')) {
					const lines = text.split('\n');
					let jsonData = '';

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							jsonData += line.substring(6); // Remove 'data: ' prefix
						}
					}

					if (jsonData.trim()) {
						try {
							const result = JSON.parse(jsonData.trim());
							this.log('✅ Inicialització completada (SSE response parsejada)');
							console.log('Response:', JSON.stringify(result, null, 2));
							return result;
						} catch (parseError) {
							this.log("⚠️  No s'ha pogut parsejar com JSON, retornant text brut");
							return {rawResponse: text, sessionId: this.sessionId};
						}
					}
				}

				// Si no és SSE o no té format esperat, intenta parsejar directament
				try {
					const result = JSON.parse(text.trim());
					this.log('✅ Inicialització completada (text parsejat com JSON)');
					console.log('Response:', JSON.stringify(result, null, 2));
					return result;
				} catch (parseError) {
					this.log('⚠️  Contingut rebut no és JSON vàlid, retornant text');
					return {rawResponse: text, sessionId: this.sessionId};
				}
			} else {
				// Tipus de contingut desconegut
				const text = await response.text();
				this.log(`⚠️  Tipus de contingut desconegut: ${contentType}`);
				return {rawResponse: text, sessionId: this.sessionId};
			}
		} catch (error) {
			console.error('\n❌ Error en la inicialització:');
			console.error('\n❌ error.message:', error.message);
			console.error('\n❌ error.stack:', error.stack);
			console.error('\n❌ Error en la inicialització:', error);
			throw error;
		}
	}

	async sendListToolsRequest(): Promise<any> {
		if (!(this.port && this.sessionId)) {
			throw new Error('Port o Session ID no disponibles');
		}

		this.log('🔧 Enviant request per llistar tools...');

		const listToolsRequest = {
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
			params: {}
		};

		try {
			const response = await fetch(`http://localhost:${this.port}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json, text/event-stream',
					'mcp-session-id': this.sessionId
				},
				body: JSON.stringify(listToolsRequest)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Comprova el tipus de contingut de la resposta
			const contentType = response.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				// Resposta JSON normal
				const result = await response.json();
				this.log('✅ Llista de tools obtinguda (JSON response)');
				console.log('Response:', JSON.stringify(result, null, 2));
				return result;
			} else if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
				// Resposta SSE o text - intenta parsejar manualment
				const text = await response.text();
				this.log('📝 Rebut resposta text/SSE per tools, intentant parsejar...');

				// Si és SSE, busca les dades JSON dins dels events
				if (text.includes('event: message') || text.includes('data: ')) {
					const lines = text.split('\n');
					let jsonData = '';

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							jsonData += line.substring(6); // Remove 'data: ' prefix
						}
					}

					if (jsonData.trim()) {
						try {
							const result = JSON.parse(jsonData.trim());
							this.log('✅ Llista de tools obtinguda (SSE response parsejada)');
							console.log('Response:', JSON.stringify(result, null, 2));
							return result;
						} catch (parseError) {
							this.log("⚠️  No s'ha pogut parsejar com JSON, retornant text brut");
							return {rawResponse: text, sessionId: this.sessionId};
						}
					}
				}

				// Si no és SSE o no té format esperat, intenta parsejar directament
				try {
					const result = JSON.parse(text.trim());
					this.log('✅ Llista de tools obtinguda (text parsejat com JSON)');
					console.log('Response:', JSON.stringify(result, null, 2));
					return result;
				} catch (parseError) {
					this.log('⚠️  Contingut rebut no és JSON vàlid, retornant text');
					return {rawResponse: text, sessionId: this.sessionId};
				}
			} else {
				// Tipus de contingut desconegut
				const text = await response.text();
				this.log(`⚠️  Tipus de contingut desconegut: ${contentType}`);
				return {rawResponse: text, sessionId: this.sessionId};
			}
		} catch (error) {
			console.error('❌ Error obtenint la llista de tools:', error);
			throw error;
		}
	}

	async stopServer(): Promise<void> {
		return new Promise((resolve) => {
			if (this.serverProcess) {
				this.log('🛑 Aturant el servidor...');

				// Primer intenta SIGTERM (graceful shutdown)
				this.serverProcess.kill('SIGTERM');

				// Timeout per forçar SIGKILL si no respon
				const forceKillTimeout = global.setTimeout(() => {
					if (this.serverProcess && !this.serverProcess.killed) {
						this.log("⚠️  Forçant l'aturada del servidor...");
						this.serverProcess.kill('SIGKILL');
					}
				}, 5000);

				// Espera que el procés acabi
				this.serverProcess.on('exit', (code: number, signal: string) => {
					clearTimeout(forceKillTimeout);
					this.log(`✅ Servidor aturat (codi: ${code}, senyal: ${signal})`);
					resolve();
				});

				// Si el procés ja està mort
				this.serverProcess.on('error', (error: Error) => {
					if (error.message.includes('ESRCH')) {
						// Procés ja mort
						clearTimeout(forceKillTimeout);
						this.log('ℹ️  El procés servidor ja estava aturat');
						resolve();
					} else {
						console.error('❌ Error aturant el servidor:', error);
						resolve();
					}
				});
			} else {
				this.log('ℹ️  Cap servidor per aturar');
				resolve();
			}
		});
	}

	async run(): Promise<void> {
		let serverStarted = false;

		// Handler per SIGINT (Ctrl+C)
		const cleanup = async () => {
			this.log('\n🧹 Netegant recursos...');
			if (serverStarted) {
				await this.stopServer();
			}
			process.exit(0);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);

		try {
			// 1. Arrenca el servidor
			const serverInfo = await this.startServer();
			serverStarted = true;

			// Verifica que el servidor estigui completament llest
			await this.waitForServerReady();

			// Sleep de 4 segons abans del primer curl
			this.log('⏳ Esperant 4 segons abans del primer curl...\n');
			await sleep(4000);

			// 2. Envia request d'inicialització
			this.log("2️⃣ Enviant request d'inicialització...");
			const initResult = await this.sendInitializeRequest();
			console.log('');

			// 3. Envia request per llistar tools
			this.log('3️⃣ Enviant request per llistar tools...');
			const toolsResult = await this.sendListToolsRequest();
			console.log('');

			this.log('🎉 Test completat amb èxit!');
			this.log(`📊 Tools disponibles: ${toolsResult.result?.length || 'N/A'}`);
			console.log('');
		} catch (error) {
			console.error('💥 Error durant el test:', error);
			console.error('Detalls:', error instanceof Error ? error.stack : error);
		} finally {
			// Atura el servidor quan acaba el test (sigui exitós o fallit)
			console.log('');
			if (serverStarted) {
				this.log('🛑 Aturant el servidor...');
				await this.stopServer();
			}

			// Elimina els handlers de senyals
			process.off('SIGINT', cleanup);
			process.off('SIGTERM', cleanup);
		}
	}
}

// Funció principal
async function main() {
	const projectPath = '/Users/marcpla/Documents/Feina/Projectes/mcp/ibm-salesforce-context';

	console.log('🔬 Iniciant test del servidor MCP...');
	console.log(`📁 Project path: ${projectPath}`);

	const tester = new MCPTester(projectPath);
	await tester.run();
}

// Executa el script
main().catch(console.error);
