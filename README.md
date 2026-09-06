# Totem Base Extensions

Official bundled/reference extensions for Totem. These packages use the same public `totem.extension/v0` contract and SDK validator available to third-party developers; first-party status does not grant special core access.

## Phase 2 pack

- `clock` — deterministic local time/date snapshots and a display contribution.
- `weather` — normalized weather snapshots, deterministic offline fixtures, and optional network fetching behind `network.internet`.
- `timer` — deterministic start/cancel/complete lifecycle with extension-owned events.
- `system-status` — unprivileged host health snapshots using Node's OS APIs.

Every manifest declares explicit compatibility, lifecycle, events, settings/contributions, and only the permissions its backend actually needs. The repository tests all manifests through `@totem/extension-sdk` and uses injectable clocks/fetch/schedulers/host adapters so CI does not require credentials, network access, or physical hardware.

## Development

Node 22+ is supported.

```bash
npm install
npm run check
```

The SDK dependency is pinned to the integrated Phase 2 manifest-validator commit so clean checkouts validate against the same frozen contract used by Totem. Runtime-specific adapters can replace these narrow backend factories during the Phase 2 integration pass without moving service-specific behavior into core.

## Boundaries

This repository does not contain theme/persona assets, private copyrighted assets, provider adapters, generic runtime infrastructure, or physical hardware/CAD logic. Hardware-specific tuning remains outside this software-only extension pack.
