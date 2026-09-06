export function getClockSnapshot({ now = () => new Date(), locale = "en-CA", timeZone, hour12 } = {}) {
  const instant = now();
  const options = { dateStyle: "medium", timeStyle: "medium" };
  if (hour12 !== undefined) options.hour12 = hour12;
  if (timeZone && timeZone !== "local") options.timeZone = timeZone;
  return {
    iso: instant.toISOString(),
    display: new Intl.DateTimeFormat(locale, options).format(instant),
    timeZone: timeZone ?? "local",
  };
}

export function createClockExtension(context = {}) {
  return {
    id: "clock",
    start() {
      return getClockSnapshot({ ...context, ...context.settings });
    },
    snapshot() {
      return getClockSnapshot({ ...context, ...context.settings });
    },
  };
}
