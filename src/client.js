import semver from 'semver';

class Client {
	clientInfo;

	capabilities;

	protocolVersion;

	roots = {};

	constructor() {
		this.clientInfo = {name: 'unknown'};
		this.capabilities = {};
		this.protocolVersion = '';
	}

	initialize(params = {}) {
		this.clientInfo = params?.clientInfo || {name: 'unknown'};
		this.capabilities = params?.capabilities || {};
		this.protocolVersion = params?.protocolVersion || '';
	}

	/**
	 * Get the friendly name of the client based on clientInfo.name
	 * @returns {string} Friendly client name
	 */
	getClientName() {
		const clientName = this.clientInfo?.name || 'unknown';

		// Client name mapping
		const clientMapping = {
			'cursor-vscode': 'Cursor',
			'Visual Studio Code': 'Visual Studio Code',
			'Visual Studio Code - Insiders': 'Visual Studio Code - Insiders',
			'microscope': 'MiCroscoPe'
		};

		return clientMapping[clientName] || clientName;
	}

	getClientVersion() {
		return this.clientInfo?.version;
	}

	/**
	 * Check if the current client matches any of the provided client names
	 * @param {string[]} clientNames - Array of client names to check against
	 * @returns {boolean} True if current client matches any of the provided names
	 */
	is(clientNames) {
		if (!Array.isArray(clientNames)) {
			clientNames = [clientNames];
		}

		const currentClientName = this.getClientName().toLowerCase();
		return clientNames.some((name) => currentClientName.includes(name.toLowerCase()));
	}

	// Client support for the following features is not included in the capabilities
	// declared by the client. Therefore, we deduce them from other information provided.
	supportsCapability(capabilityName) {
		switch (capabilityName) {
			case 'resources':
			case 'embeddedResources':
			case 'logging':
				return Boolean(this.capabilities?.logging) || this.is(['Visual Studio Code', 'Cursor', 'microscope']);

			case 'resource_links':
				return this.is(['MiCroscoPe']) || (this.is(['Visual Studio Code']) && semver.gte(this.clientInfo.version, '1.103.0'));

			default:
				return Boolean(this.capabilities?.[capabilityName]);
		}
	}
}

const client = new Client();
export default client;
