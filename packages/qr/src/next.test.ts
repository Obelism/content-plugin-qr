import { describe, expect, it, vi } from 'vitest'

import { createQrRoute, type QrRouteOptions } from './next'

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const entry = (target: unknown) => ({
	id: 'entry_1',
	contentType: 'qrCode',
	name: 'Spring poster',
	slug: null,
	path: null,
	paths: {},
	publishedAt: null,
	firstPublishedAt: null,
	updatedAt: '',
	fields: { slug: 'spring', query: 'src=poster', target },
})

const setup = (
	found: unknown,
	overrides: Partial<QrRouteOptions> = {},
	answer = new Response('{}', { status: 202 }),
) => {
	const getFirstEntry = vi.fn(async () => found)
	const fetcher = vi.fn(async () => answer)
	const onError = vi.fn()
	const route = createQrRoute({
		content: { getFirstEntry } as unknown as QrRouteOptions['content'],
		numbers: {
			organizationId: 'org_1',
			spaceId: 'space_1',
			token: 'numbers-token',
		},
		fetch: fetcher as unknown as typeof fetch,
		onError,
		...overrides,
	})
	const scan = (slug: string, init: RequestInit = {}, search = '?src=poster') =>
		route(
			new Request(`https://www.example.com/qr/${slug}${search}`, {
				headers: { 'user-agent': IPHONE, 'x-vercel-ip-country': 'NL' },
				...init,
			}),
			{ params: Promise.resolve({ slug }) },
		)
	return { scan, getFirstEntry, fetcher, onError }
}

const url = (address: string) => ({
	type: 'url',
	url: address,
	query: null,
	hash: null,
})

describe('createQrRoute', () => {
	it('logs the scan to Numbers, then redirects to the target', async () => {
		const { scan, getFirstEntry, fetcher } = setup(
			entry(url('https://shop.example.org/spring')),
		)
		const response = await scan('spring')

		expect(getFirstEntry).toHaveBeenCalledWith({
			contentType: 'qrCode',
			fields: { slug: 'spring' },
		})
		expect(response.status).toBe(302)
		expect(response.headers.get('location')).toBe(
			'https://shop.example.org/spring',
		)
		expect(response.headers.get('set-cookie')).toMatch(
			/^obelism_visitor_id=visi_[A-Z0-9]{26}; Path=\/; Max-Age=2592000; SameSite=Lax; Secure$/,
		)

		const [endpoint, init] = fetcher.mock.calls[0] as unknown as [
			string,
			RequestInit,
		]
		expect(endpoint).toBe('https://numbers.obelism.studio/api/log')
		expect(init.headers).toMatchObject({ token: 'numbers-token' })
		expect(JSON.parse(init.body as string)).toMatchObject({
			type: 'event',
			organizationId: 'org_1',
			spaceId: 'space_1',
			environment: 'production',
			event: 'qr_scan',
			scope: 'spring',
			visitor: 'new',
			device: 'mobile',
			os: 'ios',
			path: '/qr/spring',
			params: {
				slug: 'spring',
				query: 'src=poster',
				target: 'https://shop.example.org/spring',
				country: 'NL',
			},
		})
	})

	it('resolves a page link on the site, and keeps a returning visitor', async () => {
		const { scan, fetcher } = setup(
			entry({
				type: 'entry',
				entry: {
					id: 'entry_2',
					title: 'Spring',
					slug: 'spring',
					path: 'spring',
				},
				query: 'utm_source=qr',
				hash: null,
			}),
			{ link: { url: (path) => `/en/${path}` } },
		)
		const response = await scan('spring', {
			headers: {
				'user-agent': IPHONE,
				cookie: 'a=b; obelism_visitor_id=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
			},
		})
		expect(response.headers.get('location')).toBe(
			'https://www.example.com/en/spring?utm_source=qr',
		)
		expect(response.headers.get('set-cookie')).toBeNull()
		const body = JSON.parse(
			(fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
				.body as string,
		)
		expect(body.visitor).toBe('recurring')
	})

	it('still redirects when Numbers fails, and reports it', async () => {
		const { scan, onError } = setup(
			entry(url('https://example.org/')),
			{},
			new Response('nope', { status: 401 }),
		)
		const response = await scan('spring')
		expect(response.headers.get('location')).toBe('https://example.org/')
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ message: expect.stringContaining('401') }),
		)
	})

	it('logs the code’s own query, not what a visitor appends', async () => {
		const { scan, fetcher } = setup({
			...entry(url('https://example.org/')),
			fields: {
				slug: 'spring',
				query: 'src=poster&utm_campaign=spring',
				target: url('https://example.org/'),
			},
		})
		await scan('spring', {}, '?src=poster&utm_campaign=spring&email=a@b.c')
		const body = JSON.parse(
			(fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
				.body as string,
		)
		expect(body.params.query).toBe('src=poster&utm_campaign=spring')
		expect(body.utmCampaign).toBe('spring')
		expect(JSON.stringify(body)).not.toContain('a@b.c')
	})

	it('logs nothing and sets no cookie for link previews or without numbers', async () => {
		const preview = setup(entry(url('https://example.org/')))
		const previewed = await preview.scan('spring', {
			headers: { 'user-agent': 'WhatsApp/2.23.20.0 A' },
		})
		expect(preview.fetcher).not.toHaveBeenCalled()
		expect(previewed.headers.get('set-cookie')).toBeNull()

		const off = setup(entry(url('https://example.org/')), { numbers: false })
		const response = await off.scan('spring')
		expect(response.status).toBe(302)
		expect(response.headers.get('set-cookie')).toBeNull()
		expect(off.fetcher).not.toHaveBeenCalled()
	})

	it('logs without a cookie when asked to', async () => {
		const { scan, fetcher } = setup(entry(url('https://example.org/')), {
			visitorCookie: false,
		})
		const response = await scan('spring')
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	it('doesn’t redirect a code to itself', async () => {
		for (const target of [
			{ type: 'url', url: '', query: null, hash: 'top' },
			url('/qr/spring?again=1'),
		]) {
			const { scan, fetcher } = setup(entry(target))
			expect((await scan('spring')).status).toBe(404)
			expect(fetcher).not.toHaveBeenCalled()
		}
	})

	it('still redirects when the token never comes', async () => {
		const { scan, onError } = setup(entry(url('https://example.org/')), {
			numbers: {
				organizationId: 'org_1',
				token: () => new Promise(() => {}),
				timeout: 20,
			},
		})
		expect((await scan('spring')).headers.get('location')).toBe(
			'https://example.org/',
		)
		expect(onError).toHaveBeenCalled()
	})

	it('answers 404, or the fallback, for unknown codes and bad slugs', async () => {
		const missing = setup(null)
		expect((await missing.scan('nope')).status).toBe(404)
		expect((await missing.scan('Bad%20Slug')).status).toBe(404)
		expect(missing.getFirstEntry).toHaveBeenCalledTimes(1)

		const fallback = setup(null, { fallback: '/' })
		const response = await fallback.scan('nope')
		expect(response.headers.get('location')).toBe('https://www.example.com/')
	})
})
