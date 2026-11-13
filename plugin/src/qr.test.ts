import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'

import {
	QUIET_ZONE,
	darkRuns,
	qrMatrix,
	toPdf,
	toSvg,
	type QrMatrix,
} from './qr'

const TEXT = 'https://www.example.com/qr/spring-poster?src=poster'

// The matrix as a scanner sees a photo of it: RGBA, 4 px a module.
const scan = (matrix: QrMatrix) => {
	const unit = 4
	const side = (matrix.size + QUIET_ZONE * 2) * unit
	const pixels = new Uint8ClampedArray(side * side * 4).fill(255)
	darkRuns(matrix).forEach((runs, row) => {
		for (const [col, length] of runs) {
			for (let y = 0; y < unit; y++) {
				for (let x = 0; x < length * unit; x++) {
					const at =
						(((row + QUIET_ZONE) * unit + y) * side +
							(col + QUIET_ZONE) * unit +
							x) *
						4
					pixels.fill(0, at, at + 3)
				}
			}
		}
	})
	return jsQR(pixels, side, side)?.data
}

describe('the code', () => {
	it('scans back to the address', () => {
		expect(scan(qrMatrix(TEXT))).toBe(TEXT)
	})

	it('covers every dark module with its runs', () => {
		const matrix = qrMatrix(TEXT)
		const dark = darkRuns(matrix)
			.flat()
			.reduce((sum, [, n]) => sum + n, 0)
		let expected = 0
		for (let row = 0; row < matrix.size; row++)
			for (let col = 0; col < matrix.size; col++)
				if (matrix.isDark(row, col)) expected++
		expect(dark).toBe(expected)
	})
})

describe('toSvg', () => {
	it('is a square with the quiet zone, on white', () => {
		const matrix = qrMatrix(TEXT)
		const side = matrix.size + QUIET_ZONE * 2
		const svg = toSvg(matrix)
		expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`)
		expect(svg).toContain('fill="#fff"')
		expect(svg).toMatch(/<path d="(M\d+ \d+h\d+v1h-\d+z)+" fill="#000"\/>/)
	})
})

describe('toPdf', () => {
	it('is one page of the asked size, with a cross-reference that points at each object', () => {
		const pdf = toPdf(qrMatrix(TEXT), 50)
		const points = Number(((50 * 72) / 25.4).toFixed(3))
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true)
		expect(pdf).toContain(`/MediaBox [0 0 ${points} ${points}]`)
		expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)

		const startxref = Number(pdf.match(/startxref\n(\d+)/)![1])
		expect(pdf.slice(startxref).startsWith('xref')).toBe(true)
		const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map(([, at]) =>
			Number(at),
		)
		expect(offsets).toHaveLength(4)
		offsets.forEach((offset, index) =>
			expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true),
		)
		const length = Number(pdf.match(/\/Length (\d+)/)![1])
		const stream = pdf.match(/>>\nstream\n([\s\S]*?)endstream/)![1]!
		expect(stream.length).toBe(length)
	})
})
