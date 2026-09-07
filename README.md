# Totem Base Extensions

Official bundled/reference extensions for Totem. These packages use the same public `totem.extension/v0` contract and SDK validator available to third-party developers; first-party status does not grant special core access.

## Phase 2 pack

- `clock` — deterministic local time/date snapshots and a display contribution.
- `weather` — normalized weather snapshots, deterministic offline fixtures, and optional network fetching behind `network.internet`.
- `timer` — deterministic start/cancel/complete lifecycle with extension-owned events.
- `system-status` — unprivileged host health snapshots using Node's OS APIs.
- `spotify` — explicit Spotify auth/playback command boundaries.
- `github` — explicit GitHub MCP/tool request boundaries.
- `system-control` — narrow service-broker and read-only host control boundaries.

Every manifest declares explicit compatibility, lifecycle, events, settings/contributions, and only the permissions its backend actually needs. The repository tests all manifests through `@totem/extension-sdk` and uses injectable clocks/fetch/schedulers/host adapters so CI does not require credentials, network access, or physical hardware.

## Development

Node 22+ is supported.

```bash
npm install
npm run check
```

The SDK dependency is pinned to the integrated Phase 2 manifest-validator commit so clean checkouts validate against the same frozen contract used by Totem. Runtime-specific adapters can replace these narrow backend factories without moving service-specific behavior into core.

## Distribution integrity

`npm run integrity` emits a canonical `totem.extension-distribution/v1` report for the seven public first-party extensions. The report contains the package identity, expected extension IDs and versions, a sorted inventory of every shipped manifest/backend/documentation file, byte sizes, per-file SHA-256 values, and an aggregate SHA-256 over the canonical report payload.

The verifier fails closed when an extension is added or removed without updating the expected public set, a manifest ID or backend entrypoint does not match its package, an expected entrypoint is missing, an unexpected file appears in an extension package, a symlink/special file is encountered, or a path is non-portable/unsafe. The test suite also proves repeated report generation is byte-stable at the object level and exercises the fail-closed cases. Hosted CI runs the same check on Windows and Ubuntu.

For release evidence, pin the exact `totem-base-extensions` commit first, run `npm run integrity` from that clean checkout, and record both the commit SHA and the emitted `aggregateSha256`. Totem's host/runtime validation should consume the same pinned source revision; the digest is evidence for the public extension-pack bytes, not a substitute for Totem's permission checks or an authorization grant.

## Boundaries

This repository does not contain theme/persona assets, private copyrighted assets, provider adapters, generic runtime infrastructure, or physical hardware/CAD logic. Hardware-specific tuning remains outside this software-only extension pack.
