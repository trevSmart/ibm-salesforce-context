export const TestData = {
	salesforce: {
		testAccountId: '001KN00000Ilrd9YAB',
		testContactId: '003KN00000abcdeYAB',
		testApexRestResourceData: {
			apexClassOrRestResourceName: 'TestRestResource',
		},
		testUser: process.env.MCP_TEST_USER || 'missing test user in $MCP_TEST_USER',
	},
}
