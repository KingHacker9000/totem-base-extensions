# Clock Phase 1 fixture

This directory is intentionally a minimal first-party discovery fixture for Totem Phase 1.

It uses the same `totem.extension/v0` manifest path scanned for third-party extensions. The fixture declares only the broad `display` capability and does not yet implement the future extension SDK lifecycle or clock rendering behavior.

Its purpose is to prove that Totem can discover a real package from the public `totem-base-extensions` repository without special-casing first-party packages.
