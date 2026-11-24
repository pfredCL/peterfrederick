import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";
import { race2025 } from "./fixtures/race2025.mjs";

const ev = (id, type, created, extra) => Object.assign(
  { id, type, created, time: null, received: created, competitor: "", value: "", target: "", station: "", device: "d" }, extra);
const row = (id, name, flight) => ({ row: 2, id, name, number: "", flight, nontrad: "" });

test("the 2025 race replays exactly, and every total is the sum of its splits", () => {
  const { rows, events, t0 } = race2025();
  const v = Model.buildView(rows, events, t0 + 4 * 3600e3);
  assert.deepEqual(v.issues, []);
  const sam = v.people.find((p) => p.name === "Sam Carter");
  assert.equal(Model.formatTenths(sam.erg), "35:26.7");
  assert.equal(Model.formatTenths(sam.run), "39:19.5");
  assert.equal(Model.formatTenths(sam.stadium), "23:45.6");
  assert.equal(Model.formatTenths(sam.total), "1:38:31.8");
  assert.equal(sam.status, "Finished");
  v.people.forEach((p) => assert.equal(p.total, p.erg + p.run + p.stadium, p.name));
  // The 2025 sheet listed this row's total as 1:51:04.3, which its own splits don't add up to.
  assert.equal(Model.formatTenths(v.people.find((p) => p.name === "Riley Grant").total), "1:57:28.9");
});

test("splits are worked out in tenths after the start, so a row always adds up", () => {
  const t0 = 1_000_000;
  const v = Model.buildView([row("c1", "Dana Price", "8:10")], [
    ev("s", "start", t0, { value: "8:10", time: t0 }),
    ev("e", "erg", t0 + 1, { competitor: "c1", value: "22960" }),
    ev("i", "tap", t0 + 2, { station: "entrance", time: t0 + 5_186_049 }),
    ev("ni", "name", t0 + 3, { target: "i", competitor: "c1" }),
    ev("o", "tap", t0 + 4, { station: "exit", time: t0 + 7_134_351 }),
    ev("no", "name", t0 + 5, { target: "o", competitor: "c1" }),
  ], t0 + 8e6);
  const p = v.people[0];
  assert.equal(p.run, 51860 - 22960);
  assert.equal(p.stadium, 71344 - 51860);
  assert.equal(p.total, 71344);
  assert.equal(p.erg + p.run + p.stadium, p.total);
});

test("status follows a competitor through the race", () => {
  const t0 = 1_000_000;
  const rows = [row("c1", "Dana Price", "8:10")];
  const base = [ev("s", "start", t0, { value: "8:10", time: t0 })];
  const status = (events) => Model.buildView(rows, events, t0 + 9e6).people[0].status;
  assert.equal(status([]), "Not started");
  assert.equal(status(base), "On the erg");
  const erg = base.concat([ev("e", "erg", t0 + 1, { competitor: "c1", value: "22960" })]);
  assert.equal(status(erg), "On the run");
  const arrived = erg.concat([ev("i", "tap", t0 + 2, { station: "entrance", time: t0 + 5e6 }), ev("ni", "name", t0 + 3, { target: "i", competitor: "c1" })]);
  assert.equal(status(arrived), "In the stadium");
  const done = arrived.concat([ev("o", "tap", t0 + 4, { station: "exit", time: t0 + 7e6 }), ev("no", "name", t0 + 5, { target: "o", competitor: "c1" })]);
  assert.equal(status(done), "Finished");
});

test("issues: duplicate names, an old unnamed time, an odd run, a missing erg time", () => {
  const t0 = new Date(2026, 11, 5, 8, 14, 37).getTime();
  const rows = [row("c1", "Dana Price", "8:10"), row("c2", "Jamie Lowe", "8:10")];
  const v = Model.buildView(rows, [
    ev("s", "start", t0, { value: "8:10", time: t0 }),
    ev("e1", "erg", t0 + 1, { competitor: "c1", value: "22960" }),
    ev("i1", "tap", t0 + 2, { station: "entrance", time: t0 + 2_400_000 }),
    ev("n1", "name", t0 + 3, { target: "i1", competitor: "c1" }),
    ev("i2", "tap", t0 + 4, { station: "entrance", time: t0 + 2_500_000 }),
    ev("n2", "name", t0 + 5, { target: "i2", competitor: "c1" }),
    ev("i3", "tap", t0 + 6, { station: "entrance", time: t0 + 2_600_000 }),
    ev("n3", "name", t0 + 7, { target: "i3", competitor: "c2" }),
    ev("i4", "tap", t0 + 8, { station: "entrance", time: t0 + 2_700_000 }),
  ], t0 + 3_000_000);
  assert.deepEqual(v.issues.map((i) => i.text), [
    "Dana Price is named on 2 stadium entrance times (8:54:37.0, 8:56:17.0). The earliest counts until you fix it.",
    "Stadium entrance has a time without a name, the oldest from 8:59:37.0.",
    "Dana Price's run of 1:44.0 is under 20 minutes. Check the erg time and the arrival.",
    "Jamie Lowe has arrived at the stadium but has no erg time.",
  ]);
  assert.equal(v.people[0].arrivalTapId, "i1");
});

test("a time named for someone deleted from Competitors goes back to needing a name", () => {
  const v = Model.buildView([row("c1", "Dana Price", "8:10")], [
    ev("i", "tap", 10, { station: "entrance", time: 1000 }),
    ev("n", "name", 11, { target: "i", competitor: "gone" }),
  ], 2000);
  assert.equal(v.taps.entrance[0].competitor, "");
});
