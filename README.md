# Totem Base Extensions

Official bundled/reference extensions for Totem.

These packages are intentionally built through the same public extension contract available to third-party developers. If a feature can live here instead of in Totem core, that is usually preferred.

## Initial targets

- `clock` — local time/date presentation
- `weather` — weather data + display surface
- `timer` — timers/alarms and related events
- `system-status` — local Totem/host health information

Later first-party examples may include integrations such as Spotify or GitHub when they are useful for exercising SDK capabilities, but the base set should stay small and broadly useful.

## What does not belong here

- theme/persona assets
- private copyrighted character assets
- agent-provider adapters
- generic runtime infrastructure
- integrations that are too experimental or user-specific to maintain as first-party packages

The repository begins as documentation-only during Phase 0. Implementation starts after the extension SDK has a working v0 manifest and lifecycle.
