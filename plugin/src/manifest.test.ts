import { describe, expect, it } from 'vitest'

import { manifest } from './manifest'

describe('manifest', () => {
	it('edits the type’s slug with this plugin, and only text fields', () => {
		const { id, locations, contentTypes } = manifest('https://qr.example.com/')
		expect(locations).toEqual([{ type: 'field', fieldTypes: ['text'] }])
		const [type] = contentTypes
		const editors = type!.fields.flatMap((field) =>
			'editor' in field ? [[field.type, field.editor.plugin]] : [],
		)
		expect(editors).toEqual([['text', id]])
	})
})
