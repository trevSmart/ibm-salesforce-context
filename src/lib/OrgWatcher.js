import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import {createModuleLogger} from './logger.js';

const logger = createModuleLogger(import.meta.url);

class TargetOrgWatcher extends EventEmitter {
	constructor() {
		super();
		this.configFilePath = null;
		this.currentOrgAlias = null;
		this.fileWatcher = null;
		this.isWatching = false;
		this.debounceMs = 5000; // Debounce file system events to reduce noise
		// this.debounceTimer = null;
	}

	async start(onChange, currentOrgAlias = null) {
		try {
			// Cleanup any existing watchers/listeners before starting
			await this.stop();

			this.configFilePath = path.join(process.cwd(), '.sf', 'config.json');
			this.currentOrgAlias = currentOrgAlias;

			if (this.isWatching || !this.currentOrgAlias || !fs.existsSync(this.configFilePath)) {
				return;
			}

			this.on('started', (orgAlias) => logger.debug(`Monitoring Salesforce CLI target org changes (current: ${orgAlias})`));
			this.on('orgChanged', onChange);
			this.on('error', (error) => logger.error(error, 'Error in Salesforce CLI target org watcher'));

			/*
			this.fileWatcher = fs.watch(path.dirname(this.configFilePath), (eventType, filename) => {
				if (filename === 'config.json' && eventType === 'change') {
					this.debouncedCheck();
				}
			});
			*/

			this.fileWatcher = chokidar.watch(this.configFilePath, {
				ignoreInitial: true,
				awaitWriteFinish: {stabilityThreshold: this.debounceMs}
			});
			this.fileWatcher.on('change', () => this.check());
			this.fileWatcher.on('error', (error) => this.emit('error', error));

			this.isWatching = true;
			this.emit('started', this.currentOrgAlias);
		} catch (error) {
			logger.error(error, 'Error setting up file watcher');
		}
	}

	async stop() {
		if (!this.isWatching) {
			return;
		}

		logger.debug('Stopping Salesforce CLI target org watcher');
		if (this.fileWatcher) {
			// this.fileWatcher.close();
			await this.fileWatcher.close();
			this.fileWatcher = null;
		}

		/*
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		*/

		// Cleanup all event listeners to prevent memory leaks
		this.removeAllListeners();
		this.isWatching = false;
		this.emit('stopped');
	}

	/*
	debouncedCheck() {
		this.debounceTimer && clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => this.check(), this.debounceMs);
	}
	*/

	check() {
		try {
			const configContent = fs.readFileSync(this.configFilePath, 'utf8');
			const sfConfig = JSON.parse(configContent);
			const newValue = sfConfig['target-org'] || null;

			if (!newValue) {
				logger.debug('No target org found in Salesforce CLI config file');
				return;
			}

			if (newValue !== this.currentOrgAlias) {
				const oldValue = this.currentOrgAlias;
				logger.info(`Change detected in Salesforce CLI target org: ${oldValue} -> ${newValue}`);
				this.currentOrgAlias = newValue;
				this.emit('orgChanged', {oldValue, newValue});
			}
		} catch (error) {
			logger.error(error, 'Error reading Salesforce CLI config file');
		}
	}
}

const targetOrgWatcher = new TargetOrgWatcher();

export default targetOrgWatcher;
