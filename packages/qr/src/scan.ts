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
	// (Vercel's) from a deployment connected with Improve on.
	token: string | (() => string | Promise<string>)
	endpoint?: string | undefined
	// How long a scan may hold up the redirect, in milliseconds.
	timeout?: number | undefined
}

export const SCAN_EVENT = 'qr_scan'

const VISITOR_COOKIE_DAYS = 30

// Link previews and crawlers fetch the address too; they aren't scans.
const BOT =
	/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|embedly|headless|curl|wget/i
export const isBot = (userAgent: string) => !userAgent || BOT.test(userAgent)

// By code points: half a surrogate pair would make Numbers refuse the event.
const clip = (value: string, max: number) =>
	Array.from(value).slice(0, max).join('')

const readCookie = (header: string | null, name: string) => {
	const raw =
		header
			?.split(/;\s*/)
			.find((pair) => pair.split('=')[0] === name)
			?.slice(name.length + 1) ?? ''
	try {
		return decodeURIComponent(raw)
	} catch {
		return ''
	}
}

// The visitor as the Numbers and Improve SDKs keep them, so a scan and the
// pages after it are one visitor. `remember: false` sets no cookie.
export const scanVisitor = (request: Request, remember = true) => {
	const cookies = request.headers.get('cookie')
	const stored = [VISITOR_COOKIE, LEGACY_VISITOR_COOKIE]
		.map((name) => readCookie(cookies, name))
		.find(isVisitorId)
	if (stored) return { id: stored, recurring: true, cookie: null }
	const id = createVisitorId()
	const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
	return {
		id,
		recurring: false,
		cookie: remember
			? `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${VISITOR_COOKIE_DAYS * 86_400}; SameSite=Lax${secure}`
			: null,
	}
}

const UTM = {
	utmSource: 'utm_source',
	utmMedium: 'utm_medium',
	utmCampaign: 'utm_campaign',
} as const

export type Scan = {
	slug: string
	// The code's own query field, not what the request carries: a visitor
	// can append anything to an address.
	query: string | null
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
	const codeQuery = new URLSearchParams(scan.query ?? '')
	const utm = Object.fromEntries(
		Object.entries(UTM).flatMap(([key, name]) => {
			const value = codeQuery.get(name)
			return value ? [[key, clip(value, 256)]] : []
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
			query: scan.query ? clip(scan.query, 256) : null,
			target: clip(scan.target, 1024),
			// Numbers places events by the request's own country, which here
			// is the server's.
			...(country && { country: clip(country, 8) }),
		},
		path: clip(url.pathname, 1024),
		referrer: request.headers.has('referer')
			? clip(request.headers.get('referer')!.split(/[?#]/)[0]!, 1024)
			: null,
		...utm,
	}
}

// Sends the scan to Numbers, waiting at most `timeout`, the token included:
// a scan that can't be logged still redirects.
export const logScan = async (
	request: Request,
	scan: Scan,
	numbers: NumbersOptions,
	fetcher: typeof fetch = fetch,
) => {
	const signal = AbortSignal.timeout(numbers.timeout ?? 1500)
	const source = numbers.token
	const token =
		typeof source === 'function'
			? await new Promise<string>((resolve, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), {
						once: true,
					})
					Promise.resolve(source()).then(resolve, reject)
				})
			: source
	const response = await fetcher(numbers.endpoint ?? DEFAULT_ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/json', token },
		body: JSON.stringify(scanEvent(request, scan, numbers)),
		signal,
		cache: 'no-store',
	})
	if (!response.ok) {
		throw new Error(
			`Numbers refused the scan (${response.status}): ${await response.text()}`,
		)
	}
}
