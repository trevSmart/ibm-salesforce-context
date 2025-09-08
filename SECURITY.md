# Security Policy

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in IBM Salesforce Context, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing us at:

- **Email**: [security@ibm.com](mailto:security@ibm.com)
- **Subject**: "Security Vulnerability in IBM Salesforce Context MCP Server"

### What to Include

When reporting a security vulnerability, please include:

1. **Description**: A clear description of the vulnerability
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Impact**: Potential impact and severity assessment
4. **Environment**: Your environment details (Node.js version, OS, etc.)
5. **Proof of Concept**: If applicable, include a minimal proof of concept
6. **Suggested Fix**: If you have ideas for fixing the issue

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

## Security Considerations

### Authentication & Authorization

IBM Salesforce Context relies on Salesforce CLI authentication:

- **Salesforce CLI**: The server uses Salesforce CLI for org authentication
- **Access Tokens**: Temporary access tokens are managed by Salesforce CLI
- **Org Permissions**: The server operates with the permissions of the authenticated Salesforce user
- **No Credential Storage**: The server does not store Salesforce credentials locally

### Data Handling

- **Temporary Data**: Some data may be temporarily cached for performance
- **Sensitive Information**: Salesforce data is handled according to Salesforce's security policies
- **Logging**: Debug logs may contain sensitive information - ensure proper log level configuration
- **Network**: All communication with Salesforce uses HTTPS

### Transport Security

The server supports two transport modes:

#### STDIO Transport (Default)
- **Security**: Process-to-process communication
- **Isolation**: Runs within the MCP client process
- **Network**: No network exposure

#### HTTP Transport
- **Port Binding**: Binds to localhost by default
- **CORS**: No CORS headers set (local use only)
- **Authentication**: No built-in authentication (relies on local network security)
- **Recommendation**: Only use HTTP transport in trusted local environments

### Dependencies

We maintain security through:

- **Regular Updates**: Automated dependency updates via Dependabot
- **Vulnerability Scanning**: CodeQL analysis and security audits
- **Minimal Dependencies**: Only essential dependencies are included
- **Security Reviews**: Regular security reviews of dependencies

### Salesforce Integration Security

- **API Limits**: Respects Salesforce API limits and governor limits
- **Data Access**: Only accesses data the authenticated user has permission to view
- **Audit Trail**: Salesforce operations are logged in Salesforce's audit trail
- **Sandbox Support**: Supports both production and sandbox environments

## Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version of IBM Salesforce Context
2. **Salesforce CLI**: Keep Salesforce CLI updated to the latest version
3. **Environment**: Use in trusted environments only
4. **Logging**: Configure appropriate log levels for your environment
5. **Network**: When using HTTP transport, ensure local network security

### For Developers

1. **Dependencies**: Regularly update dependencies
2. **Code Review**: All code changes go through security review
3. **Testing**: Security-focused testing in CI/CD pipeline
4. **Documentation**: Keep security documentation updated

## Security Features

### Automated Security

- **CodeQL Analysis**: Advanced security scanning for JavaScript vulnerabilities
- **Dependabot**: Automated dependency updates with security focus
- **Security Audits**: Regular npm audit checks
- **Vulnerability Reporting**: Automatic issue creation for security concerns

### Development Security

- **Biome Integration**: Code quality and security linting
- **Testing**: Comprehensive test coverage including security scenarios
- **CI/CD**: Automated security checks in GitHub Actions
- **Pull Request Reviews**: Security-focused code reviews

## Known Security Considerations

### Salesforce CLI Dependency

- The server requires Salesforce CLI to be installed and authenticated
- Security depends on Salesforce CLI's authentication mechanisms
- Users should follow Salesforce CLI security best practices

### Local Network Exposure

- HTTP transport mode exposes the server on localhost
- No built-in authentication for HTTP transport
- Should only be used in trusted local environments

### Temporary File Handling

- Some operations may create temporary files
- Temporary files are cleaned up automatically
- Ensure proper file system permissions

## Security Updates

Security updates are released as:

- **Patch Releases**: For critical security fixes (e.g., 0.3.29 → 0.3.30)
- **Minor Releases**: For security improvements (e.g., 0.3.x → 0.4.0)
- **Major Releases**: For significant security changes (e.g., 0.x → 1.0.0)

## Contact

For security-related questions or concerns:

- **Security Issues**: [security@ibm.com](mailto:security@ibm.com)
- **General Questions**: Create a GitHub issue (non-security related)
- **Documentation**: Check this file and project documentation

## Acknowledgments

We appreciate the security research community and welcome responsible disclosure of security vulnerabilities. We will acknowledge security researchers who report valid vulnerabilities (with their permission).

---

**Last Updated**: January 2025
**Version**: 1.0
