# @obelism/content-plugin-qr

QR codes managed in [Obelism Content](https://content.obelism.studio): the
`qrCode` content type, the address a code encodes, and a Next.js route that
logs each scan to Obelism Numbers before it redirects to the code's target.

The plugin editors use in Content, and how to set it up, are in
[Obelism/content-plugin-qr](https://github.com/Obelism/content-plugin-qr).

```bash
npm i @obelism/content-plugin-qr @obelism/content
```

```ts
// app/qr/[slug]/route.ts
import { ContentClient } from '@obelism/content'
import { createQrRoute } from '@obelism/content-plugin-qr/next'

export const GET = createQrRoute({
	content: new ContentClient({ token: process.env.CONTENT_DELIVERY_TOKEN }),
	numbers: {
		organizationId: process.env.OBELISM_ORGANIZATION_ID!,
		spaceId: process.env.OBELISM_SPACE_ID,
		token: process.env.NUMBERS_API_TOKEN!,
	},
	link: { url: (path) => `/${path}` },
	fallback: '/',
})
```

From `@obelism/content-plugin-qr`: `QR_CONTENT_TYPE` (for a model managed in
code), `qrAddress()`, `isQrSlug()` and the type's constants.

MIT licensed.
