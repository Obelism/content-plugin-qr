import { defineConfig } from 'vite'

import { manifest } from './src/manifest'

// The manifest names the address the page is served from, so it is only
// written when that is known (`npm run deploy` requires it).
const url = process.env.PLUGIN_URL

export default defineConfig({
	plugins: [
		{
			name: 'manifest',
			generateBundle() {
				if (!url) {
					this.warn('PLUGIN_URL is not set: no manifest.json')
					return
				}
				this.emitFile({
					type: 'asset',
					fileName: 'manifest.json',
					source: `${JSON.stringify(manifest(url), null, '\t')}\n`,
				})
			},
		},
	],
})
