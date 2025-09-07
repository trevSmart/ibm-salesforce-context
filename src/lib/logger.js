import path from 'node:path';
import {fileURLToPath} from 'node:url';
import client from '../client.js';
import config from '../config.js';
import {state} from '../mcp-server.js';

// Internal: builds log prefix with emoji and optional config prefix
function getLogPrefix(logLevel) {
	const now = new Date();
	const timestamp = now.toTimeString().slice(0, 8); // HH:MM:SS format

	const logLevelEmojis = {
		emergency: '🔥',
		alert: '⛔️',
		critical: '❗️',
		error: '❌',
		warning: '⚠️',
		notice: '✉️',
		info: '💡',
		debug: '🐞'
	};
	const emoji = logLevelEmojis[logLevel] || '❓';
	const logLevelPrefix = emoji.repeat(3);
	if (config.logPrefix) {
		return `${timestamp}  (${config.logPrefix} · ${logLevelPrefix})`;
	}
	return `${timestamp}  (${logLevelPrefix})`;
}

// Base sink: sends logs to MCP if available, or stderr fallback
function emitLog(data, logLevel = config.defaultLogLevel, context = null, currentLogLevel = state.currentLogLevel) {
	try {
		const LevelPriorities = {
			emergency: 0,
			alert: 1,
			critical: 2,
			error: 3,
			warning: 4,
			notice: 5,
			info: 6,
			debug: 7
		};

		const logPriority = LevelPriorities[logLevel] ?? LevelPriorities.info;
		const currentPriority = LevelPriorities[currentLogLevel] ?? LevelPriorities.info;
		const errorPriority = LevelPriorities.error;
		const loggingSupported = client?.supportsCapability('logging');
		const shouldLog = loggingSupported && logPriority <= currentPriority;
		const shouldError = logPriority <= errorPriority || (!loggingSupported && logPriority <= currentPriority);

		if (!(shouldLog || shouldError)) {
			return;
		}

		let logData = data;

		if (data instanceof Error) {
			const errorMessage = context ? `${context}: ${data.message}` : data.message;
			logData = `${errorMessage}\nStack: ${data.stack}`;
		} else {
			if (typeof data === 'object') {
				try {
					logData = JSON.stringify(data, null, 2);
				} catch {
					logData = String(data);
				}
			} else if (typeof data === 'string') {
				logData = data;
			}
			if (context) {
				logData = `${context}: ${logData}`;
			}
		}

		if (typeof logData === 'string' && logData.length > 5000) {
			logData = `${logData.slice(0, 4997)}...`;
		}
		if (typeof logData === 'string') {
			logData = `\n${logData}\n`;
		}

		const logPrefix = getLogPrefix(logLevel);
		const mcp = globalThis.__mcpServer;
		if (shouldLog && mcp?.isConnected()) {
			const logger = `${logPrefix} MCP server`;
			mcp.server.sendLoggingMessage({level: logLevel, logger, data: logData});
		} else if (shouldError) {
			console.error(`${logPrefix} | ${logLevel} | ${logData}`);
		}
	} catch (error) {
		console.error(`${getLogPrefix('error')} ${JSON.stringify(error, null, 3)}`);
	}
}

// Simple logger wrapper to standardize severities across the codebase.
// Usage: const logger = createLogger('mcp-server'); logger.info('message', 'event');
export function createLogger(component = 'app', currentLogLevel = 'info') {
	const map = {error: 'error', warn: 'warning', info: 'info', debug: 'debug'};
	const wrap =
		(level) =>
		(data, event = null) => {
			const context = event ? `${component} · ${event}` : `(${component})`;
			emitLog(data, map[level], context, currentLogLevel);
		};
	return {
		error: wrap('error'),
		warn: wrap('warn'),
		info: wrap('info'),
		debug: wrap('debug'),
		log(level = 'info', data, event = null) {
			const mapped = map[level] || 'info';
			const context = event ? `${component} · ${event}` : component;
			emitLog(data, mapped, context, currentLogLevel);
		}
	};
}

// Helper to create a logger using the current module's file name as component
// Example: const logger = createModuleLogger(import.meta.url)
export function createModuleLogger(moduleUrl, fallback = 'app', currentLogLevel = 'info') {
	try {
		const filePath = fileURLToPath(moduleUrl);
		const base = path.basename(filePath).replace(/\.[^.]+$/, '');
		return createLogger(base || fallback, currentLogLevel);
	} catch {
		return createLogger(fallback, currentLogLevel);
	}
}
