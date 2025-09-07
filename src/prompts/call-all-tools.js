export const toolsBasicRunPromptDefinition = {
	title: 'Test tools',
	description: 'Test tools prompt for testing purposes',
	argsSchema: {}
};

export function toolsBasicRunPromptHandler() {
	return {
		messages: [
			{
				role: 'user',
				content: {
					type: 'text',
					text: `For development purposes, performs a comprehensive, safe run of most of the server's tools as a sanity check.

Objective: call the maximum number of tools possible only with read actions or actions that don't persist changes. Avoid any action that creates, updates, deploys, or deletes metadata or data.

Include (in this recommended order):

1) salesforceContextUtils (only safe actions)
   - action: "getCurrentDatetime"
   - action: "getOrgAndUserDetails"
   - action: "getState" (only to validate that basic state is returned; doesn't change anything)
   - action: "loadRecordPrefixesResource" (only reads metadata via Apex and loads a resource in memory)

2) getRecentlyViewedRecords
   - Save the first Id returned (if any) for later tests.

3) executeSoqlQuery (light read query)
   - Recommended query: "SELECT Id, Name FROM Account ORDER BY LastModifiedDate DESC LIMIT 5".
   - If the Account object doesn't exist in the org, try with "Contact" or "User".
   - Save the first Id returned for later tests.

4) getRecord
   - Use the Id obtained in (2). If (2) doesn't return anything, use an Id from (3).

5) describeObject (multiple variants to test different options)
   - sObjectName: "Account" (or an available standard)
   - includeFields: false, includePicklistValues: false (light test)
   - Second call: includeFields: true, includePicklistValues: false (with fields but no picklists)
   - Third call: includeFields: false, includePicklistValues: true (no fields but with picklists)
   - Fourth call: includeFields: true, includePicklistValues: true (full metadata)

6) describeObject with Tooling API
   - sObjectName: "ApexClass", useToolingApi: true
   - This tests the Tooling API functionality

7) executeSoqlQuery with Tooling API
   - query: "SELECT Id, Name FROM ApexClass LIMIT 3", useToolingApi: true
   - This validates Tooling API queries work correctly

8) executeSoqlQuery with different objects
   - Try "SELECT Id, Name FROM Contact LIMIT 3" if Contact exists
   - Try "SELECT Id, Name FROM User LIMIT 3" as fallback
   - Save IDs for potential reuse

9) apexDebugLogs (only non-mutating actions)
   - action: "on"
   - action: "off"
   - action: "status"
   - action: "list"
   - If logs are available, action: "get" with the first Id returned by "list" (if none, skip this call)

10) getSetupAuditTrail
    - lastDays: 7 (or 30). Don't pass parameters that filter by user if not necessary.

11) getApexClassCodeCoverage
    - First, with executeSoqlQuery, get up to 3 ApexClass names: "SELECT Name FROM ApexClass WHERE NamespacePrefix = NULL LIMIT 3".
    - Pass these names to the tool even if they don't have coverage; the tool will return the current status.

12) executeAnonymousApex (without persistent changes)
    - apexCode: "System.debug('MCP safe test ping');"
    - mayModify: false

13) runApexTest (optional, only if there are @isTest classes and to execute a single brief test)
    - With executeSoqlQuery, search for a test class: "SELECT Name, Body FROM ApexClass WHERE Status = 'Active' AND NamespacePrefix = NULL ORDER BY LastModifiedDate DESC" and filter locally by Body containing "@isTest".
    - If you find one, call runApexTest with classNames: [className]. If none, skip the test execution.
    - Note: Test execution in Salesforce doesn't persist DML outside of test context.

14) Test cache functionality
    - After the first describeObject calls, make another call to the same object with the same parameters to verify caching works
    - Check if the response indicates it was served from cache

15) Test error handling
    - Try describeObject with a non-existent object name to see how errors are handled
    - Try executeSoqlQuery with an invalid query to test error responses

Important: Don't call any of the following tools/actions as they can modify the org or workspace:
   - createMetadata (all actions)
   - deployMetadata
   - Any tool or action that creates, updates, or deletes data/metadata
   - salesforceContextUtils: "reportIssue" (makes an external call; not necessary for this test)
   - dmlOperation (all actions - creates/updates/deletes records)

Desired behavior: for each call, validate that the tool responds without error and, when applicable, reuse previous results (e.g., Id retrieved in getRecentlyViewedRecords) to feed the next tool. If any call cannot complete (e.g., non-existent object, no logs available), log it and continue with the rest of the tests without failing.

Integration strategy: Maximize the reuse of data between tools:
- Use IDs from getRecentlyViewedRecords or executeSoqlQuery for getRecord calls
- Test the same objects multiple times with different describeObject options
- Test both regular API and Tooling API variants where applicable

Final summary: return a comprehensive summary with the status of each call (success/error) and any relevant notes (e.g., how many records returned, first Id used, first log obtained, cache hits, Tooling API functionality, etc.). Include any interesting findings about the org's data structure or tool behavior.

**MANDATORY SUMMARY REQUIREMENTS:**
At the end of your execution, you MUST provide a structured summary with:

1. **Tool Execution Count**: Total number of tools executed during the test run
2. **Success/Error Count**:
   - Number of successful tool executions (OK)
   - Number of failed tool executions (KO)
3. **Excluded Tools List**: Complete list of tools that were intentionally NOT included in this test battery, explaining why each was excluded (e.g., "createMetadata - excluded because it creates persistent changes", "dmlOperation - excluded because it modifies data", etc.)

This summary helps verify that the test covered the maximum safe tools while avoiding any destructive operations.`
				}
			}
		]
	};
}
