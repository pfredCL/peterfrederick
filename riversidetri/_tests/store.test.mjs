import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";
import Store from "../js/store.js";

globalThis.Model = Model;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

function fakeServer() {
  const srv = {
    pin: "1234", down: false, serverTime: 10_000, events: [],
    rows: [{ row: 2, id: "c1", name: "Dana Price", number: "8", flight: "8:10", nontrad: "" }],
  };
  srv.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (srv.down) throw new TypeError("Failed to fetch");
    const reply = (o) => ({ ok: true, json: async () => Object.assign({ serverTime: srv.serverTime }, o) });
    if (body.pin !== srv.pin) return reply({ ok: false, error: "pin", message: "That PIN didn't work." });
    const rejected = [];
    if (body.action === "write") {
      body.events.forEach((e) => {
        if (srv.events.some((x) => x.id === e.id)) return;
        if (e.type === "erg" && !srv.rows.some((r) => r.id === e.competitor)) {
          rejected.push({ id: e.id, reason: "That person isn't in Competitors any more." });
          return;
        }
        srv.events.push(Object.assign({ received: srv.serverTime }, e));
      });
    }
    return reply({ ok: true, rejected, state: { competitors: srv.rows, events: srv.events } });
  };
  return srv;
}

function setup() {
  const srv = fakeServer();
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  const later = [];
  let clock = 10_000;
  let n = 0;
  const store = Store.create({
    url: "https://fake.test/exec", fetch: srv.fetch, storage,
    now: () => clock, later: (fn, ms) => later.push({ fn, ms }), uuid: () => "id" + ++n,
  });
  return { srv, store, storage, later, tick: (ms) => { clock += ms; } };
}

test("a write shows straight away, is kept on the phone, and clears once the sheet has it", async () => {
  const { srv, store, storage } = setup();
  await store.refresh();
  store.add({ type: "erg", competitor: "c1", value: 22960 });
  assert.equal(store.status().pending, 1);
  assert.equal(store.view().byId.c1.erg, 22960);
  assert.equal(JSON.parse(storage.getItem("tw:queue")).length, 1);
  await store.flush();
  assert.equal(store.status().pending, 0);
  assert.equal(srv.events.length, 1);
  assert.equal("corrected" in srv.events[0], false);
  assert.equal(JSON.parse(storage.getItem("tw:queue")).length, 0);
});

test("with no signal the write waits, retries, and says so after a minute", async () => {
  const { srv, store, later, tick } = setup();
  await store.refresh();
  srv.down = true;
  store.add({ type: "tap", station: "entrance", time: store.correctedNow() });
  await store.flush();
  assert.equal(store.status().pending, 1);
  assert.equal(store.status().failing, false);
  assert.equal(later.length, 1);
  assert.equal(later[0].ms, 2000);
  tick(61_000);
  assert.equal(store.status().failing, true);
  srv.down = false;
  later[0].fn();
  await store.flush();
  assert.equal(store.status().pending, 0);
  assert.equal(store.status().failing, false);
});

test("a rejected write leaves the queue and is reported until dismissed", async () => {
  const { store } = setup();
  await store.refresh();
  store.add({ type: "erg", competitor: "gone", value: 22960 });
  await store.flush();
  assert.equal(store.status().pending, 0);
  assert.equal(store.status().rejected[0].reason, "That person isn't in Competitors any more.");
  store.dismissRejected(0);
  assert.equal(store.status().rejected.length, 0);
});

test("times made before the first sync are corrected by the phone's clock offset when sent", async () => {
  const { srv, store } = setup();
  srv.serverTime = 15_000; // the sheet's clock is 5 s ahead of this phone
  srv.down = true;
  const tap = store.add({ type: "tap", station: "entrance", time: store.correctedNow() });
  await store.flush();
  assert.equal(tap.corrected, false);
  srv.down = false;
  await store.refresh();
  assert.equal(store.correctedNow(), 15_000);
  await store.flush();
  assert.equal(srv.events[0].time, 15_000);
  assert.equal(srv.events[0].created, 15_000);
});

test("a wrong PIN is reported, not treated as lost signal", async () => {
  const { srv, store } = setup();
  srv.pin = "9999";
  await store.refresh();
  assert.equal(store.status().pinError, true);
  assert.equal(store.status().failing, false);
});

test("checkPin saves a PIN that works and refuses one that doesn't", async () => {
  const { store, storage } = setup();
  assert.deepEqual(await store.checkPin("0000"), { ok: false, reason: "pin" });
  assert.deepEqual(await store.checkPin("1234"), { ok: true });
  assert.equal(JSON.parse(storage.getItem("tw:pin")), "1234");
});

// ---- Hardening ----

test("a request that never answers times out, counts as a network failure and retries", { timeout: 5000 }, async () => {
  const hang = (u, o) => new Promise((_, reject) => {
    if (o.signal) o.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const later = [];
  let clock = 10_000;
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  const store = Store.create({
    url: "https://fake.test/exec", fetch: hang, storage, timeoutMs: 20,
    now: () => clock, later: (fn, ms) => later.push({ fn, ms }), uuid: () => "t1",
  });
  store.add({ type: "tap", station: "entrance", time: 10_000 });
  await store.flush();
  assert.equal(store.status().pending, 1);
  assert.equal(later.length, 1);
  assert.equal(later[0].ms, 2000);
  clock += 61_000;
  assert.equal(store.status().failing, true);
});

test("storage that refuses writes shows storageFailing but the event still shows", async () => {
  const srv = fakeServer();
  const storage = { getItem: (k) => (k === "tw:pin" ? '"1234"' : null), setItem() { throw new Error("quota"); } };
  let n = 0;
  const store = Store.create({ url: "u", fetch: srv.fetch, storage, now: () => 10_000, later() {}, uuid: () => "s" + ++n });
  await store.refresh();
  assert.equal(store.status().storageFailing, false);
  store.add({ type: "erg", competitor: "c1", value: 22960 });
  assert.equal(store.status().storageFailing, true);
  assert.equal(store.view().byId.c1.erg, 22960);
});

test("a failing state cache is dropped, and that alone is not storageFailing", async () => {
  const srv = fakeServer();
  const m = new Map([["tw:pin", '"1234"']]);
  const removed = [];
  const storage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (k === "tw:state") throw new Error("quota"); m.set(k, String(v)); },
    removeItem(k) { removed.push(k); m.delete(k); },
  };
  const store = Store.create({ url: "u", fetch: srv.fetch, storage, now: () => 10_000, later() {}, uuid: () => "x1" });
  await store.refresh();
  assert.deepEqual(removed, ["tw:state"]);
  assert.equal(store.status().storageFailing, false);
});

test("with no storage given and no window the store still works", async () => {
  assert.equal(typeof window, "undefined");
  const store = Store.create({ url: "", now: () => 1, later() {}, uuid: () => "m1" });
  store.add({ type: "tap", station: "entrance", time: 1 });
  assert.equal(store.status().pending, 1);
});

test("the in-memory fallback says storageFailing from the start", () => {
  globalThis.window = { get localStorage() { throw new Error("blocked"); } };
  try {
    const store = Store.create({ url: "", now: () => 1, later() {}, uuid: () => "b1" });
    assert.equal(store.status().storageFailing, true);
  } finally {
    delete globalThis.window;
  }
});

test("a rejected-list save failure stays visible after a later good queue save", () => {
  const m = new Map([["tw:rejected", JSON.stringify([{ event: { id: "r1" }, reason: "x" }])]]);
  const storage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (k === "tw:rejected") throw new Error("quota"); m.set(k, String(v)); },
  };
  const store = Store.create({ url: "", storage, now: () => 1, later() {}, uuid: () => "q1" });
  assert.equal(store.status().storageFailing, false);
  store.dismissRejected(0);
  assert.equal(store.status().storageFailing, true);
  store.add({ type: "tap", station: "entrance", time: 1 });
  assert.equal(store.status().storageFailing, true);
});

test("stored values of the wrong shape are ignored", () => {
  const m = new Map([["tw:queue", '{"a":1}'], ["tw:rejected", "5"], ["tw:samples", '"x"']]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  const store = Store.create({ url: "", storage, now: () => 1, later() {}, uuid: () => "w1" });
  assert.equal(store.status().pending, 0);
  assert.deepEqual(store.status().rejected, []);
  store.add({ type: "tap", station: "entrance", time: 1 });
  assert.equal(store.status().pending, 1);
});

test("the first send from a never-synced phone is clock-corrected", async () => {
  const { srv, store } = setup();
  srv.serverTime = 15_000;
  store.add({ type: "tap", station: "entrance", time: store.correctedNow() });
  await store.flush();
  assert.equal(srv.events.length, 1);
  assert.equal(srv.events[0].time, 15_000);
  assert.equal(srv.events[0].created, 15_000);
});

test("two tabs on one storage don't wipe each other's queue", async () => {
  const srv = fakeServer();
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  const make = (id) => Store.create({ url: "u", fetch: srv.fetch, storage, now: () => 10_000, later() {}, uuid: () => id });
  srv.down = true;
  const A = make("a");
  const B = make("b");
  A.add({ type: "tap", station: "entrance", time: 10_000 });
  B.add({ type: "tap", station: "exit", time: 10_000 });
  const stored = JSON.parse(storage.getItem("tw:queue")).map((e) => e.id).sort();
  assert.deepEqual(stored, ["a", "b"]);
  await Promise.all([A.flush(), B.flush()]);
  srv.down = false;
  await Promise.all([A.flush(), B.flush()]);
  assert.deepEqual(srv.events.map((e) => e.id).sort(), ["a", "b"]);
});

test("write failures stay visible while reads work", async () => {
  const srv = fakeServer();
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  let clock = 10_000;
  const fetch = async (u, o) => {
    if (JSON.parse(o.body).action === "write") {
      return { ok: true, json: async () => ({ ok: false, error: "server", message: "sheet locked", serverTime: clock }) };
    }
    return srv.fetch(u, o);
  };
  const store = Store.create({ url: "u", fetch, storage, now: () => clock, later() {}, uuid: () => "k1" });
  await store.refresh();
  store.add({ type: "tap", station: "entrance", time: 10_000 });
  await store.flush();
  assert.equal(store.status().failing, false);
  clock += 61_000;
  await store.refresh();
  assert.equal(store.status().failing, true);
});

test("a state response from an older request is ignored", async () => {
  const srv = fakeServer();
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  let clock = 10_000;
  const pending = [];
  const fetch = (u, o) => new Promise((resolve) => pending.push(resolve));
  const reply = (name) => ({ ok: true, json: async () => ({ ok: true, serverTime: 10_000, state: {
    competitors: [{ row: 2, id: "c1", name, number: "8", flight: "8:10", nontrad: "" }], events: [] } }) });
  const store = Store.create({ url: "u", fetch, storage, now: () => clock, later() {}, uuid: () => "z1" });
  const first = store.refresh();
  clock += 100;
  const second = store.refresh();
  pending[1](reply("New Name"));
  await second;
  pending[0](reply("Old Name"));
  await first;
  assert.equal(store.view().byId.c1.name, "New Name");
});

test("checkPin puts the old PIN back when the check fails", async () => {
  const { store } = setup();
  assert.equal(store.pin, "1234");
  await store.checkPin("0000");
  assert.equal(store.pin, "1234");
});

test("a throwing listener doesn't stop the write being sent", async () => {
  const { srv, store } = setup();
  await store.refresh();
  store.onChange(() => { throw new Error("listener bug"); });
  store.add({ type: "tap", station: "entrance", time: 10_000 });
  await store.flush();
  assert.equal(srv.events.length, 1);
});

test("start does nothing the second time", () => {
  const { store } = setup();
  const saved = { window: globalThis.window, document: globalThis.document, setInterval: globalThis.setInterval };
  let listeners = 0, intervals = 0;
  globalThis.window = { addEventListener: () => { listeners++; } };
  globalThis.document = { visibilityState: "hidden", addEventListener: () => { listeners++; } };
  globalThis.setInterval = () => { intervals++; return 0; };
  try {
    store.start(1000);
    store.start(1000);
    assert.equal(listeners, 2);
    assert.equal(intervals, 1);
  } finally {
    if (saved.window === undefined) delete globalThis.window; else globalThis.window = saved.window;
    if (saved.document === undefined) delete globalThis.document; else globalThis.document = saved.document;
    globalThis.setInterval = saved.setInterval;
  }
});

test("every request carries the year the store was made for", async () => {
  const srv = fakeServer();
  const bodies = [];
  const fetch = async (u, o) => { bodies.push(JSON.parse(o.body)); return srv.fetch(u, o); };
  const storage = memoryStorage();
  storage.setItem("tw:pin", JSON.stringify("1234"));
  const store = Store.create({ url: "u", year: 2026, fetch, storage, now: () => 10_000, later() {}, uuid: () => "y1" });
  await store.refresh();
  store.add({ type: "erg", competitor: "c1", value: 22960 });
  await store.flush();
  assert.ok(bodies.length >= 2);
  assert.ok(bodies.every((b) => b.year === 2026 && b.pin === "1234"));
});

test("a saved state from another year is ignored, one from the same year is used", () => {
  const state = { competitors: [{ row: 2, id: "c1", name: "Dana Price", number: "8", flight: "8:10", nontrad: "" }], events: [] };
  const make = (savedYear, year) => {
    const storage = memoryStorage();
    storage.setItem("tw:state", JSON.stringify(Object.assign({ year: savedYear }, state)));
    return Store.create({ url: "u", year, storage, now: () => 1, later() {}, uuid: () => "l1" });
  };
  assert.equal(make(2025, 2026).status().loaded, false);
  assert.equal(make(2026, 2026).status().loaded, true);
  assert.equal(make(2026, 2026).view().byId.c1.name, "Dana Price");
  assert.equal(make(2025, undefined).status().loaded, true); // a store made without a year takes what it finds
});
