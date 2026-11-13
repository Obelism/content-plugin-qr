import { linkHref, type Link, type LinkHrefOptions } from '@obelism/content'
import type { ContentClient, Entry } from '@obelism/content'

import { isQrSlug, QR_CONTENT_TYPE_ID, type QrFields } from './contentType'
import { isBot, logScan, scanVisitor, type NumbersOptions } from './scan'

export { isBot, SCAN_EVENT, scanEvent, type NumbersOptions } from './scan'

export type QrRouteOptions = {
	content: Pick<ContentClient, 'getFirstEntry'>
	// Where scans are logged; `false` to only redirect.
	numbers: NumbersOptions | false
	contentType?: string | undefined
	// How a page, product or collection link becomes an address on the site
	// (`linkHref` of @obelism/content).
	link?: LinkHrefOptions | undefined
	// Where a code that doesn't exist, or has no target, goes; a 404 without.
	fallback?: string | undefined
	// Never permanent: a browser would keep a cached 301 or 308, skipping
	// the log and a changed target.
	status?: 302 | 303 | 307 | undefined
	// The shared visitor cookie for a new visitor, so the scan and the pages
	// after it are one visitor; `false` without consent.
	visitorCookie?: boolean | undefined
	onError?: ((error: unknown) => void) | undefined
	fetch?: typeof fetch | undefined
}

type Params = { slug?: string | string[] }
type RouteContext = { params: Params | Promise<Params> }

const redirect = (location: string, status: number, cookie?: string | null) => {
	const headers = new Headers({
		location,
		'cache-control': 'private, no-store',
		'referrer-policy': 'no-referrer-when-downgrade',
	})
	if (cookie) headers.append('set-cookie', cookie)
	return new Response(null, { status, headers })
}

// The route a QR code's address is answered by:
//
//   // app/qr/[slug]/route.ts
//   export const GET = createQrRoute({ content, numbers: { … } })
//
// It finds the published code by its slug, logs the scan to Numbers, then
// redirects to its target. The scan is sent before the redirect, since the
// target may be another site that Numbers never sees.
export const createQrRoute = (options: QrRouteOptions) => {
	const status = options.status ?? 302
	const report = options.onError ?? ((error) => console.error(error))

	return async (request: Request, context: RouteContext) => {
		const { slug: param } = await context.params
		const slug = Array.isArray(param) ? param.join('/') : (param ?? '')
		const notFound = () =>
			options.fallback
				? redirect(new URL(options.fallback, request.url).href, 302)
				: new Response('Not found', {
						status: 404,
						headers: { 'cache-control': 'private, no-store' },
					})
		if (!isQrSlug(slug)) return notFound()

		let entry: Entry<QrFields<Link | null>> | null
		try {
			entry = await options.content.getFirstEntry<Entry<QrFields<Link | null>>>(
				{
					contentType: options.contentType ?? QR_CONTENT_TYPE_ID,
					fields: { slug },
				},
			)
		} catch (error) {
			report(error)
			return notFound()
		}
		const href = entry && linkHref(entry.fields.target, options.link)
		if (!entry || !href) return notFound()
		const target = new URL(href, request.url)
		// A target of only `#…`, or of this route, would send the scan back
		// here.
		const here = new URL(request.url)
		if (target.origin === here.origin && target.pathname === here.pathname) {
			return notFound()
		}

		if (!options.numbers || isBot(request.headers.get('user-agent') ?? '')) {
			return redirect(target.href, status)
		}
		const visitor = scanVisitor(request, options.visitorCookie !== false)
		await logScan(
			request,
			{
				slug,
				query: entry.fields.query || null,
				target: target.href,
				visitor,
			},
			options.numbers,
			options.fetch,
		).catch(report)
		return redirect(target.href, status, visitor.cookie)
	}
}
