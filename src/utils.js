import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'fs-extra';
import config from './config.js';
import {createModuleLogger} from './lib/logger.js';
import {cleanupObsoleteTempFiles, ensureBaseTmpDir} from './lib/tempManager.js';
import {state} from './mcp-server.js';
import {executeSoqlQuery} from './lib/salesforceServices.js';

const logger = createModuleLogger(import.meta.url);

/**
 * Helper function to add timeout to any promise
 * @param {Promise} promise - The promise to add timeout to
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Promise} Promise that rejects with timeout error if timeout is reached
 */
export function withTimeout(promise, ms, errorMessage = 'Operation timeout') {
	return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))]);
}

/**
 * Validates if the user has the required permissions
 * @param {string} username - The username to validate
 * @returns {Promise<void>}
 */
export async function validateUserPermissions(username) {
	try {
		if (typeof username !== 'string' || !username.trim()) {
			throw new Error('Invalid username parameter');
		}
		// Escape backslashes first, then single quotes for SOQL string literals
		const safeUsername = username.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
		const soql = `SELECT Id FROM PermissionSetAssignment WHERE Assignee.Username = '${safeUsername}' AND PermissionSet.Name = 'IBM_SalesforceMcpUser'`;
		const query = await withTimeout(executeSoqlQuery(soql), 10000, 'Permission query timeout');
		if (query?.records?.length) {
			state.userValidated = true;
		} else {
			state.userValidated = false;
			// Keep emergency level for visibility via base sink
			logger.emergency(`Insufficient permissions in org "${state.org.alias}". Assign Permission Set 'IBM_SalesforceMcpUser' to the user.`);
		}
	} catch (error) {
		state.userValidated = false;
		logger.error(error, 'Error validating user permissions');
	}
}

/*
export function notifyProgressChange(progressToken, total, progress, message) {
	if (!progressToken) {
		return;
	}
	mcpServer.server.notification({
		method: 'notifications/progress',
		params: {progressToken, progress, total, message}
	});
}
*/

/**
Reads text content from a file with flexible lookup rules.
* - If input contains a path separator, it is treated as a path relative to src/ (this file's folder),
*   with automatic fallback to a '.pam' variant when the original file doesn't exist (useful after packaging).
* - If input does not contain a path separator, it is treated as a tool descriptor name and looked up under src/tools.
* - If the found file content looks base64, it is decoded automatically.
* @param {string} input - Tool name (legacy) or relative/absolute path to a file (without or with extension).
* @returns {Promise<string|null>} Content of the file or null if not found
*/
export async function textFileContent(input) {
	try {
		const localFilename = fileURLToPath(import.meta.url);
		const localDirname = path.dirname(localFilename);

		const tryRead = async (fullPath) => {
			if (!(fullPath && (await fs.pathExists(fullPath)) && (await fs.stat(fullPath)).isFile())) {
				return null;
			}
			const content = await fs.readFile(fullPath, 'utf8');
			const trimmed = content.trim();
			// Detect base64 payloads (used in publish step for .md/.apex → .pam)
			const isBase64 = /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(trimmed) && trimmed.length > 0;
			return isBase64 ? Buffer.from(trimmed, 'base64').toString('utf8') : content;
		};

		const looksLikePath = input.includes('/') || input.includes('\\');

		// Case A: explicit path lookup
		if (looksLikePath) {
			const basePath = path.isAbsolute(input) ? input : path.join(localDirname, input);

			// 1) Exact path
			let content = await tryRead(basePath);
			if (content !== null) {
				return content;
			}

			// 2) Try ".pam" sibling (for packaged artifacts)
			content = await tryRead(`${basePath}.pam`);
			if (content !== null) {
				return content;
			}

			// 3) Try prefix match inside the same directory (e.g., basename.*)
			const dir = path.dirname(basePath);
			const base = path.basename(basePath);
			if (await fs.pathExists(dir)) {
				const entries = await fs.readdir(dir);
				const entry = entries.find((f) => f.startsWith(`${base}.`));
				if (entry) {
					content = await tryRead(path.join(dir, entry));
					if (content !== null) {
						return content;
					}
				}
			}

			return null;
		}

		// Case B: legacy tool descriptor lookup under src/tools
		const toolsDir = path.join(localDirname, 'tools');
		if (!(await fs.pathExists(toolsDir))) {
			return null;
		}
		const files = await fs.readdir(toolsDir);
		const candidates = files.filter((file) => file.startsWith(`${input}.`));
		if (!candidates.length) {
			return null;
		}

		// Prefer Markdown descriptions over JS when both exist
		const preferredOrder = [`${input}.md`, `${input}.md.pam`, `${input}.pam`, `${input}.apex`, `${input}.js`];
		let chosen = candidates.find((f) => preferredOrder.includes(f));
		if (!chosen) {
			// Fallback to the first candidate (stable behavior)
			chosen = candidates[0];
		}
		return await tryRead(path.join(toolsDir, chosen));
	} catch (error) {
		logger.debug(error, 'textFileContent error');
		return null;
	}
}

/**
 * Unified function to write files with consolidated functionality
 * @param {string|object} file - Either a full file path or filename (without extension)
 * @param {string|object} data - Content to write (string or object to be JSON.stringify'd)
 * @param {object} options - Configuration options
 * @param {boolean} options.async - Whether to write asynchronously (default: false)
 * @param {string} options.extension - File extension (default: 'json' if object, 'txt' if string)
 * @param {string} options.workspacePath - Workspace path for tmp directory (optional)
 * @returns {string|Promise<string>} Full path to the created file (Promise if async=true)
 */
export async function writeToFile(file, data, options = {}) {
	const {
		async = false,
		extension,
		encoding = 'utf8',
		// workspacePath should be the workspace root, NOT the tmp folder itself
		workspacePath = process.cwd()
	} = options;

	try {
		// Determine if file is a full path or just filename
		const isFullPath = file.includes('/') || file.includes('\\') || file.includes(path.sep);
		let fullPath;

		if (isFullPath) {
			// File is a full path
			fullPath = file;
			// Ensure directory exists using fs-extra
			const dir = path.dirname(fullPath);
			await fs.ensureDir(dir);
			logger.debug(`Ensured directory exists: ${dir}`);
		} else {
			// File is just a filename, use tmp directory
			const tmpDir = ensureBaseTmpDir(workspacePath);
			// Opportunistic cleanup of obsolete temp files
			try {
				cleanupObsoleteTempFiles({baseDir: tmpDir});
			} catch {
				logger.warn('Error cleaning up obsolete temp files');
			}
			const timestamp = getTimestamp();

			// Determine extension based on content type if not provided
			let finalExtension = extension;
			if (!finalExtension) {
				finalExtension = typeof data === 'object' ? 'json' : 'txt';
			}

			const fullFilename = `${file}_${timestamp}.${finalExtension}`;
			fullPath = path.join(tmpDir, fullFilename);
		}

		// Prepare content
		let content;
		if (typeof data === 'object' && !Buffer.isBuffer(data)) {
			content = JSON.stringify(data, null, 3);
		} else {
			content = data;
		}

		// Write file using fs-extra
		if (async) {
			await fs.writeFile(fullPath, content, encoding);
			logger.debug(`File written to: ${fullPath}`);
			return fullPath;
		} else {
			await fs.writeFile(fullPath, content, encoding);
			logger.debug(`File written to: ${fullPath}`);
			return fullPath;
		}
	} catch (error) {
		logger.error(`Error writing to file: ${error.message}`);
		throw error;
	}
}

/**
 * Saves an object to a temporary JSON file
 * @param {object} object - Object to save
 * @param {string} filename - Base name for the file (without extension)
 */
export async function saveToFile(object, filename) {
	const tmpDir = ensureBaseTmpDir(state.workspacePath);
	try {
		cleanupObsoleteTempFiles({baseDir: tmpDir});
	} catch {
		logger.warn('Error cleaning up obsolete temp files');
	}
	const filePath = path.join(tmpDir, `${filename}_${Date.now()}.json`);
	await fs.writeFile(filePath, JSON.stringify(object, null, 3), 'utf8');
	logger.debug(`Object written to temporary file: ${filePath}`);
}

/**
 * Writes content to a temporary file in the workspace tmp directory
 * @param {string} content - Content to write
 * @param {string} filename - Name of the file (with extension)
 * @param {string} encoding - File encoding (default: 'utf8')
 * @param {string} workspacePath - Path to the workspace (optional)
 * @returns {string} Full path to the created file
 */
export async function writeToTmpFile(content, filename, encoding = 'utf8', workspacePath = null) {
	try {
		const tmpDir = ensureBaseTmpDir(workspacePath);
		try {
			cleanupObsoleteTempFiles({baseDir: tmpDir});
		} catch {
			logger.warn('Error cleaning up obsolete temp files');
		}
		const fullPath = path.join(tmpDir, filename);

		await fs.writeFile(fullPath, content, encoding);
		logger.debug(`File written to tmp directory: ${fullPath}`);

		return fullPath;
	} catch (error) {
		logger.error(`Error writing to tmp file: ${error.message}`);
		throw error;
	}
}

/**
 * Writes content to a temporary file asynchronously
 * @param {string} content - Content to write
 * @param {string} filename - Name of the file (without extension)
 * @param {string} extension - File extension (default: 'txt')
 * @param {string} encoding - File encoding (default: 'utf8')
 * @param {string} workspacePath - Path to the workspace (optional)
 * @returns {Promise<string>} Full path to the created file
 */
export async function writeToTmpFileAsync(content, filename, extension = 'txt', encoding = 'utf8', workspacePath = null) {
	try {
		const tmpDir = ensureBaseTmpDir(workspacePath);
		try {
			cleanupObsoleteTempFiles({baseDir: tmpDir});
		} catch {
			logger.warn('Error cleaning up obsolete temp files');
		}
		const timestamp = getTimestamp();
		const fullFilename = `${filename}_${timestamp}.${extension}`;
		const fullPath = path.join(tmpDir, fullFilename);

		await fs.writeFile(fullPath, content, encoding);
		logger.debug(`File written to tmp directory (async): ${fullPath}`);

		return fullPath;
	} catch (error) {
		logger.error(`Error writing to tmp file (async): ${error.message}`);
		throw error;
	}
}

/**
 * Returns predefined instructions for different agent types
 * @param {string} name - Name of the agent type
 * @returns {string} Instructions text
 */
export async function getAgentInstructions(name) {
	try {
		const localFilename = fileURLToPath(import.meta.url);
		const localDirname = path.dirname(localFilename);
		const staticPath = path.join(localDirname, 'static', `${name}.md`);

		if (await fs.pathExists(staticPath)) {
			return await fs.readFile(staticPath, 'utf8');
		}
		return '';
	} catch {
		// Avoid logging here to keep this module cycle-free
		return '';
	}
}

/**
 * Generates a timestamp string
 * @param {boolean} long - Whether to use long format (DD-MM-YY, HH:MM:SS) instead of compact format (YYMMDDHHMMSS)
 * @returns {string} Formatted timestamp
 */
export function getTimestamp(long = false) {
	const now = new Date();
	const year = String(now.getFullYear()).slice(-2); //Get last 2 digits of year
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');
	if (long) {
		return `${day}-${month}-${year}, ${hours}:${minutes}:${seconds}`;
	} else {
		return `${year}${month}${day}${hours}${minutes}${seconds}`;
	}
}

/**
 * Generates a prefix for log messages with emoji based on log level
 * @param {string} logLevel - Log level (emergency, alert, critical, error, warning, notice, info, debug)
 * @returns {string} Formatted log prefix
 * @private
 */
// getLogPrefix removed; handled centrally in logger.js

/**
 * Extracts the file name without extension from a file path
 * @param {string} filePath - Path to the file
 * @returns {string} File name without extension
 */
export function getFileNameFromPath(filePath) {
	const trimmed = filePath.replace(/[\\/]+$/, '');
	const ext = path.extname(trimmed);
	return ext ? path.basename(trimmed, ext) : path.basename(trimmed);
}

/**
 * Formats a date object to a localized string (includes time if date is today)
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	// Use configured locale if provided; otherwise rely on system default locale
	const locale = typeof config?.locale === 'string' && config.locale.trim() ? config.locale.trim() : undefined;

	const timeOptions = {hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false};
	const dateOptions = {day: 'numeric', month: 'numeric', year: 'numeric'};

	const safeFormat = (d, method, opts) => {
		try {
			return d[method](locale, opts);
		} catch {
			// Fallback to system default locale if provided locale is invalid
			return d[method](undefined, opts);
		}
	};

	let formattedDate = safeFormat(date, 'toLocaleTimeString', timeOptions);
	if (date.toDateString() !== new Date().toDateString()) {
		formattedDate = `${safeFormat(date, 'toLocaleDateString', dateOptions)} ${formattedDate}`;
	}
	return formattedDate;
}
