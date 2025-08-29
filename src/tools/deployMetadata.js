import state from '../state.js';
import {mcpServer} from '../mcp-server.js';
import client from '../client.js';
import {deployMetadata} from '../salesforceServices.js';
import {textFileContent, getFileNameFromPath} from '../utils.js';
import {createModuleLogger} from '../logger.js';
import {z} from 'zod';

export const deployMetadataToolDefinition = {
	name: 'deployMetadata',
	title: 'Deploy Metadata',
	description: textFileContent('deployMetadata'),
	inputSchema: {
		sourceDir: z.string().describe('The path to the local metadata file to deploy.')
	},
	annotations: {
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: true,
		title: 'Deploy metadata to org'
	}
};

export async function deployMetadataToolHandler({sourceDir}) {
	const logger = createModuleLogger(import.meta.url);
	try {
		if (client.supportsCapability('elicitation')) {
			const metadataName = getFileNameFromPath(sourceDir);
			const elicitResult = await mcpServer.server.elicitInput({
				message: `Please confirm the deployment of ${metadataName} to the org ${state.org.alias}.`,
				requestedSchema: {
					type: 'object',
					title: `Deploy ${metadataName} to ${state.org.alias}?`,
					properties: {
						confirm: {
							type: 'string',
							enum: ['Yes', 'No'],
							enumNames: ['Deploy metadata now', 'Cancel metadata deployment'],
							description: `Deploy ${metadataName} to ${state.org.alias}?`,
							default: 'Yes'
						}
					},
					required: ['confirm']
				}
			});

			if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
				return {
					content: [{
						type: 'text',
						text: 'User has cancelled the metadata deployment'
					}],
					structuredContent: elicitResult
				};
			}
		}

		const result = await deployMetadata(sourceDir);

		return {
			isError: !result.success,
			content: [{
				type: 'text',
				text: JSON.stringify(result, null, 3)
			}],
			structuredContent: result
		};

	} catch (error) {
		logger.error(error, 'Error deploying metadata');

		return {
			isError: true,
			content: [{
				type: 'text',
				text: '❌ Error deploying metadata: ' + error.message
			}],
			structuredContent: error
		};
	}

}
