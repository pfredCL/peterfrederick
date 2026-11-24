/* Local-first sync with the Apps Script web app. Keeps the last state, queues every write in
   localStorage, sends writes in order, retries, and tracks this device's clock offset.
   Uses the global Model. Its dependencies can be swapped so the Node tests can drive it. */
var Store = (function () {
  "use strict";
  const RETRY_MS = [2000, 5000, 10000, 30000];
  const FAILING_AFTER_MS = 60000;
  const SAMPLES = 5;

  // The browser's localStorage if it will hand it over (it can throw when blocked), else a copy in memory.
  function defaultStorage() {
    try { if (typeof window !== "undefined" && window.localStorage) return window.localStorage; } catch (e) { /* blocked */ }
    const m = {};
    return {
      isMemory: true,
      getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; },
    };
  }

  function create(opts) {
    const url = opts.url || "";
    const year = opts.year;
    const fetchImpl = opts.fetch || ((u, o) => fetch(u, o));
    const timeoutMs = opts.timeoutMs || 15000;
    const storage = opts.storage || defaultStorage();
    const memoryOnly = storage.isMemory === true;
    const now = opts.now || (() => Date.now());
    const later = opts.later || ((fn, ms) => setTimeout(fn, ms));
    const uuid = opts.uuid || (() => crypto.randomUUID());
    const listeners = [];

    function load(key, fallback) {
      try {
        const v = storage.getItem("tw:" + key);
        if (v === null || v === undefined) return fallback;
        const out = JSON.parse(v);
        return Array.isArray(fallback) && !Array.isArray(out) ? fallback : out;
      } catch (e) {
        return fallback;
      }
    }
    // Returns whether it worked; when it didn't we carry on in memory.
    function save(key, value) {
      try { storage.setItem("tw:" + key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    // The saved copy remembers its year, so a phone never shows last year's people.
    function loadState() {
      const saved = load("state", null);
      return saved && year !== undefined && saved.year !== year ? null : saved;
    }

    const s = {
      pin: load("pin", ""), station: load("station", ""), device: load("device", "") || uuid(),
      state: loadState(), queue: load("queue", []), rejected: load("rejected", []), samples: load("samples", []),
      inflight: null, readFailingSince: null, writeFailingSince: null, queueSaveFailed: false, rejectedSaveFailed: false,
      confirmed: {}, stateAt: null, started: false, pinError: false, retries: 0, retryPending: false,
    };
    save("device", s.device);

    const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* a broken listener mustn't stop the rest */ } });
    const offset = () => Model.bestOffset(s.samples);
    const correctedNow = () => { const o = offset(); return o === null ? now() : now() + o; };
    const succeeded = (kind) => { if (kind === "write") s.writeFailingSince = null; else s.readFailingSince = null; s.retries = 0; };
    const failed = (kind) => {
      if (kind === "write") { if (s.writeFailingSince === null) s.writeFailingSince = now(); }
      else if (s.readFailingSince === null) s.readFailingSince = now();
    };

    // Save the queue, first adding back anything another tab stored that this one hasn't seen.
    function saveQueue() {
      const stored = load("queue", []);
      const mine = {};
      s.queue.forEach((e) => { mine[e.id] = true; });
      stored.forEach((e) => {
        if (e && e.id && !mine[e.id] && !s.confirmed[e.id]) { mine[e.id] = true; s.queue.push(e); }
      });
      s.queueSaveFailed = !save("queue", s.queue);
    }
    function saveRejected() { s.rejectedSaveFailed = !save("rejected", s.rejected); }

    async function call(body) {
      const t0 = now();
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      let res, t1, data;
      try {
        res = await fetchImpl(url, {
          method: "POST", redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(Object.assign({ pin: s.pin, year: year }, body)),
          signal: ctl ? ctl.signal : undefined,
        });
        t1 = now();
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = await res.json();
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
      if (typeof data.serverTime === "number") {
        s.samples = s.samples.concat([{ rtt: t1 - t0, offset: data.serverTime - (t0 + t1) / 2 }]).slice(-SAMPLES);
        save("samples", s.samples);
      }
      if (!data.ok && data.error === "pin") { s.pinError = true; throw new Error("pin"); }
      if (!data.ok) throw new Error(data.message || "server");
      s.pinError = false;
      // A slow answer to an older request must not undo a newer one.
      if (data.state && (s.stateAt === null || t0 >= s.stateAt)) {
        s.state = data.state;
        s.stateAt = t0;
        if (!save("state", year === undefined ? s.state : Object.assign({ year: year }, s.state)) && typeof storage.removeItem === "function") {
          try { storage.removeItem("tw:state"); } catch (e) { /* nothing more to do */ }
        }
      }
      return data;
    }

    async function refresh() {
      if (!url) return;
      try { await call({ action: "state" }); succeeded("read"); } catch (e) { if (e.message !== "pin") failed("read"); }
      emit();
    }

    // Events made before this device had a clock sample carry raw device time: correct them as they go.
    function corrected(e) {
      const o = offset();
      if (e.corrected || o === null) return e;
      const out = Object.assign({}, e, { created: e.created + o, corrected: true });
      if (typeof e.time === "number") out.time = e.time + o;
      return out;
    }
    function wire(e) {
      const out = Object.assign({}, e);
      delete out.corrected;
      return out;
    }

    async function send() {
      while (s.queue.length) {
        try {
          if (!s.samples.length) await call({ action: "state" });
          s.queue = s.queue.map(corrected);
          saveQueue();
          const batch = s.queue.slice();
          const data = await call({ action: "write", events: batch.map(wire) });
          const reasons = {};
          (data.rejected || []).forEach((r) => { reasons[r.id] = r.reason; });
          const sent = {};
          batch.forEach((e) => {
            sent[e.id] = true;
            s.confirmed[e.id] = true;
            if (reasons[e.id]) s.rejected.push({ event: wire(e), reason: reasons[e.id] });
          });
          s.queue = s.queue.filter((e) => !sent[e.id]);
          saveQueue();
          saveRejected();
          succeeded("write");
        } catch (e) {
          if (e.message !== "pin") { failed("write"); retryLater(); }
          break;
        } finally {
          emit();
        }
      }
    }

    // One send at a time; anything added meanwhile goes in the same loop.
    function flush() {
      if (!url) return Promise.resolve();
      if (!s.inflight) s.inflight = send().finally(() => { s.inflight = null; });
      return s.inflight;
    }

    function retryLater() {
      if (s.retryPending) return;
      s.retryPending = true;
      const ms = RETRY_MS[Math.min(s.retries, RETRY_MS.length - 1)];
      s.retries++;
      later(() => { s.retryPending = false; flush(); }, ms);
    }

    function add(partial) {
      const o = offset();
      const raw = now();
      const e = Object.assign({
        id: uuid(), type: "", created: o === null ? raw : raw + o, time: null,
        competitor: "", value: "", target: "", station: "", device: s.device, corrected: o !== null,
      }, partial);
      s.queue.push(e);
      saveQueue();
      emit();
      flush();
      return e;
    }

    function view() {
      if (!s.state) return null;
      const stored = {};
      s.state.events.forEach((e) => { stored[e.id] = true; });
      const pending = s.queue.filter((e) => !stored[e.id]).map((e) => Object.assign({}, e, { received: null }));
      return Model.buildView(s.state.competitors, s.state.events.concat(pending), correctedNow());
    }

    function status() {
      return {
        loaded: !!s.state, pending: s.queue.length, pinError: s.pinError, rejected: s.rejected.slice(),
        failing: [s.readFailingSince, s.writeFailingSince].some((t) => t !== null && now() - t >= FAILING_AFTER_MS),
        storageFailing: memoryOnly || s.queueSaveFailed || s.rejectedSaveFailed,
      };
    }

    async function checkPin(pin) {
      const previous = s.pin;
      s.pin = String(pin).trim();
      try {
        await call({ action: "state" });
        save("pin", s.pin);
        succeeded("read");
        emit();
        return { ok: true };
      } catch (e) {
        s.pin = previous;
        return { ok: false, reason: e.message === "pin" ? "pin" : "network" };
      }
    }

    // Browser only: refresh every refreshMs while visible, at once on coming back, and when online again.
    function start(refreshMs) {
      if (s.started) return;
      s.started = true;
      const tick = () => { if (document.visibilityState === "visible") { refresh(); flush(); } };
      tick();
      setInterval(tick, refreshMs);
      document.addEventListener("visibilitychange", tick);
      window.addEventListener("online", () => { s.retries = 0; flush(); });
    }

    return {
      get pin() { return s.pin; },
      get station() { return s.station; },
      setStation(st) { s.station = st; save("station", st); },
      forgetPin() { s.pin = ""; save("pin", ""); },
      dismissRejected(i) { s.rejected.splice(i, 1); saveRejected(); emit(); },
      onChange(fn) { listeners.push(fn); },
      checkPin, refresh, flush, add, view, status, correctedNow, start,
    };
  }

  return { create: create };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Store;
