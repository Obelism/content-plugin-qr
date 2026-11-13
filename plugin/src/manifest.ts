import {
	DEFAULT_PREFIX,
	QR_CONTENT_TYPE,
	QR_PLUGIN_ID,
} from '../../packages/qr/src/index'

// What an admin registers in Content (Plugins), by the URL of the
// manifest.json the build writes next to the page.
export const manifest = (url: string) => ({
	id: QR_PLUGIN_ID,
	name: 'QR code',
	url,
	locations: [{ type: 'field', fieldTypes: ['text'] }],
	permissions: ['entry:read'],
	config: {
		type: 'object',
		properties: {
			baseUrl: {
				type: 'string',
				title: 'Site address',
				description:
					'The site that answers the codes in this environment, such as https://www.example.com',
			},
			prefix: {
				type: 'string',
				title: 'Route',
				description: `Where the site answers codes; ${DEFAULT_PREFIX} when empty`,
			},
		},
		required: ['baseUrl'],
	},
	contentTypes: [QR_CONTENT_TYPE],
})
