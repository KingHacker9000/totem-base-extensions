const OFFLINE_FIXTURE = Object.freeze({
  location: "Toronto",
  observedAt: "2026-01-01T12:00:00.000Z",
  temperatureC: 4,
  condition: "cloudy",
  source: "fixture",
});

export function normalizeWeather(payload, fallbackLocation = "Unknown") {
  return {
    location: payload.location ?? payload.name ?? fallbackLocation,
    observedAt: payload.observedAt ?? payload.time ?? new Date(0).toISOString(),
    temperatureC: Number(payload.temperatureC ?? payload.temperature ?? payload.temp ?? 0),
    condition: String(payload.condition ?? payload.summary ?? "unknown"),
    source: payload.source ?? "network",
  };
}

export function createWeatherExtension({ fetchImpl = globalThis.fetch, settings = {} } = {}) {
  async function snapshot() {
    if (settings.offline || !settings.endpoint) {
      return { ...OFFLINE_FIXTURE, location: settings.location ?? OFFLINE_FIXTURE.location };
    }
    if (typeof fetchImpl !== "function") throw new Error("weather fetch implementation unavailable");
    const response = await fetchImpl(settings.endpoint);
    if (!response.ok) throw new Error(`weather request failed: ${response.status}`);
    return normalizeWeather(await response.json(), settings.location);
  }
  return { id: "weather", start: snapshot, snapshot };
}

export { OFFLINE_FIXTURE };
