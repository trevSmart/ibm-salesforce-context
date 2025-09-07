/** biome-ignore-all lint/suspicious/noConsole: dev script */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

//Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Load .env variables, ignoring commented lines
const envPath = path.resolve(__dirname, '../.env');
let envRaw = fs.readFileSync(envPath, 'utf8');
envRaw = envRaw
	.split('\n')
	.filter((line) => !line.trim().startsWith('#'))
	.join('\n');

for (const line of envRaw.split('\n')) {
	const [key, ...vals] = line.split('=');
	if (key && vals.length > 0) {
		process.env[key.trim()] = vals.join('=').trim();
	}
}

//Generate deeplink configs
const cfgCursorBase64 = Buffer.from(JSON.stringify({command: 'npx', args: ['test_research4'], env: {}})).toString('base64');
const deeplinkCursor = `cursor://anysphere.cursor-deeplink/mcp/install?name=ibm-salesforce-context&config=${cfgCursorBase64}`;
const deeplinkVsCode = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({name: 'ibm-salesforce-mcp', command: 'npx', args: ['test_research4']}))}`;

//Read README.md
const readmePath = path.resolve(__dirname, '../README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

//Regex for each button line
const regexCursor = /cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=ibm-salesforce-context&config=[^\n`)]*/g;
const regexVsCode = /vscode:mcp\/install\?[^\n`)]*/g;

//Update or append Cursor deeplink
if (regexCursor.test(readme)) {
	readme = readme.replace(regexCursor, deeplinkCursor);
}

if (regexVsCode.test(readme)) {
	readme = readme.replace(regexVsCode, deeplinkVsCode);
}

console.log('');
console.log('Updating Cursor and VSCode deeplinks in README.md...');

try {
	fs.writeFileSync(readmePath, readme, 'utf8');
	console.log('Deeplinks successfully updated in README.md.');
	console.log('');
	process.exit(0);
} catch (error) {
	console.error('❌ Error updating README.md:', error.message);
	console.log('');
	process.exit(1);
}
