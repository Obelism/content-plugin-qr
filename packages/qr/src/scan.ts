import {
	createVisitorId,
	DEFAULT_ENDPOINT,
	detectDevice,
	isVisitorId,
	LEGACY_VISITOR_COOKIE,
	VISITOR_COOKIE,
} from '@obelism/numbers-sdk'

export type NumbersEnvironment = 'develop' | 'staging' | 'production'

export type NumbersOptions = {
	organizationId: string
	spaceId?: string | undefined
	environment?: NumbersEnvironment | undefined
	// A Numbers API token of the environment, or a host's OIDC token
	// (Vercel's) from a connected deployment, sent without an Origin.
	token: string | (() => string | Promise<string>)
	endpoint?: string | undefined
	// How long a scan may hold up the redirect, in milliseconds.
	timeout?: number | undefined
}

export const SCAN_EVENT = 'qr_scan'

const VISITOR_COOKIE_DAYS = 30

// Link previews and crawlers fetch the address too; they aren't scans.
const BOT =
	/bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|curl|wget/i
export const isBot = (userAgent: string) => !userAgent || BOT.test(userAgent)

const readCookie = (header: string | null, name: string) =>
	header
		?.split(/;\s*/)
		.find((pair) => pair.split('=')[0] === name)
		?.slice(name.length + 1) ?? ''

// The visitor as the Numbers and Improve SDKs keep them, so a scan and the
// pages after it are one visitor.
export const scanVisitor = (request: Request) => {
	const cookies = request.headers.get('cookie')
	const stored = [VISITOR_COOKIE, LEGACY_VISITOR_COOKIE]
		.map((name) => decodeURIComponent(readCookie(cookies, name)))
		.find(isVisitorId)
	if (stored) return { id: stored, recurring: true, cookie: null }
	const id = createVisitorId()
	const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
	return {
		id,
		recurring: false,
		cookie: `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${VISITOR_COOKIE_DAYS * 86_400}; SameSite=Lax${secure}`,
	}
}

const UTM = {
	utmSource: 'utm_source',
	utmMedium: 'utm_medium',
	utmCampaign: 'utm_campaign',
} as const

export type Scan = {
	slug: string
	target: string
	visitor: { id: string; recurring: boolean }
}

// The body /api/log takes for one event.
export const scanEvent = (
	request: Request,
	scan: Scan,
	numbers: Pick<NumbersOptions, 'organizationId' | 'spaceId' | 'environment'>,
) => {
	const url = new URL(request.url)
	const device = detectDevice(request.headers.get('user-agent') ?? '')
	const country =
		request.headers.get('x-vercel-ip-country') ??
		request.headers.get('cf-ipcountry')
	const utm = Object.fromEntries(
		Object.entries(UTM).flatMap(([key, name]) => {
			const value = url.searchParams.get(name)
			return value ? [[key, value.slice(0, 256)]] : []
		}),
	)
	return {
		type: 'event',
		organizationId: numbers.organizationId,
		...(numbers.spaceId && { spaceId: numbers.spaceId }),
		environment: numbers.environment ?? 'production',
		visitorId: scan.visitor.id,
		visitor: scan.visitor.recurring ? 'recurring' : 'new',
		pointer: device.pointer,
		device: device.device,
		browser: device.browser,
		os: device.os,
		screen: '',
		event: SCAN_EVENT,
		scope: scan.slug,
		params: {
			slug: scan.slug,
			query: url.search.slice(1, 1025) || null,
			target: scan.target.slice(0, 1024),
			// Numbers places events by the request's own country, which here
			// is the server's.
			...(country && { country }),
		},
		path: url.pathname.slice(0, 1024),
		referrer: request.headers.get('referer')?.slice(0, 1024) ?? null,
		...utm,
	}
}

// Sends the scan to Numbers, waiting at most `timeout`: a scan that can't
// be logged still redirects.
export const logScan = async (
	request: Request,
	scan: Scan,
	numbers: NumbersOptions,
	fetcher: typeof fetch = fetch,
) => {
	const token =
		typeof numbers.token === 'function' ? await numbers.token() : numbers.token
	const response = await fetcher(numbers.endpoint ?? DEFAULT_ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/json', token },
		body: JSON.stringify(scanEvent(request, scan, numbers)),
		signal: AbortSignal.timeout(numbers.timeout ?? 1500),
		cache: 'no-store',
	})
	if (!response.ok) {
		throw new Error(
			`Numbers refused the scan (${response.status}): ${await response.text()}`,
		)
	}
}
