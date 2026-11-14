# QR codes for Obelism Content

Editors make QR codes in [Obelism Content](https://content.obelism.studio);
your site answers them, logs each scan to Obelism Numbers and sends the
visitor on.

- **The plugin** (`plugin/`): a page Content frames as the input of a QR
  code's slug. It shows the code and downloads it as SVG, PNG, JPG or PDF.
  Its manifest brings the **QR code** content type into a Space when the
  plugin is turned on there.
- **`@obelism/content-plugin-qr`** (`packages/qr/`): the type, the address a
  code encodes, and `createQrRoute` for a Next.js route handler.

## The QR code type

| Field    | Type | What it is                                                        |
| -------- | ---- | ----------------------------------------------------------------- |
| `slug`   | text | The code's address on the site; required, unique, `a-z0-9-`.      |
| `query`  | text | Optional query string added to the address, such as `src=poster`. |
| `target` | link | Where a scan goes: a page of the site or any address.             |

A code encodes `{site address}{route}/{slug}?{query}`, for instance
`https://www.example.com/qr/spring-poster?src=poster`. The site's route
finds the published code by its slug, logs a `qr_scan` event and redirects
to the target. Change the target any time; the printed code stays the same.

## Set it up

1. **Register the plugin.** In Content, an admin opens **Plugins** and
   registers `https://<where the plugin is served>/manifest.json`.
2. **Turn it on** per environment (Settings › Preview and site › Plugins),
   with the **Site address** (`https://www.example.com`) and, if the site
   doesn't answer on `/qr`, the **Route**. Turning it on adds the `qrCode`
   type to that environment's model, unless it has one already. A model
   managed in code gets the type from your model file instead: copy
   `QR_CONTENT_TYPE` from the package.
3. **Add the route** to the site:

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
		environment: 'production',
		token: process.env.NUMBERS_API_TOKEN!,
	},
	// How a link to a page of the site becomes its address.
	link: { url: (path) => `/${path}` },
	// Unknown codes go here instead of a 404.
	fallback: '/',
})
```

Use a delivery token, not a preview token: a preview token would send scans
to draft targets. `numbers.token` is a Numbers API token of the environment,
or a function that returns one, such as Vercel's OIDC token for a deployment
connected to the Space with Improve on.

Other options: `visitorCookie: false` (no visitor cookie, for a site that
asks for consent first), `status` (`302`, `303` or `307`; never permanent,
since a browser would keep it), `onError` (where a failed log is reported;
`console.error` by default) and `contentType` (when the type's API ID is
not `qrCode`).

### What a scan does

1. Finds the published `qrCode` entry with that slug (a 404, or `fallback`,
   when there is none or it has no target).
2. Sends a `qr_scan` event to Numbers, scoped to the slug, with the code's
   `query` field and the target in `params`, the visitor's country and region
   (from Vercel's or Cloudflare's headers, so trusted only behind one of
   them), and the UTM tags in that query as the event's campaign. What a visitor appends
   to the address is never logged. It waits at most 1.5 s
   (`numbers.timeout`): a scan that can't be logged still redirects. Link
   previews and crawlers aren't logged.
3. Sets the shared visitor cookie (`obelism_visitor_id`) for a new visitor,
   so the scan and the pages after it are one visitor in Numbers and
   Improve, and redirects. The query isn't passed on to the target; put
   what the target should get in the target link's own query.

The scan is logged before the redirect because the target may be another
site, where Numbers never sees the visitor arrive.

## Serve the plugin

The plugin is a static page; `plugin/wrangler.jsonc` serves it from
Cloudflare Workers.

```bash
cd plugin
PLUGIN_URL=https://qr.example.com/ npm run deploy
```

`PLUGIN_URL` is the `https` address the page is served from, outside
`obelism.studio`; the build writes it into `manifest.json`. To build against
a local Content, run `npm run dev` and point the plugin's URL in develop at
`http://localhost:5173/?content=http://localhost:8789` (only the dev server
takes `?content=`).

## Develop

```bash
npm install
npm test
npm run lint
npm run build
```

## Release

`npm run changeset` describes a change to `@obelism/content-plugin-qr`. On
`main`, the NPM Publish workflow opens a Version Packages pull request;
merging it publishes the package through npm trusted publishing (no
token). npm only takes a trusted publisher for a package that exists, so
0.1.0 was published by hand (`npm publish --access public` in
`packages/qr`), after which `Obelism/content-plugin-qr` with
`publish-npm.yml` was added as its trusted publisher. The plugin page isn't published there: deploy it with
`npm run deploy` in `plugin/`.

MIT licensed.
