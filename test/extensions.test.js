import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { validateManifest } from "@totem/extension-sdk";
import { getClockSnapshot } from "../clock/backend/index.js";
import { createWeatherExtension } from "../weather/backend/index.js";
import { createTimerExtension } from "../timer/backend/index.js";
import { collectSystemStatus } from "../system-status/backend/index.js";

const EXTENSIONS = ["clock", "weather", "timer", "system-status"];

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
