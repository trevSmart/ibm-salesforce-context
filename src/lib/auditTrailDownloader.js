import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {state} from '../mcp-server.js';
import {createModuleLogger} from './logger.js';

const logger = createModuleLogger(import.meta.url);
// const execAsync = promisify(exec);

// Check if Playwright browsers are installed
async function checkPlaywrightBrowsers() {
	try {
		// This will throw if browsers are not installed
		await chromium.launch({headless: true});
		return true;
	} catch (error) {
		if (error.message.includes("Executable doesn't exist") || error.message.includes('chromium') || error.message.includes('browser')) {
			return false;
		}
		// Other errors, re-throw
		throw error;
	}
}

// Install Playwright browsers
async function installPlaywrightBrowsers() {
	try {
		logger.info('Installing Playwright browsers...');
		// const {stdout, stderr} = await execAsync('npx playwright install chromium');
		logger.info('Playwright browsers installed successfully');
		return true;
	} catch (error) {
		logger.error('Failed to install Playwright browsers:', error.message);
		throw new Error(`Failed to install Playwright browsers: ${error.message}`);
	}
}

// Try clicking the first candidate link found across page and frames
async function clickDownloadCandidate(page, timeoutPerClick = 2000) {
	const selectors = ['a:has-text("Download setup audit trail")', 'a[href*="csv"]', 'a[href*="download"]', 'a[href*="audit"]'];

	const contexts = [page, ...page.frames()];
	for (const sel of selectors) {
		for (const ctx of contexts) {
			try {
				const loc = ctx.locator(sel).first();
				if (await loc.count()) {
					await loc.click({timeout: timeoutPerClick});
					return true;
				}
			} catch {
				// ignore and try next candidate
			}
		}
	}
	return false;
}

async function retrieveFile() {
	let browser = null;
	try {
		const setupUrl = '/lightning/setup/SecurityEvents/home';

		// Check if Playwright browsers are installed first
		let hasPlaywrightBrowsers = await checkPlaywrightBrowsers();

		if (!hasPlaywrightBrowsers) {
			logger.warn('Playwright browsers not installed. Installing them automatically...');
			await installPlaywrightBrowsers();
			// Check again after installation
			hasPlaywrightBrowsers = await checkPlaywrightBrowsers();
			if (!hasPlaywrightBrowsers) {
				throw new Error('Failed to install Playwright browsers. Please run manually: npx playwright install chromium');
			}
		}

		browser = await chromium.launch({headless: true});

		// Ensure tmp directory
		const tmpDir = path.join(process.cwd(), 'tmp');
		fs.existsSync(tmpDir) || fs.mkdirSync(tmpDir, {recursive: true});

		const context = await browser.newContext({acceptDownloads: true, downloadsPath: tmpDir});
		const page = await context.newPage();

		const {instanceUrl, accessToken} = state.org;
		const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}&retURL=${encodeURIComponent(setupUrl)}`;
		await page.goto(frontdoorUrl, {waitUntil: 'domcontentloaded'});
		await page.waitForURL((url) => url.pathname.includes(setupUrl), {timeout: 15_000});

		// Attempt clicking candidates while waiting for a download event
		const download = await Promise.race([
			(async () => {
				const dl = await page.waitForEvent('download', {timeout: 5_000});
				return dl;
			})(),
			(async () => {
				const start = Date.now();
				const maxWaitMs = 5_000;
				while (Date.now() - start < maxWaitMs) {
					const clicked = await clickDownloadCandidate(page);
					if (clicked) {
						// Give the browser a short moment to emit the download event
						await page.waitForTimeout(50);
					}
					await page.waitForTimeout(200);
				}
				throw new Error('Download link not found in Setup Audit Trail.');
			})()
		]);

		const filePath = path.join(tmpDir, 'SetupAuditTrail.csv');
		await download.saveAs(filePath);
		return filePath;
	} catch (error) {
		logger.error(error, 'Error during Setup Audit Trail download');
		throw error;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

async function retrieveFileWithRetry(maxRetries = 2) {
	let lastError;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.debug(`Attempt ${attempt}/${maxRetries} to retrieve Setup Audit Trail file`);
			return await retrieveFile();
		} catch (error) {
			lastError = error;
			const transient = typeof error?.message === 'string' && (error.message.includes('Frame was detached') || error.message.includes('Target page, context or browser has been closed'));
			if (transient && attempt < maxRetries) {
				logger.warn(`Transient error on attempt ${attempt}, retrying...`);
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}
			break;
		}
	}
	logger.error(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`);
	throw lastError;
}

export async function retrieveSetupAuditTrailFile() {
	try {
		return await retrieveFileWithRetry();
	} catch (error) {
		logger.error(error, 'Error retrieving Setup Audit Trail file');
		throw error;
	}
}
