/* Local-first sync with the Apps Script web app. Keeps the last state, queues every write in
   localStorage, sends writes in order, retries, and tracks this device's clock offset.
   Uses the global Model. Its dependencies can be swapped so the Node tests can drive it. */
var Store = (function () {
  "use strict";
  const RETRY_MS = [2000, 5000, 10000, 30000];
  const FAILING_AFTER_MS = 60000;
  const SAMPLES = 5;

  function create(opts) {
    const url = opts.url || "";
    const fetchImpl = opts.fetch || ((u, o) => fetch(u, o));
    const storage = opts.storage || window.localStorage;
    const now = opts.now || (() => Date.now());
    const later = opts.later || ((fn, ms) => setTimeout(fn, ms));
    const uuid = opts.uuid || (() => crypto.randomUUID());
    const listeners = [];

    function load(key, fallback) {
      try {
        const v = storage.getItem("tw:" + key);
        return v === null || v === undefined ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    }
    function save(key, value) {
      try { storage.setItem("tw:" + key, JSON.stringify(value)); } catch (e) { /* storage blocked or full: carry on in memory */ }
    }

    const s = {
      pin: load("pin", ""), station: load("station", ""), device: load("device", "") || uuid(),
      state: load("state", null), queue: load("queue", []), rejected: load("rejected", []), samples: load("samples", []),
      inflight: null, failingSince: null, pinError: false, retries: 0, retryPending: false,
    };
    save("device", s.device);

    const emit = () => listeners.forEach((fn) => fn());
    const offset = () => Model.bestOffset(s.samples);
    const correctedNow = () => { const o = offset(); return o === null ? now() : now() + o; };
    const succeeded = () => { s.failingSince = null; s.retries = 0; };
    const failed = () => { if (s.failingSince === null) s.failingSince = now(); };

    async function call(body) {
      const t0 = now();
      const res = await fetchImpl(url, {
        method: "POST", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ pin: s.pin }, body)),
      });
      const t1 = now();
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (typeof data.serverTime === "number") {
        s.samples = s.samples.concat([{ rtt: t1 - t0, offset: data.serverTime - (t0 + t1) / 2 }]).slice(-SAMPLES);
        save("samples", s.samples);
      }
      if (!data.ok && data.error === "pin") { s.pinError = true; throw new Error("pin"); }
      if (!data.ok) throw new Error(data.message || "server");
      s.pinError = false;
      if (data.state) { s.state = data.state; save("state", s.state); }
      return data;
    }

    async function refresh() {
      if (!url) return;
      try { await call({ action: "state" }); succeeded(); } catch (e) { if (e.message !== "pin") failed(); }
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
        s.queue = s.queue.map(corrected);
        save("queue", s.queue);
        const batch = s.queue.slice();
        try {
          const data = await call({ action: "write", events: batch.map(wire) });
          const reasons = {};
          (data.rejected || []).forEach((r) => { reasons[r.id] = r.reason; });
          const sent = {};
          batch.forEach((e) => {
            sent[e.id] = true;
            if (reasons[e.id]) s.rejected.push({ event: wire(e), reason: reasons[e.id] });
          });
          s.queue = s.queue.filter((e) => !sent[e.id]);
          save("queue", s.queue);
          save("rejected", s.rejected);
          succeeded();
        } catch (e) {
          if (e.message !== "pin") { failed(); retryLater(); }
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
      save("queue", s.queue);
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
        failing: s.failingSince !== null && now() - s.failingSince >= FAILING_AFTER_MS,
      };
    }

    async function checkPin(pin) {
      s.pin = String(pin).trim();
      try {
        await call({ action: "state" });
        save("pin", s.pin);
        succeeded();
        emit();
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: e.message === "pin" ? "pin" : "network" };
      }
    }

    // Browser only: refresh every refreshMs while visible, at once on coming back, and when online again.
    function start(refreshMs) {
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
      dismissRejected(i) { s.rejected.splice(i, 1); save("rejected", s.rejected); emit(); },
      onChange(fn) { listeners.push(fn); },
      checkPin, refresh, flush, add, view, status, correctedNow, start,
    };
  }

  return { create: create };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Store;
