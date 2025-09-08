import {z} from 'zod';
import client from '../client.js';
import config from '../config.js';
import {createModuleLogger} from '../lib/logger.js';
import {executeAnonymousApex, getOrgAndUserDetails} from '../lib/salesforceServices.js';
import {clearResources, newResource, resources, sendProgressNotification, state} from '../mcp-server.js';
import {formatDate, textFileContent} from '../utils.js';

const logger = createModuleLogger(import.meta.url);

export const salesforceContextUtilsToolDefinition = {
	name: 'salesforceContextUtils',
	title: 'IBM Salesforce Context Utils',
	description: await textFileContent('tools/salesforceContextUtils.md'),
	inputSchema: {
		action: z.enum(['clearCache', 'getCurrentDatetime', 'getState', 'reportIssue', 'loadRecordPrefixesResource', 'getOrgAndUserDetails']).describe('The action to perform: "clearCache", "getCurrentDatetime", "getState", "reportIssue", "loadRecordPrefixesResource", "getOrgAndUserDetails"'),
		issueDescription: z.string().optional().describe('Detailed description of the issue and context from recent conversation messages (required for reportIssue action)'),
		issueToolName: z.string().optional().describe('Name of the tool that failed or needs improvement (optional)')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false,
		title: 'IBM Salesforce Context Utils'
	}
};

// Helper function to generate manual titles when sampling is not available
function generateManualTitle(toolName) {
	let title = 'Issue';

	if (toolName && toolName !== 'Unknown') {
		title += ` in ${toolName}`;
	}

	title += ': Technical problem reported';

	return title;
}

export async function salesforceContextUtilsToolHandler({action, issueDescription, issueToolName}, args) {
	const progressToken = args?._meta?.progressToken;

	try {
		if (action === 'clearCache') {
			clearResources();
			return {
				content: [
					{
						type: 'text',
						text: '✅ Successfully cleared cached resources'
					}
				],
				structuredContent: {action, status: 'success'}
			};
		} else if (action === 'getCurrentDatetime') {
			const now = new Date();

			const result = {
				now,
				nowLocaleString: now.toLocaleString(),
				nowIsoString: now.toISOString(),
				timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
			};

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				],
				structuredContent: result
			};
		} else if (action === 'getState') {
			return {
				content: [
					{
						type: 'text',
						text: 'Successfully retrieved the internal state of the MCP server'
					}
				],
				structuredContent: {state, client, resources}
			};
		} else if (action === 'loadRecordPrefixesResource') {
			const content = [];
			let structuredContent = {};
			const resourceUri = 'mcp://prefixes/recordPrefixes.csv';
			let data = [];
			const recordPrefixesResource = resources[resourceUri];
			if (recordPrefixesResource) {
				data = JSON.parse(recordPrefixesResource.text);
				content.push({type: 'text', text: '✅ Object record prefixes resource already loaded'});
			} else {
				// Load Apex script content via generalized textFileContent helper.
				// Works in dev (src/static/*.apex) and in packaged builds (src/static/*.apex.pam).
				const apexScript = await textFileContent('static/retrieve-sobject-prefixes.apex');
				if (!apexScript) {
					throw new Error('No retrieve-sobject-prefixes.apex(.pam) content found under static');
				}
				const result = await executeAnonymousApex(apexScript);
				if (result.success) {
					const resultLogs = result.logs;
					data = resultLogs
						.split('\n')
						.filter((line) => line.trim() && line.includes('USER_DEBUG'))
						.map((line) => {
							const lastPipeIndex = line.lastIndexOf('|');
							return lastPipeIndex !== -1 ? line.substring(lastPipeIndex + 1) : line;
						})
						.filter((line) => line.trim()); // Remove any empty lines after processing

					// Create new resource
					newResource(resourceUri, 'SObject record prefixes list', 'This resource contains a list of SObject record prefixes.', 'application/json', JSON.stringify(data, null, '\t'), {audience: ['user', 'assistant']});

					content.push({
						type: 'text',
						text: '✅ Object record prefixes resource loaded successfully'
					});
				} else {
					throw new Error(`Failed to load record prefixes: ${result.error}`);
				}
			}

			// Ensure data is an array before transformation
			if (!Array.isArray(data)) {
				logger.warn('Data is not an array, converting to array format');
				data = [];
			}

			// Transform the array data into the desired object format
			const transformedData = {};
			for (const item of data) {
				if (typeof item === 'string') {
					const [objectName, prefix] = item.split(',');
					if (objectName?.trim() && prefix?.trim()) {
						transformedData[prefix.trim()] = objectName.trim();
					}
				}
			}

			if (client.supportsCapability('resource_links')) {
				// Include required fields for ResourceLink per MCP schema
				const res = resources[resourceUri];
				content.push({
					type: 'resource_link',
					uri: resourceUri,
					name: res?.name || 'recordPrefixes.json',
					mimeType: res?.mimeType || 'application/json',
					description: res?.description || 'SObject record prefixes list'
				});
			}

			//This should only be necessary if client does not support resource_links
			//However testing shows that some clients cant read the resource_links properly even if they support it
			//For now we will always return the data as structured content
			structuredContent = transformedData;

			return {
				content,
				structuredContent
			};
		} else if (action === 'getOrgAndUserDetails') {
			const result = await getOrgAndUserDetails();
			return {
				content: [
					{
						type: 'text',
						text: 'Successfully retrieved the org and user details'
					}
				],
				structuredContent: result
			};
		} else if (action === 'reportIssue') {
			if (progressToken) {
				sendProgressNotification(progressToken, 1, 3, 'Starting reportIssue');
			}

			// Validate required fields for reportIssue
			if (!issueDescription || issueDescription.trim().length < 10) {
				throw new Error('For the reportIssue action, issueDescription is required and must be at least 10 characters long');
			}

			// Enhanced pattern-based validation for issue description quality
			const cleanDescription = issueDescription.trim();
			
			// Basic length validation (increased from 10 to 30 characters)
			if (cleanDescription.length < 30) {
				throw new Error('Issue description must be at least 30 characters long to provide sufficient detail');
			}

			// Content quality validation - reject common unhelpful phrases
			const unhelpfulPatterns = [
				/^(help|problem|issue|error|trouble|need help|something wrong)$/i,
				/^(report an issue|there is a problem|i have a problem)$/i,
				/^(it doesn't work|not working|broken|fix this)$/i,
				/^(please help|can you help|assistance needed)$/i
			];

			const isUnhelpful = unhelpfulPatterns.some(pattern => pattern.test(cleanDescription));
			if (isUnhelpful) {
				throw new Error('Issue description is too generic. Please provide specific technical details including what you were trying to do, what happened, and any error messages');
			}

			// Check for meaningful technical content
			const hasTechnicalIndicators = [
				/error|exception|failed|failure/i,
				/\b(SOQL|query|SELECT|FROM|WHERE|Apex|SObject|Salesforce)\b/i,
				/\b(tool|function|method|API|endpoint)\b/i,
				/\b(when|while|after|during|trying to|attempting to)\b/i,
				/"[^"]+"|'[^']+'|\b\w+\.\w+|\b[A-Z_]{3,}/  // Quoted strings, dotted notation, or constants
			];

			const technicalScore = hasTechnicalIndicators.reduce((score, pattern) => {
				return score + (pattern.test(cleanDescription) ? 1 : 0);
			}, 0);

			if (technicalScore < 2) {
				throw new Error('Issue description lacks sufficient technical details. Please include specific information such as: tool names, error messages, what you were trying to do, steps to reproduce, or technical context');
			}

			// Import required dependencies for title generation
			let mcpServer;
			try {
				const mcpServerModule = await import('../mcp-server.js');
				mcpServer = mcpServerModule.mcpServer;
			} catch (importError) {
				logger.debug(`Error importing mcp-server: ${importError.message}`);
				mcpServer = null;
			}

			// Fix issue type as "bug" and derive title from description
			const issueType = 'bug';

			// Try to generate title using sampling capability if available
			let title;
			let detectedToolName = issueToolName;

			// Fix severity to medium
			const issueSeverity = 'medium';

			if (client.supportsCapability('sampling') && mcpServer && !process.env.MCP_SKIP_SAMPLING) {
				try {
					// If no tool name specified, try to detect it from description
					if (!detectedToolName || detectedToolName === 'Unknown') {
						const toolDetectionPrompt = `## Issue Description ##
${issueDescription}

## Task ##
Analyze this issue description and determine which one of the MCP server's tools is most likely affected. Look for:
- Tool names mentioned (e.g., "executeSoqlQuery", "describeObject", "dmlOperation", "getSetupAuditTrail")
- Functionality described (e.g., "query execution", "object description", "record creation", "audit trail", "setup audit")
- Error messages that might indicate the tool
- Specific features mentioned (e.g., "Setup Audit Trail" → "getSetupAuditTrail")

If you can clearly identify the tool, return only the tool name.
If the description is unclear or could apply to multiple tools, return "Unknown".

Return only the tool name or "Unknown" without any explanation.

IMPORTANT: Generate your response in English.`;

						const toolDetectionResponse = await mcpServer.server.createMessage({
							messages: [{role: 'user', content: {type: 'text', text: toolDetectionPrompt}}],
							systemPrompt: "You are a Model Context Protocol expert. Analyze issue descriptions to identify which of the MCP server's tools is most likely affected.",
							modelPreferences: {speedPriority: 0, intelligencePriority: 1},
							maxTokens: 50
						});

						const detectedTool = toolDetectionResponse.content[0].text.trim();
						if (detectedTool && detectedTool !== 'Unknown' && detectedTool.length < 50) {
							detectedToolName = detectedTool;
						}
					}

					// Create sampling prompt for title generation
					const samplingPrompt = `## Issue Description ##
${issueDescription}

## Tool Information ##
Tool: ${detectedToolName}
Severity: ${issueSeverity || 'medium'}

## Task ##
Generate a concise, descriptive title for this issue report. The title should be:
- Clear and specific
- Under 60 characters
- Professional and technical
- Focus on the main problem

Return only the title without any explanation or formatting.

IMPORTANT: Generate your response in English.`;

					// Generate title using sampling capability
					const samplingResponse = await mcpServer.server.createMessage({
						messages: [{role: 'user', content: {type: 'text', text: samplingPrompt}}],
						systemPrompt: 'You are a technical issue report specialist. Generate concise, professional titles for technical issues.',
						modelPreferences: {speedPriority: 0, intelligencePriority: 1},
						maxTokens: 100
					});

					title = samplingResponse.content[0].text.trim();

					// Fallback if generated title is too long or empty
					if (!title || title.length > 60) {
						title = cleanDescription.length > 60 ? `${cleanDescription.substring(0, 60)}...` : cleanDescription;
					}
				} catch (error) {
					logger.debug(`Error generating title with sampling: ${error.message}`);
					// Fallback to manual title generation
					title = cleanDescription.length > 60 ? `${cleanDescription.substring(0, 60)}...` : cleanDescription;
				}
			} else {
				// Manual title generation when sampling is not available
				title = generateManualTitle(detectedToolName);
			}

			if (progressToken) {
				sendProgressNotification(progressToken, 2, 3, 'Generating title');
			}

			// Check if client supports elicitation and ask for confirmation before sending issue
			if (client.supportsCapability('elicitation') && mcpServer) {
				const elicitResult = await mcpServer.server.elicitInput({
					message: `⚠️ Please confirm that you want to report this issue.\n\nTitle: ${title}\n\nTool: ${detectedToolName}\n\nDescription: ${issueDescription}`,
					requestedSchema: {
						type: 'object',
						title: 'Report issue?',
						properties: {
							confirm: {
								type: 'string',
								enum: ['Yes', 'No'],
								enumNames: ['Report issue now', 'Cancel issue report'],
								description: 'Report this issue?',
								default: 'Yes'
							}
						},
						required: ['confirm']
					}
				});

				if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
					return {
						content: [
							{
								type: 'text',
								text: 'User has cancelled the issue report'
							}
						],
						structuredContent: elicitResult
					};
				}
			}

			if (progressToken) {
				sendProgressNotification(progressToken, 3, 3, 'Done');
			}

			// Prepare issue data
			const issueData = {
				type: issueType,
				title: title,
				description: issueDescription,
				toolName: detectedToolName,
				severity: 'medium',
				date: formatDate(new Date()),
				reportedBy: state.user?.name || process.env.USER || process.env.USERNAME || 'Unknown',
				environment: {
					os: process.platform === 'darwin' ? 'Mac OS' : process.platform,
					user: process.env.USER || process.env.USERNAME || 'Unknown',
					nodeVersion: process.version,
					mcpProtocolVersion: config.serverConstants.protocolVersion
				},
				server: {
					serverInfo: config.serverConstants.serverInfo,
					capabilities: config.serverConstants.capabilities,
					workspacePath: process.cwd(),
					org: state.org
				},
				client: {
					clientInfo: client.clientInfo,
					capabilities: client.capabilities
				}
			};

			// Test-friendly dry-run mode to avoid creating real issues from tests
			if (String(process.env.MCP_REPORT_ISSUE_DRY_RUN || '').toLowerCase() === 'true') {
				const fake = {
					success: true,
					issueId: `DRY-RUN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
					issueUrl: 'about:blank#dry-run',
					message: 'Dry run: issue not sent to webhook',
					request: {type: issueType, title, tool: detectedToolName, severity: issueSeverity}
				};
				return {
					content: [{type: 'text', text: '✅ Dry run: issue report simulated (no webhook call)'}],
					structuredContent: fake
				};
			}

			try {
				// Send issue to Netlify webhook
				logger.info('Sending issue');
				const response = await fetch('https://mcp-salesforce-issue-webhook.netlify.app/.netlify/functions/report-issue', {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify(issueData)
				});

				if (response.ok) {
					const result = await response.json();

					if (result.success) {
						logger.info(`Issue created successfully: ${result.issueUrl}`);

						return {
							content: [
								{
									type: 'text',
									text: `Issue ${result.issueId} successfully created`
								}
							],
							structuredContent: result
						};
					} else {
						throw new Error(`Webhook error: ${result.error || 'Unknown error'}`);
					}
				} else {
					throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
				}
			} catch (error) {
				logger.error(error, 'Error sending issue');
				throw new Error(`Failed to send issue to webhook: ${error.message}`);
			}
		} else {
			throw new Error(`Invalid action: ${action}`);
		}
	} catch (error) {
		logger.error(error, 'Error in salesforceContextUtilsTool');
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text: `❌ Error: ${error.message}`
				}
			]
		};
	}
}
