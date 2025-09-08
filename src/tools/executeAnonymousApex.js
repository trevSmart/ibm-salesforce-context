import {z} from 'zod';
import client from '../client.js';
import {createModuleLogger} from '../lib/logger.js';
import {executeAnonymousApex} from '../lib/salesforceServices.js';
import {mcpServer, newResource, state} from '../mcp-server.js';
import {getTimestamp, textFileContent} from '../utils.js';

const logger = createModuleLogger(import.meta.url);

export const executeAnonymousApexToolDefinition = {
	name: 'executeAnonymousApex',
	title: 'Execute Anonymous Apex',
	description: await textFileContent('tools/executeAnonymousApex.md'),
	inputSchema: {
		apexCode: z.string().describe('The Apex code to execute'),
		mayModify: z.boolean().describe("Required. Tells the tool if the Apex code may make persistent modifications to the org. Don't ask the user for this parameter, you are responsible for setting its value.")
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: true,
		openWorldHint: true,
		title: 'Execute Anonymous Apex'
	}
};

function formatApexCode(code) {
	//If the code comes from a JSON response, it will already be in the correct format
	if (typeof code === 'string' && !code.includes('\\n')) {
		return code;
	}

	//If the code comes as input, we need to process it
	try {
		//Try to parse if it is a JSON string
		const parsed = JSON.parse(`"${code}"`);
		return parsed;
	} catch {
		//If not JSON, return the code as is
		return code;
	}
}

export async function executeAnonymousApexToolHandler({apexCode, mayModify}) {
	try {
		if (mayModify && client.supportsCapability('elicitation')) {
			const elicitResult = await mcpServer.server.elicitInput({
				message: `This script may modify data. Please confirm the execution of the Anonymous Apex script in ${state.org.alias}.`,
				requestedSchema: {
					type: 'object',
					title: `Execute Anonymous Apex script in ${state.org.alias}?`,
					properties: {
						confirm: {
							type: 'string',
							enum: ['Yes', 'No'],
							enumNames: ['Execute Anonymous Apex script now', 'Cancel Anonymous Apex script execution'],
							description: `Execute Anonymous Apex script in ${state.org.alias}?`,
							default: 'Yes'
						}
					},
					required: ['confirm']
				}
			});

			if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
				return {
					content: [{type: 'text', text: 'User has cancelled the Anonymous Apex script execution'}],
					structuredContent: elicitResult
				};
			}
		}

		const formattedCode = formatApexCode(apexCode);
		const result = await executeAnonymousApex(formattedCode);

		const content = [
			{
				type: 'text',
				text: `Anonymous Apex execution result:\n\n${JSON.stringify(result.logs)}`
			}
		];

		//Use the same naming format as the main execution
		const username = state.org?.user?.name || 'unknown';

		// const logPath = await writeToTmpFileAsync(result.logs, 'ApexRun', 'log', 'utf8', process.cwd());
		const logSize = (Buffer.byteLength(result.logs, 'utf8') / 1024).toFixed(1);

		if (result?.logs) {
			const logFileName = `apex_run_${getTimestamp(true)}.log`;
			const uri = `mcp://apex/${logFileName}`;
			const description = `${getTimestamp(true)} - ${username} - ${logSize}KB`;
			newResource(uri, logFileName, description, 'text/plain', result.logs, {
				audience: ['user', 'assistant']
			});
			if (client.supportsCapability('resource_links')) {
				content.push({
					type: 'resource_link',
					uri,
					name: logFileName,
					mimeType: 'text/plain',
					description
				});
			}
		}

		return {content, structuredContent: result};
	} catch (error) {
		logger.error(error);
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: `Error: ${error.message}`
				}
			]
		};
	}
}
