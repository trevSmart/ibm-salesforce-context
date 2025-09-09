/**
 * Test configuration for MCP Salesforce tests
 * This file contains test data and configuration used by the test suite
 */

export const TEST_CONFIG = {
	salesforce: {
		// Test Account ID - using a realistic Salesforce ID format
		testAccountId: '001KN00000Ilrd9YAB',

		// Test Contact ID - using a realistic Salesforce ID format
		testContactId: '003KN00000abcdeYAB',

		// Test Apex REST Resource configuration
		testApexRestResourceData: {
			apexClassOrRestResourceName: 'TestRestResource'
		}
	}
};
