export function getClockSnapshot({ now = () => new Date(), locale = "en-CA", timeZone } = {}) {
  const instant = now();
  const options = { dateStyle: "medium", timeStyle: "medium" };
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
      return getClockSnapshot(context);
    },
    snapshot() {
      return getClockSnapshot(context);
    },
  };
}
