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
