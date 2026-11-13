import { defineConfig } from 'vite'

import { manifest } from './src/manifest'

export default defineConfig(({ command }) => {
	const url = process.env.PLUGIN_URL
	if (command === 'build' && !url) {
		throw new Error(
			'Set PLUGIN_URL to the https address the page is served from: the manifest names it',
		)
	}
	return {
		plugins: [
			{
				name: 'manifest',
				generateBundle() {
					this.emitFile({
						type: 'asset',
						fileName: 'manifest.json',
						source: `${JSON.stringify(manifest(url!), null, '\t')}\n`,
					})
				},
			},
		],
	}
})
