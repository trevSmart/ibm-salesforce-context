import fs from 'node:fs'
import path from 'node:path'
import { createMcpClient, disconnectMcpClient } from '../testMcpClient.js'

function cleanupCreatedFiles(files, projectRoot) {
	// First, delete all files and directories
	for (const item of files) {
		try {
			if (fs.existsSync(item)) {
				const stat = fs.statSync(item)
				if (stat.isDirectory()) {
					// Delete directory recursively
					fs.rmSync(item, { recursive: true, force: true })
					console.log(`Deleted directory: ${item}`)
				} else {
					// Delete file
					fs.unlinkSync(item)
					console.log(`Deleted file: ${item}`)
				}
			}
		} catch (error) {
			console.warn(`Failed to delete ${item}: ${error.message}`)
		}
	}

	// Then, collect all unique parent directories that need to be checked
	const dirsToCheck = new Set()
	for (const item of files) {
		let dir = path.dirname(item)
		while (dir !== projectRoot && dir !== path.dirname(dir)) {
			dirsToCheck.add(dir)
			dir = path.dirname(dir)
		}
	}

	// Sort directories by depth (deepest first) to ensure parent directories are processed after children
	const sortedDirs = Array.from(dirsToCheck).sort(
		(a, b) => b.split(path.sep).length - a.split(path.sep).length,
	)

	// Remove empty directories
	for (const dir of sortedDirs) {
		try {
			if (fs.existsSync(dir)) {
				const contents = fs.readdirSync(dir)
				if (contents.length === 0) {
					fs.rmdirSync(dir)
					console.log(`Deleted empty directory: ${dir}`)
				}
			}
		} catch (error) {
			console.warn(`Failed to delete directory ${dir}: ${error.message}`)
		}
	}
}

describe('createMetadata', () => {
	let client
	let createdFiles = []

	beforeAll(async () => {
		// Create and connect to the MCP server
		client = await createMcpClient()
	})

	afterAll(async () => {
		await disconnectMcpClient(client)

		// Cleanup created files and empty directories
		const projectRoot = process.cwd()
		// Remove duplicates from createdFiles
		createdFiles = [...new Set(createdFiles)]
		cleanupCreatedFiles(createdFiles, projectRoot)
	})

	test('Apex class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexClass',
			name: 'TestMCPToolClass',
		})
		if (result?.structuredContent?.files) {
			createdFiles.push(...result.structuredContent.files)
		}
		expect(result?.structuredContent?.success).toBe(true)
		expect(result.structuredContent.files).toBeTruthy()
	})

	test('Apex test class', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTestClass',
			name: 'TestMCPToolClassTest',
		})
		if (result?.structuredContent?.files) {
			createdFiles.push(...result.structuredContent.files)
		}
		console.error('🔥 result', result)
		expect(result?.structuredContent?.success).toBe(true)
	})

	test('Apex trigger', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'apexTrigger',
			name: 'TestMCPToolTrigger',
			triggerSObject: 'Account',
			triggerEvent: ['after insert', 'before update'],
		})
		if (result?.structuredContent?.files) {
			createdFiles.push(...result.structuredContent.files)
		}
		console.error('🔥 result', result)
		expect(result?.structuredContent?.success).toBe(true)
	})

	test('LWC', async () => {
		const result = await client.callTool('createMetadata', {
			type: 'lwc',
			name: 'testMCPToolComponent',
		})
		if (result?.structuredContent?.files) {
			createdFiles.push(...result.structuredContent.files)
		}
		console.error('🔥 result', result)
		expect(result?.structuredContent?.success).toBe(true)
	})
})
