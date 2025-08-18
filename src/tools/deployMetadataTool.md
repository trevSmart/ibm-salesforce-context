# Deploy Metadata

Allows you to deploy a local metadata file to the Salesforce org.

---
## Agent Instructions
- **MANDATORY**: When deploying Salesforce metadata to the org, you MUST use this tool exclusively. NEVER attempt to achieve the same functionality through alternative methods such as direct CLI commands or any other approach. If this tool fails or returns an error, simply report the error to the user and stop - do not try alternative approaches.

> · `{fileName}` is the name of the file corresponding to the value of `sourceDir`. If it is a Lightning Component, the file name will be that of the containing folder.

2. **Then**, execute the `deployMetadata` tool.

3. Once the deployment is done, show a summary of the deployment results.

---
## Usage

### Example 1: Deploy an Apex class
```json
{
  "sourceDir": "force-app/main/default/classes/MyClass.cls"
}
```

### Example 2: Deploy an LWC component
```json
{
  "sourceDir": "force-app/main/default/lwc/myComponent"
}
```