export function createTimerExtension({ now = () => Date.now(), schedule = setTimeout, cancelSchedule = clearTimeout, emit = () => {} } = {}) {
  let nextId = 1;
  const timers = new Map();

  function startTimer(seconds, label = "Timer") {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new TypeError("seconds must be positive");
    const id = `timer-${nextId++}`;
    const startedAt = now();
    const dueAt = startedAt + seconds * 1000;
    const handle = schedule(() => {
      const timer = timers.get(id);
      if (!timer) return;
      timers.delete(id);
      emit("extension.timer.completed", { ...publicTimer(timer), status: "completed" });
    }, seconds * 1000);
    const timer = { id, label, seconds, startedAt, dueAt, status: "running", handle };
    timers.set(id, timer);
    emit("extension.timer.started", publicTimer(timer));
    return publicTimer(timer);
  }

  function cancelTimer(id) {
    const timer = timers.get(id);
    if (!timer) return false;
    cancelSchedule(timer.handle);
    timers.delete(id);
    emit("extension.timer.cancelled", { ...publicTimer(timer), status: "cancelled" });
    return true;
  }

  function listTimers() {
    return [...timers.values()].map(publicTimer);
  }

  return {
    id: "timer",
    startTimer,
    cancelTimer,
    listTimers,
    contributionSnapshot() {
      return { timers: listTimers(), activeCount: timers.size };
    },
    stop() {
      for (const timer of timers.values()) cancelSchedule(timer.handle);
      timers.clear();
    },
  };
}

function publicTimer({ handle: _handle, ...timer }) {
  return timer;
}
