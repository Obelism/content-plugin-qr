import { connect, CONTENT_ORIGIN, type Plugin } from '@obelism/content-plugin'
import { isQrSlug, qrAddress } from '../../packages/qr/src/index'

import { qrMatrix, toCanvas, toPdf, toSvg, type QrMatrix } from './qr'

const element = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T
const root = document.querySelector<HTMLElement>('.plugin')!
const status = element<HTMLParagraphElement>('status')
const input = element<HTMLInputElement>('slug')
const address = element<HTMLParagraphElement>('address')
const code = element<HTMLElement>('code')
const preview = element<HTMLDivElement>('preview')

// `?content=http://localhost:8789` builds against a local Content; nothing
// but localhost may stand in for content.obelism.studio.
const contentOrigin = () => {
	const asked = new URLSearchParams(location.search).get('content')
	try {
		const url = new URL(asked ?? '')
		if (
			url.protocol === 'http:' &&
			(url.hostname === 'localhost' || url.hostname === '127.0.0.1')
		)
			return url.origin
	} catch {}
	return CONTENT_ORIGIN
}

const normalize = (value: string) =>
	value
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')

let current: { slug: string; matrix: QrMatrix } | null = null

const show = (message: string | null) => {
	status.textContent = message ?? ''
	status.hidden = !message
}

const render = (plugin: Plugin) => {
	const { context } = plugin
	document.documentElement.dataset.theme = context.theme
	input.disabled = context.readOnly
	const slug = typeof context.value === 'string' ? context.value : ''
	if (document.activeElement !== input) input.value = slug

	const baseUrl = context.config.baseUrl
	const prefix = context.config.prefix
	const query = context.entry?.draft.query
	current = null
	code.hidden = true
	address.textContent = ''
	root.dataset.state = 'ready'

	if (typeof baseUrl !== 'string' || !URL.canParse(baseUrl)) {
		return show(
			'Set the site address for the QR code plugin in Settings › Preview and site › Plugins.',
		)
	}
	if (!slug) return show('Type a slug to make the code.')
	if (!isQrSlug(slug)) {
		return show('Lowercase letters, digits and single hyphens, at most 64.')
	}

	const text = qrAddress({
		baseUrl,
		prefix: typeof prefix === 'string' && prefix ? prefix : undefined,
		slug,
		query: typeof query === 'string' ? query : null,
	})
	const matrix = qrMatrix(text)
	current = { slug, matrix }
	show(null)
	address.textContent = text
	preview.innerHTML = toSvg(matrix)
	code.hidden = false
}

const save = (blob: Blob, name: string) => {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = name
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const download = async (format: string) => {
	if (!current) return
	const { slug, matrix } = current
	const name = `qr-${slug}.${format}`
	if (format === 'svg') {
		return save(new Blob([toSvg(matrix)], { type: 'image/svg+xml' }), name)
	}
	if (format === 'pdf') {
		return save(new Blob([toPdf(matrix)], { type: 'application/pdf' }), name)
	}
	const type = format === 'jpg' ? 'image/jpeg' : 'image/png'
	const blob = await new Promise<Blob | null>((resolve) =>
		toCanvas(matrix).toBlob(resolve, type, 0.95),
	)
	if (blob) save(blob, name)
}

const start = async () => {
	let plugin: Plugin
	try {
		// The document is never shorter than the frame, so its height can't
		// shrink the frame; the content's can.
		plugin = await connect({ origin: contentOrigin(), autoHeight: false })
	} catch {
		root.dataset.state = 'standalone'
		return show(
			'This is the QR code plugin for Obelism Content. Register manifest.json from this address in Content.',
		)
	}
	new ResizeObserver(() =>
		plugin.setHeight(Math.ceil(root.getBoundingClientRect().height)),
	).observe(root)
	const update = () => render(plugin)
	plugin.onValue(update)
	plugin.onEntry(update)
	plugin.onContext(update)
	update()

	input.addEventListener('input', () => {
		const slug = normalize(input.value)
		if (slug !== input.value) input.value = slug
		plugin.setValue(slug)
	})
	for (const button of code.querySelectorAll<HTMLButtonElement>(
		'button[data-format]',
	)) {
		button.addEventListener('click', () => {
			void download(button.dataset.format!).catch(() =>
				plugin.toast('The download didn’t work', 'negative'),
			)
		})
	}
}

void start()
