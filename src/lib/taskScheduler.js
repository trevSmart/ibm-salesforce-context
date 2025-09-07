import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import Conf from 'conf';
import schedule from 'node-schedule';
import {createModuleLogger} from './logger.js';

const _execAsync = promisify(exec);
const logger = createModuleLogger(import.meta.url);

/**
 * Task Scheduler for managing periodic tasks with persistence
 * Handles scheduled tasks like CLI updates, metadata sync, etc.
 */
class TaskScheduler {
	constructor() {
		this.config = new Conf({
			projectName: 'ibm-salesforce-context',
			schema: {
				tasks: {
					type: 'object',
					properties: {
						cliUpdate: {
							type: 'object',
							properties: {
								enabled: {type: 'boolean'},
								interval: {type: 'string'}, // '0 0 */4 * * *' (cada 4 hores)
								lastRun: {type: 'string'},
								nextRun: {type: 'string'}
							}
						},
						metadataSync: {
							type: 'object',
							properties: {
								enabled: {type: 'boolean'},
								interval: {type: 'string'}, // '0 */3 * * * *' (cada 3 hores)
								lastRun: {type: 'string'},
								nextRun: {type: 'string'}
							}
						}
					}
				}
			},
			defaults: {
				tasks: {
					cliUpdate: {
						enabled: true,
						interval: '0 0 */4 * * *', // Cada 4 hores
						lastRun: '',
						nextRun: ''
					},
					metadataSync: {
						enabled: true,
						interval: '0 */3 * * * *', // Cada 3 hores
						lastRun: '',
						nextRun: ''
					}
				}
			}
		});

		this.jobs = new Map();
		this.initializeTasks();
	}

	/**
	 * Initialize all scheduled tasks
	 */
	initializeTasks() {
		logger.info('Initializing task scheduler...');

		// Verificar tasques pendents quan s'inicia el servidor
		this.checkPendingTasks();

		// Configurar tasques programades
		// this.scheduleTask('cliUpdate', this.updateSalesforceCli.bind(this));
		// this.scheduleTask('metadataSync', this.syncMetadata.bind(this));

		logger.info(`Task scheduler initialized with ${this.jobs.size} active tasks`);
	}

	/**
	 * Schedule a task with the given interval
	 * @param {string} taskName - Name of the task
	 * @param {Function} taskFunction - Function to execute
	 */
	scheduleTask(taskName, taskFunction) {
		const taskConfig = this.config.get(`tasks.${taskName}`);
		if (!taskConfig.enabled) {
			logger.debug(`Task ${taskName} is disabled, skipping`);
			return;
		}

		const job = schedule.scheduleJob(taskConfig.interval, async () => {
			try {
				logger.info(`Executing scheduled task: ${taskName}`);
				await taskFunction();
				this.updateTaskRun(taskName);
				logger.info(`Completed scheduled task: ${taskName}`);
			} catch (error) {
				logger.error(`Error in scheduled task ${taskName}:`, error);
			}
		});

		this.jobs.set(taskName, job);
		logger.info(`Scheduled task ${taskName} with interval: ${taskConfig.interval}`);
	}

	/**
	 * Update Salesforce CLI
	 */
	async updateSalesforceCli() {
		try {
			logger.info('Starting Salesforce CLI update...');

			// Executar en segon pla sense esperar
			exec('sf update', (error, stdout, stderr) => {
				if (error) {
					logger.error('Failed to update Salesforce CLI:', error);
					return;
				}

				if (stderr) {
					logger.warn('Salesforce CLI update stderr:', stderr);
				}

				logger.info('Salesforce CLI updated successfully');
				logger.debug('CLI update output:', stdout);
			});

			logger.info('Salesforce CLI update started in background');
		} catch (error) {
			logger.error('Failed to start Salesforce CLI update:', error);
			throw error;
		}
	}

	/**
	 * Sync metadata from Salesforce org
	 * Equivalent to "Refresh SObject Definitions" command
	 */
	async syncMetadata() {
		try {
			logger.info('Starting metadata sync...');

			// Import the refreshSobjects library
			const {writeSobjectFiles, SObjectCategory, SObjectRefreshSource} = await import('./refreshSobjects.js');

			// Create a simple event emitter for compatibility
			const EventEmitter = (await import('node:events')).EventEmitter;
			const emitter = new EventEmitter();

			// Create a simple cancellation token
			const cancellationToken = {
				isCancellationRequested: false
			};

			// Execute the metadata sync
			const result = await writeSobjectFiles({
				emitter,
				cancellationToken,
				source: SObjectRefreshSource.MANUAL,
				category: SObjectCategory.ALL
			});

			logger.info(`Metadata sync completed: ${result.data.standardObjects} standard objects, ${result.data.customObjects} custom objects`);
		} catch (error) {
			logger.error('Failed to sync metadata:', error);
			throw error;
		}
	}

	/**
	 * Check for pending tasks that should have run while server was offline
	 */
	checkPendingTasks() {
		const now = new Date();
		const tasks = this.config.get('tasks');

		for (const [taskName, taskConfig] of Object.entries(tasks)) {
			if (taskConfig.nextRun && new Date(taskConfig.nextRun) <= now) {
				logger.info(`Executing pending task: ${taskName}`);
				// Executar la tasca immediatament
				this.executeTask(taskName);
			}
		}
	}

	/**
	 * Execute a task immediately
	 * @param {string} taskName - Name of the task to execute
	 */
	async executeTask(taskName) {
		const taskFunctions = {
			cliUpdate: this.updateSalesforceCli.bind(this),
			metadataSync: this.syncMetadata.bind(this)
		};

		const taskFunction = taskFunctions[taskName];
		if (!taskFunction) {
			logger.error(`Unknown task: ${taskName}`);
			return;
		}

		try {
			await taskFunction();
			this.updateTaskRun(taskName);
		} catch (error) {
			logger.error(`Error executing task ${taskName}:`, error);
		}
	}

	/**
	 * Get task function by name
	 * @param {string} taskName - Name of the task
	 * @returns {Function} Task function
	 */
	getTaskFunction(taskName) {
		const taskFunctions = {
			cliUpdate: this.updateSalesforceCli.bind(this),
			metadataSync: this.syncMetadata.bind(this)
		};
		return taskFunctions[taskName];
	}

	/**
	 * Update task run information
	 * @param {string} taskName - Name of the task
	 */
	updateTaskRun(taskName) {
		const taskConfig = this.config.get(`tasks.${taskName}`);
		const now = new Date();

		this.config.set(`tasks.${taskName}`, {
			...taskConfig,
			lastRun: now.toISOString(),
			nextRun: this.calculateNextRun(taskConfig.interval, now).toISOString()
		});

		logger.debug(`Updated task run info for ${taskName}: lastRun=${now.toISOString()}`);
	}

	/**
	 * Calculate next run time based on cron expression
	 * @param {string} cronExpression - Cron expression
	 * @returns {Date} Next run date
	 */
	calculateNextRun(cronExpression) {
		const job = schedule.scheduleJob(cronExpression, () => {
			// Empty function for calculation only
		});
		const nextRun = job.nextInvocation();
		job.cancel();
		return nextRun;
	}

	/**
	 * Get task status information
	 * @returns {Object} Task status information
	 */
	getTaskStatus() {
		const tasks = this.config.get('tasks');
		const status = {};

		for (const [taskName, taskConfig] of Object.entries(tasks)) {
			status[taskName] = {
				enabled: taskConfig.enabled,
				interval: taskConfig.interval,
				lastRun: taskConfig.lastRun,
				nextRun: taskConfig.nextRun,
				isScheduled: this.jobs.has(taskName)
			};
		}

		return status;
	}

	/**
	 * Stop all scheduled tasks
	 */
	stop() {
		logger.info('Stopping task scheduler...');

		for (const [taskName, job] of this.jobs) {
			job.cancel();
			logger.info(`Stopped scheduled task: ${taskName}`);
		}

		this.jobs.clear();
		logger.info('Task scheduler stopped');
	}

	/**
	 * Cleanup method to prevent memory leaks
	 */
	cleanup() {
		// Cancel any jobs that might be stuck
		for (const [taskName, job] of this.jobs) {
			if (job && typeof job.cancel === 'function') {
				try {
					job.cancel();
				} catch (error) {
					logger.warn(`Error canceling job ${taskName}: ${error.message}`);
				}
			}
		}
		this.jobs.clear();
		logger.debug('Task scheduler cleanup completed');
	}
}

export default TaskScheduler;
