import qrcode from 'qrcode-generator'

// The quiet zone every scanner expects around a code, in modules.
export const QUIET_ZONE = 4

export type QrMatrix = {
	size: number
	isDark: (row: number, col: number) => boolean
}

// `M` survives a scuffed print without making the code much denser.
export const qrMatrix = (text: string): QrMatrix => {
	const code = qrcode(0, 'M')
	code.addData(text)
	code.make()
	return {
		size: code.getModuleCount(),
		isDark: (row, col) => code.isDark(row, col),
	}
}

// Each row's dark runs as [col, length], so a file draws one rectangle per
// run instead of one per module.
export const darkRuns = ({ size, isDark }: QrMatrix) =>
	Array.from({ length: size }, (_, row) => {
		const runs: [number, number][] = []
		for (let col = 0; col < size; col++) {
			if (!isDark(row, col)) continue
			const start = col
			while (col + 1 < size && isDark(row, col + 1)) col++
			runs.push([start, col - start + 1])
		}
		return runs
	})

export const toSvg = (matrix: QrMatrix) => {
	const side = matrix.size + QUIET_ZONE * 2
	const path = darkRuns(matrix)
		.flatMap((runs, row) =>
			runs.map(
				([col, length]) =>
					`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h${length}v1h-${length}z`,
			),
		)
		.join('')
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">` +
		`<rect width="${side}" height="${side}" fill="#fff"/>` +
		`<path d="${path}" fill="#000"/></svg>`
	)
}

const MM = 72 / 25.4
const points = (value: number) => Number(value.toFixed(3))

// One page the size of the code, `sizeMm` wide with its quiet zone, drawn
// as vector rectangles, so it prints sharp at any size.
export const toPdf = (matrix: QrMatrix, sizeMm = 50) => {
	const side = matrix.size + QUIET_ZONE * 2
	const page = sizeMm * MM
	const unit = page / side
	const rects = darkRuns(matrix)
		.flatMap((runs, row) =>
			runs.map(
				([col, length]) =>
					`${points((col + QUIET_ZONE) * unit)} ${points(page - (row + QUIET_ZONE + 1) * unit)} ${points(length * unit)} ${points(unit)} re`,
			),
		)
		.join('\n')
	const content = `0 g\n${rects}\nf\n`
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${points(page)} ${points(page)}] /Contents 4 0 R /Resources << >> >>`,
		`<< /Length ${content.length} >>\nstream\n${content}endstream`,
	]
	let pdf = '%PDF-1.4\n'
	const offsets = objects.map((object, index) => {
		const offset = pdf.length
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
		return offset
	})
	const xref = pdf.length
	pdf +=
		`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
		offsets
			.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
			.join('') +
		`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	return pdf
}

// A raster of at most `pixels` square, whole pixels per module so edges stay
// sharp, white behind the code (JPEG has no transparency).
export const toCanvas = (matrix: QrMatrix, pixels = 1024) => {
	const side = matrix.size + QUIET_ZONE * 2
	const unit = Math.max(1, Math.floor(pixels / side))
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = unit * side
	const context = canvas.getContext('2d')!
	context.fillStyle = '#fff'
	context.fillRect(0, 0, canvas.width, canvas.height)
	context.fillStyle = '#000'
	darkRuns(matrix).forEach((runs, row) => {
		for (const [col, length] of runs) {
			context.fillRect(
				(col + QUIET_ZONE) * unit,
				(row + QUIET_ZONE) * unit,
				length * unit,
				unit,
			)
		}
	})
	return canvas
}
