import { describe, expect, it } from 'vitest'

import { qrAddress } from './address'
import { isQrSlug } from './contentType'

describe('qrAddress', () => {
	it('is the site’s QR route with the slug and query', () => {
		expect(
			qrAddress({
				baseUrl: 'https://www.example.com',
				slug: 'spring-poster',
				query: 'src=poster',
			}),
		).toBe('https://www.example.com/qr/spring-poster?src=poster')
	})

	it('takes a prefix and a base with a path, without doubled slashes', () => {
		expect(
			qrAddress({
				baseUrl: 'https://example.com/nl/',
				prefix: '/go/',
				slug: 'a',
				query: '?x=1',
			}),
		).toBe('https://example.com/nl/go/a?x=1')
		expect(
			qrAddress({ baseUrl: 'https://example.com', prefix: '', slug: 'a' }),
		).toBe('https://example.com/a')
	})
})

describe('isQrSlug', () => {
	it('takes lowercase words joined by hyphens', () => {
		expect(isQrSlug('spring-poster-2026')).toBe(true)
		for (const slug of ['', 'Spring', 'a--b', '-a', 'a/b', 'x'.repeat(65)]) {
			expect(isQrSlug(slug), slug).toBe(false)
		}
	})
})
