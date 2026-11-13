export const DEFAULT_PREFIX = '/qr'

export type QrAddressOptions = {
	// The site's origin, such as https://www.example.com.
	baseUrl: string
	// The route the site answers codes on; `/qr` by default.
	prefix?: string | undefined
	slug: string
	query?: string | null | undefined
}

// What the code encodes: `{baseUrl}{prefix}/{slug}?{query}`.
export const qrAddress = ({
	baseUrl,
	prefix = DEFAULT_PREFIX,
	slug,
	query,
}: QrAddressOptions) => {
	const url = new URL(baseUrl)
	const path = `/${prefix}/${encodeURIComponent(slug)}`.replace(/\/{2,}/g, '/')
	url.pathname = `${url.pathname.replace(/\/+$/, '')}${path}`
	url.search = query?.replace(/^\?/, '') ?? ''
	url.hash = ''
	return url.href
}
