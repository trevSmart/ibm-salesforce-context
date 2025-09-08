/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// biome-ignore-all lint: <file in progress>
import {exec} from 'node:child_process';
import path from 'node:path';
import {promisify} from 'node:util';
import fs from 'fs-extra';
import {createModuleLogger} from './logger.js';

const execAsync = promisify(exec);
const logger = createModuleLogger(import.meta.url);

// Constants
export const CLIENT_ID = 'sfdx-vscode';
export const SOBJECTS_DIR = 'sobjects';
export const STANDARDOBJECTS_DIR = 'standardObjects';
export const CUSTOMOBJECTS_DIR = 'customObjects';
export const SOQLMETADATA_DIR = 'soqlMetadata';
export const EXIT_EVENT = 'exitEvent';
export const ERROR_EVENT = 'errorEvent';
export const STDOUT_EVENT = 'stdoutEvent';
export const STDERR_EVENT = 'stderrEvent';
export const SUCCESS_CODE = 0;
export const FAILURE_CODE = 1;

// Types
export const SObjectCategory = {
	ALL: 'ALL',
	STANDARD: 'STANDARD',
	CUSTOM: 'CUSTOM'
};

export const SObjectRefreshSource = {
	MANUAL: 'manual',
	STARTUP: 'startup',
	STARTUPMIN: 'startupmin'
};

// Main function to write SObject files
export const writeSobjectFiles = async (args) => {
	try {
		const {sobjectNames, sobjects} = await getNamesAndTypes(args.conn, args.category, args.source);

		if (!args.cancellationToken.isCancellationRequested) {
			Object.entries(sobjects).forEach(([category, objects]) => {
				args.emitter.emit(STDOUT_EVENT, `Processed ${objects.length} ${capitalize(category)} objects`);
			});
		}

		// Generate all files
		if (!args.cancellationToken.isCancellationRequested) {
			await Promise.all([generateFauxClasses(sobjects), generateAllTypes(sobjects), writeTypeNamesFile(sobjectNames), generateAllMetadata(sobjects)]);
		}

		args.emitter.emit(EXIT_EVENT, !args.cancellationToken.isCancellationRequested ? SUCCESS_CODE : FAILURE_CODE);

		return {
			data: {
				cancelled: args.cancellationToken.isCancellationRequested,
				standardObjects: sobjects.standard.length,
				customObjects: sobjects.custom.length
			}
		};
	} catch (error) {
		args.emitter.emit(STDERR_EVENT, `${error instanceof Error ? error.message : String(error)}\n`);
		args.emitter.emit(ERROR_EVENT, error);
		args.emitter.emit(EXIT_EVENT, FAILURE_CODE);
		return Promise.reject({
			error: error instanceof Error ? error : new Error(String(error)),
			data: {cancelled: false}
		});
	}
};

// Get names and types from Salesforce
const getNamesAndTypes = async (conn, category, source) => {
	const sobjectNames = (await describeGlobal(conn)).filter(sobjectTypeFilter(category, source));
	const sobjects = await describeSObjects(conn, sobjectNames);
	return {sobjectNames, sobjects};
};

// Describe global - get all SObject names
export const describeGlobal = async (conn) => {
	try {
		const {stdout} = await execAsync('sf data describe global --json');
		const result = JSON.parse(stdout);
		return result.result.sobjects.map((sobject) => ({
			name: sobject.name,
			custom: sobject.custom
		}));
	} catch (error) {
		logger.error('Failed to describe global:', error);
		throw error;
	}
};

// Describe SObjects - get detailed metadata
export const describeSObjects = async (conn, sobjectNames) => {
	try {
		const objects = [];
		const batchSize = 25; // Max batch size for Salesforce API

		for (let i = 0; i < sobjectNames.length; i += batchSize) {
			const batch = sobjectNames.slice(i, i + batchSize);
			const batchNames = batch.map((s) => s.name).join(',');

			const {stdout} = await execAsync(`sf data describe sobject --sobjects ${batchNames} --json`);
			const result = JSON.parse(stdout);

			if (Array.isArray(result.result)) {
				objects.push(...result.result.map(toMinimalSObject));
			} else {
				objects.push(toMinimalSObject(result.result));
			}
		}

		return {
			standard: objects.filter((o) => !o.custom),
			custom: objects.filter((o) => o.custom)
		};
	} catch (error) {
		logger.error('Failed to describe SObjects:', error);
		throw error;
	}
};

// Convert to minimal SObject representation
const toMinimalSObject = (describeSObject) => ({
	fields: describeSObject.fields ? describeSObject.fields.map(toMinimalSObjectField) : [],
	label: describeSObject.label,
	childRelationships: describeSObject.childRelationships,
	custom: describeSObject.custom,
	name: describeSObject.name,
	queryable: describeSObject.queryable
});

const toMinimalSObjectField = (describeField) => ({
	aggregatable: describeField.aggregatable,
	custom: describeField.custom,
	defaultValue: describeField.defaultValue,
	extraTypeInfo: describeField.extraTypeInfo,
	filterable: describeField.filterable,
	groupable: describeField.groupable,
	inlineHelpText: describeField.inlineHelpText,
	label: describeField.label,
	name: describeField.name,
	nillable: describeField.nillable,
	picklistValues: describeField.picklistValues,
	referenceTo: describeField.referenceTo,
	relationshipName: describeField.relationshipName,
	sortable: describeField.sortable,
	type: describeField.type
});

// Filter SObjects by category and source
const sobjectTypeFilter = (category, source) => (sobject) => {
	if (category === SObjectCategory.ALL) {
		return true;
	}
	if (category === SObjectCategory.STANDARD) {
		return !sobject.custom;
	}
	if (category === SObjectCategory.CUSTOM) {
		return sobject.custom;
	}
	return true;
};

// Generate faux Apex classes
export const generateFauxClasses = async (sobjects) => {
	const Indent = '    ';
	const ApexClassExtension = '.cls';
	const RelBaseFolder = ['.tooling', SOBJECTS_DIR];

	const results = [];

	for (const [category, objects] of Object.entries(sobjects)) {
		if (objects.length === 0) continue;

		const filePath = path.join(process.cwd(), ...RelBaseFolder, category === 'standard' ? STANDARDOBJECTS_DIR : CUSTOMOBJECTS_DIR);

		await resetOutputFolder(filePath);

		for (const obj of objects) {
			const result = await generateFauxClass(filePath, generateSObjectDefinition(obj));
			results.push(result);
		}
	}

	return results;
};

const resetOutputFolder = async (pathToClean) => {
	try {
		await fs.remove(pathToClean);
		await fs.ensureDir(pathToClean);
		return pathToClean;
	} catch (error) {
		throw new Error(`Failed to reset output folder ${pathToClean}: ${error instanceof Error ? error.message : String(error)}`);
	}
};

const fieldDeclToString = (decl) => `${commentToString(decl.comment)}${INDENT}${decl.modifier} ${decl.type} ${decl.name};`;

const commentToString = (comment) => {
	if (!comment) return '';
	const cleanComment = comment.replace(/(\/\*+\/)|(\/\*+)|(\*+\/)/g, '');
	return `${INDENT}/* ${cleanComment}\n${INDENT}*/\n`;
};

const generateFauxClassText = (definition) => {
	const declarations = Array.from(definition.fields || [])
		.sort((first, second) => (first.name || first.type > second.name || second.type ? 1 : -1))
		.filter((value, index, array) => !index || value.name !== array[index - 1].name);

	const className = definition.name;
	const classDeclaration = `public class ${className} {\n`;
	const declarationLines = declarations.map(fieldDeclToString).join('\n');
	const classConstructor = `${INDENT}public ${className} () \n    {\n    }\n`;

	return `// Generated by Salesforce Extension Pack\n${classDeclaration}${declarationLines}\n\n${classConstructor}}`;
};

const generateFauxClass = async (folderPath, definition) => {
	await fs.ensureDir(folderPath);
	const fauxClassPath = path.join(folderPath, `${definition.name}${APEX_CLASS_EXTENSION}`);
	await fs.writeFile(fauxClassPath, generateFauxClassText(definition));
	return fauxClassPath;
};

// Generate SObject definition
const generateSObjectDefinition = (sobject) => ({
	name: sobject.name,
	fields: sobject.fields.map((field) => ({
		modifier: 'public',
		type: getApexType(field.type),
		name: field.name,
		comment: field.inlineHelpText
	}))
});

const getApexType = (fieldType) => {
	const typeMap = {
		string: 'String',
		boolean: 'Boolean',
		int: 'Integer',
		double: 'Double',
		date: 'Date',
		datetime: 'Datetime',
		time: 'Time',
		picklist: 'String',
		multipicklist: 'String',
		reference: 'Id',
		textarea: 'String',
		url: 'String',
		email: 'String',
		phone: 'String',
		currency: 'Decimal',
		percent: 'Double',
		location: 'String',
		address: 'String',
		base64: 'String',
		encryptedstring: 'String',
		id: 'Id',
		combobox: 'String',
		datacategorygroupreference: 'String',
		anytype: 'Object'
	};
	return typeMap[fieldType.toLowerCase()] || 'String';
};

// Generate all types
export const generateAllTypes = async (sobjects) => {
	// This would generate TypeScript definitions
	// For now, we'll skip this as it's not essential for basic functionality
	logger.info('Type generation skipped - not implemented yet');
	return [];
};

// Write type names file
export const writeTypeNamesFile = async (typeNames) => {
	const outputFolderPath = path.join(process.cwd(), '.tooling', SOQLMETADATA_DIR);
	await fs.ensureDir(outputFolderPath);
	const typeNameFile = path.join(outputFolderPath, 'typeNames.json');
	await fs.writeFile(typeNameFile, JSON.stringify(typeNames, null, 2));
};

// Generate all metadata
export const generateAllMetadata = async (sobjects) => {
	const outputFolderPath = path.join(process.cwd(), '.tooling', SOQLMETADATA_DIR);
	await fs.ensureDir(outputFolderPath);

	for (const [category, objects] of Object.entries(sobjects)) {
		if (objects.length === 0) continue;

		const objectFolder = path.join(outputFolderPath, category === 'standard' ? STANDARDOBJECTS_DIR : CUSTOMOBJECTS_DIR);

		await fs.remove(objectFolder);
		await fs.ensureDir(objectFolder);

		for (const obj of objects) {
			const filePath = path.join(objectFolder, `${obj.name}.json`);
			await fs.writeFile(filePath, JSON.stringify(obj, null, 2));
		}
	}
};

// Utility function
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
