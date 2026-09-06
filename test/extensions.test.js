import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { validateManifest } from "@totem/extension-sdk";
import { createClockExtension, getClockSnapshot } from "../clock/backend/index.js";
import { createGitHubMcpRegistration, createGitHubToolRequest } from "../github/backend/index.js";
import { createSpotifyAuthRequest, normalizeSpotifyPlayback, spotifyCommand } from "../spotify/backend/index.js";
import { createReadOnlyHostSnapshot, createServiceBrokerRequest } from "../system-control/backend/index.js";
import { collectSystemStatus } from "../system-status/backend/index.js";
import { createTimerExtension } from "../timer/backend/index.js";
import { createWeatherExtension } from "../weather/backend/index.js";

const EXTENSIONS = ["clock", "weather", "timer", "system-status", "spotify", "github", "system-control"];

for (const id of EXTENSIONS) {
  test(`${id} manifest validates against public SDK`, async () => {
    const manifest = JSON.parse(await fs.readFile(new URL(`../${id}/totem-extension.json`, import.meta.url), "utf8"));
    const result = validateManifest(manifest, { runtimeVersions: { totem: "0.2.0", sdk: "0.2.0" } });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  });
}

test("clock snapshot is deterministic with injected time", () => {
  const fixed = new Date("2026-09-06T12:34:56.000Z");
  const snapshot = getClockSnapshot({ now: () => fixed, locale: "en-CA", timeZone: "UTC" });
  assert.equal(snapshot.iso, fixed.toISOString());
  assert.equal(snapshot.timeZone, "UTC");
});

test("weather supports deterministic offline mode", async () => {
  const weather = createWeatherExtension({ settings: { offline: true, location: "Testville" } });
  const snapshot = await weather.snapshot();
  assert.equal(snapshot.location, "Testville");
  assert.equal(snapshot.source, "fixture");
  assert.equal(snapshot.temperatureC, 4);
});

test("weather normalizes network response", async () => {
  const weather = createWeatherExtension({
    settings: { endpoint: "https://example.invalid/weather", location: "Fallback" },
    fetchImpl: async () => ({ ok: true, json: async () => ({ name: "Toronto", temperature: 21, summary: "sunny", time: "2026-09-06T12:00:00.000Z" }) }),
  });
  const snapshot = await weather.snapshot();
  assert.deepEqual(snapshot, { location: "Toronto", observedAt: "2026-09-06T12:00:00.000Z", temperatureC: 21, condition: "sunny", source: "network" });
});

test("timer start, complete and cancel are deterministic", () => {
  let scheduled;
  const events = [];
  const timer = createTimerExtension({
    now: () => 1000,
    schedule: (fn, delay) => { scheduled = { fn, delay }; return 7; },
    cancelSchedule: () => {},
    emit: (type, payload) => events.push({ type, payload }),
  });
  const started = timer.startTimer(5, "Tea");
  assert.equal(started.dueAt, 6000);
  assert.equal(scheduled.delay, 5000);
  scheduled.fn();
  assert.equal(timer.listTimers().length, 0);
  assert.equal(events.at(-1).type, "extension.timer.completed");
});

test("system status supports deterministic host fixtures", () => {
  const osModule = {
    totalmem: () => 1000,
    freemem: () => 250,
    platform: () => "test-os",
    arch: () => "test-arch",
    uptime: () => 123,
    loadavg: () => [1, 2, 3],
    cpus: () => [{}, {}],
  };
  const status = collectSystemStatus({ osModule, now: () => new Date("2026-09-06T00:00:00.000Z") });
  assert.equal(status.memory.usedBytes, 750);
  assert.equal(status.cpuCount, 2);
  assert.equal(status.platform, "test-os");
});

test("Spotify fixture exercises OAuth, playback normalization, and controls without credentials", () => {
  const authUrl = new URL(createSpotifyAuthRequest({
    clientId: "client",
    redirectUri: "http://127.0.0.1/callback",
    state: "state-1",
    scopes: ["user-read-playback-state", "user-modify-playback-state"],
  }));
  assert.equal(authUrl.hostname, "accounts.spotify.com");
  assert.equal(authUrl.searchParams.get("state"), "state-1");
  const playback = normalizeSpotifyPlayback({ is_playing: true, progress_ms: 2500, item: { id: "track-1", name: "Song", artists: [{ name: "Artist" }] } });
  assert.deepEqual(playback, { playing: true, progressMs: 2500, item: { id: "track-1", title: "Song", artists: ["Artist"] } });
  assert.deepEqual(spotifyCommand("pause"), { method: "PUT", path: "/v1/me/player/pause" });
});

test("GitHub fixture keeps credentials as a secret reference and uses provider-neutral tool requests", () => {
  const registration = createGitHubMcpRegistration({ command: "github-mcp-server", tokenSecretId: "github-token" });
  assert.deepEqual(registration.env.GITHUB_PERSONAL_ACCESS_TOKEN, { secretRef: "github-token" });
  assert.equal(JSON.stringify(registration).includes("ghp_"), false);
  assert.deepEqual(createGitHubToolRequest({ owner: "openai", repo: "example", operation: "issues.list", input: { state: "open" } }), {
    tool: "github.issues.list",
    arguments: { owner: "openai", repo: "example", state: "open" },
  });
});

test("system-control fixture requests brokered operations rather than executing host commands", () => {
  assert.deepEqual(createServiceBrokerRequest({ service: "totem", action: "restart" }), {
    broker: "system.service",
    action: "restart",
    service: "totem",
  });
  assert.deepEqual(createReadOnlyHostSnapshot({ hostname: "node-a", platform: "linux", arch: "arm64", uptimeSeconds: 42, loadAverage: [0.1, 0.2, 0.3] }), {
    hostname: "node-a",
    platform: "linux",
    arch: "arm64",
    uptimeSeconds: 42,
    loadAverage: [0.1, 0.2, 0.3],
  });
});


test("clock consumes runtime settings", () => {
  const clock = createClockExtension({ now: () => new Date("2026-09-06T12:34:56Z"), settings: { timeZone: "UTC", hour12: false } });
  assert.equal(clock.start().timeZone, "UTC");
  assert.equal(clock.start().display, getClockSnapshot({ now: () => new Date("2026-09-06T12:34:56Z"), timeZone: "UTC", hour12: false }).display);
});

test("timer stop cancels all work and completion payload is serializable", () => {
  const callbacks = [];
  const cancelled = [];
  const events = [];
  const timer = createTimerExtension({
    schedule: fn => { callbacks.push(fn); const handle = {}; handle.self = handle; return handle; },
    cancelSchedule: handle => cancelled.push(handle),
    emit: (type, payload) => events.push({ type, payload }),
  });
  timer.startTimer(1);
  callbacks[0]();
  assert.doesNotThrow(() => JSON.stringify(events));
  timer.startTimer(2);
  timer.startTimer(3);
  timer.stop();
  assert.equal(cancelled.length, 2);
  assert.deepEqual(timer.listTimers(), []);
  const count = events.length;
  callbacks[1]();
  callbacks[2]();
  assert.equal(events.length, count);
});
