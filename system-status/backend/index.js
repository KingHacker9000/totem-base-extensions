import os from "node:os";

export function collectSystemStatus({ osModule = os, now = () => new Date() } = {}) {
  const total = osModule.totalmem();
  const free = osModule.freemem();
  return {
    observedAt: now().toISOString(),
    platform: osModule.platform(),
    arch: osModule.arch(),
    uptimeSeconds: osModule.uptime(),
    loadAverage: osModule.loadavg(),
    memory: {
      totalBytes: total,
      freeBytes: free,
      usedBytes: total - free,
    },
    cpuCount: osModule.cpus().length,
  };
}

export function createSystemStatusExtension(context = {}) {
  const snapshot = () => collectSystemStatus(context);
  return {
    id: "system-status",
    start: snapshot,
    snapshot,
    contributionSnapshot: snapshot,
  };
}
