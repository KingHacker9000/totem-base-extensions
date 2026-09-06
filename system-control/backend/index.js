const ALLOWED_ACTIONS = new Set(["status", "start", "stop", "restart"]);

export function createServiceBrokerRequest({ service, action }) {
  if (typeof service !== "string" || service.trim() === "") throw new TypeError("service is required");
  if (!ALLOWED_ACTIONS.has(action)) throw new TypeError(`unsupported service action '${action}'`);
  return {
    broker: "system.service",
    action,
    service,
  };
}

export function normalizeServiceState(input) {
  if (!input || typeof input !== "object") throw new TypeError("service state payload is required");
  return {
    service: typeof input.service === "string" ? input.service : "unknown",
    active: Boolean(input.active),
    subState: typeof input.subState === "string" ? input.subState : null,
    pid: Number.isSafeInteger(input.pid) && input.pid > 0 ? input.pid : null,
  };
}

export function createReadOnlyHostSnapshot({ hostname, platform, arch, uptimeSeconds, loadAverage = [] }) {
  return {
    hostname: typeof hostname === "string" ? hostname : "unknown",
    platform: typeof platform === "string" ? platform : "unknown",
    arch: typeof arch === "string" ? arch : "unknown",
    uptimeSeconds: Number.isFinite(uptimeSeconds) ? Math.max(0, uptimeSeconds) : 0,
    loadAverage: Array.isArray(loadAverage) ? loadAverage.filter(Number.isFinite).slice(0, 3) : [],
  };
}
