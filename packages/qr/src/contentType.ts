export const QR_PLUGIN_ID = 'qr-code'
export const QR_CONTENT_TYPE_ID = 'qrCode'

export const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'
export const isQrSlug = (value: string) =>
	value.length <= 64 && new RegExp(SLUG_PATTERN).test(value)

// A query string without its `?`: `src=poster&utm_campaign=spring`.
export const QUERY_PATTERN = '^[^?#\\s]*$'

// The type the plugin's manifest brings into a Space (Content's
// docs/adr/0041), in the shape of a model file's content type.
export const QR_CONTENT_TYPE = {
	apiId: QR_CONTENT_TYPE_ID,
	name: 'QR code',
	kind: 'data',
	description:
		'A QR code: the address it encodes is the site’s QR route with its slug, and a scan is logged before it redirects to the target.',
	fields: [
		{
			apiId: 'slug',
			name: 'Slug',
			type: 'text',
			description:
				'The code’s address on the site, such as spring-poster. Lowercase letters, digits and hyphens; changing it breaks codes already printed.',
			required: true,
			unique: true,
			maxLength: 64,
			pattern: SLUG_PATTERN,
			editor: { plugin: QR_PLUGIN_ID },
		},
		{
			apiId: 'query',
			name: 'Query',
			type: 'text',
			description:
				'Added to the code’s address and logged with each scan, such as src=poster. Optional.',
			maxLength: 256,
			pattern: QUERY_PATTERN,
		},
		{
			apiId: 'target',
			name: 'Target',
			type: 'link',
			description: 'Where a scan goes: a page of the site or any address.',
			required: true,
		},
	],
} as const

export type QrFields<TLink = unknown> = {
	slug: string
	query?: string | null
	target: TLink
}
