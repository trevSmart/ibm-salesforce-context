# IBM Salesforce Context server utilities Tool

Allows you to execute utility actions like:
  - getOrgAndUserDetails: Obtains the details of the Salesforce organization and the current user (Id, name, URL, profile, etc.).
  - getState: Returns the internal state of the MCP server
  - clearCache: Clears the internal cache of the MCP server.
  - loadRecordPrefixesResource: Loads an exhaustive list of the prefixes used for Salesforce records as an MCP resource.
  - getCurrentDatetime: Returns the current date and time.
  - reportIssue: Reports a bug or issue with the MCP server to the product team.

---
## Agent Instructions
- **MANDATORY**: When executing utility actions on the IBM Salesforce MCP server, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct Salesforce CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

- To get the user name, use the "getOrgAndUserDetails" action of this tool.

- Use only the following allowed action values:
  - **"getOrgAndUserDetails"**:
    - Obtains the details of the current target Salesforce organization (alias, instance URL, etc.) and the current user (Name, User Id, username, etc...).
  - **"getState"**:
    - Returns the current internal state of the MCP server (log level, workspace path, connected MCP client information, list of MCP resources, etc.).
  - **"clearCache"**:
    - Clears the internal cache of the MCP server.
    - **IMPORTANT**: Only execute this action if the user explicitly and unambiguously asks to "clear the cache" in their request. For example, if user asks to "refresh state", since the user is not mentioning "cache" explicitly in their request, you should not clear the cache, instead you should retrieve the current state of the IBM Salesforce MCP server using the "getState" action.
  - **"loadRecordPrefixesResource"**:
    - Loads an exhaustive list of the record prefixes used for Salesforce objects as an MCP resource. Only show the prefixes relevant to the user. If the user has not specified which object he wants to work with, ask him to specify the object name.
  - **"getCurrentDatetime"**:
    - Returns the current date and time.
  - **"reportIssue"**:
    - Reports a bug or issue with the MCP server to the product team.
    - **Parameters** (only for this action):
      - *issueDescription*: Required. The description of the issue and context from recent conversation messages
      - *issueToolName*: Optional. The name of the tool that is affected by the issue. If not provided, the tool will try to detect the tool name from the issue description.
    - **User confirmation**: Don't ask for user confirmation, the tool automatically manages the user confirmation step.

- **CRITICAL**: In your response, enclose API names in backticks to avoid breaking markdown formatting.

---
## Usage

### Parameters
- **`action`** (required): The action to perform: "clearCache", "getCurrentDatetime", "getState", "reportIssue", "loadRecordPrefixesResource", "getOrgAndUserDetails"
- **`issueDescription`** (optional): Detailed description of the issue and context from recent conversation messages (required for reportIssue action)
- **`issueToolName`** (optional): Name of the tool that failed or needs improvement (optional)

---
## Output Format

### Successful Issue Report
When an issue is successfully reported, the tool returns:
- **Status**: Success confirmation
- **Issue Details**: Type, title, tool, severity, and date
- **Issue Reference**: Issue identifier for reference

---
## Usage Examples

### Example 1: Clear the cache
```json
{
  "action": "clearCache"
}
```

### Example 2: Get the current date and time
```json
{
  "action": "getCurrentDatetime"
}
```

### Example 3: Get the internal state of the MCP server
```json
{
  "action": "getState"
}
```

### Example 4: Report a tool error
```json
{
  "action": "reportIssue",
  "issueDescription": "When trying to create records, the DML operation tool fails with insufficient permissions",
  "issueToolName": "dmlOperation"
}
```

### Example 5: Report a tool error (tool name auto-detected)
```json
{
  "action": "reportIssue",
  "issueDescription": "When trying to get the Setup Audit Trail, the tool fails with 'path argument must be of type string' error"
}
```

### Example 6: Report an improvement request
```json
{
  "action": "reportIssue",
  "issueDescription": "The DML tool currently only supports single operations. Adding bulk operation support would improve performance for large datasets.",
  "issueToolName": "dmlOperation"
}
```

### Example 7: Load the record prefixes resource
```json
{
  "action": "loadRecordPrefixesResource"
}
```

### Example 8: Get org and user details
```json
{
  "action": "getOrgAndUserDetails"
}
```

---
## Notes
- The tool provides essential utility functions for the MCP server.
- Issue reporting includes automatic tool name detection when not specified.
- Cache clearing should only be used when explicitly requested by the user.
- The tool automatically handles authentication and state management.