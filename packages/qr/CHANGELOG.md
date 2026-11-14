# @obelism/content-plugin-qr

## 0.2.0

### Minor Changes

- b77d49d: A scan's event carries the visitor's `country` and `region` as the event's own fields, which Numbers stores instead of the server's location (needs Numbers with Obelism/obelism#855; before it, Numbers ignores them). Breaking: `params.country` is no longer sent.
