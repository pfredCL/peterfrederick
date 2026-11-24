import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";

const ev = (id, type, created, extra) => Object.assign(
  { id, type, created, time: null, received: created, competitor: "", value: "", target: "", station: "", device: "d" }, extra);

test("the most recently made erg time wins, even if it reached the sheet first", () => {
  const r = Model.resolve([
    ev("late-arrival", "erg", 100, { competitor: "c1", value: "22960", received: 500 }),
    ev("correction", "erg", 200, { competitor: "c1", value: "22861", received: 300 }),
  ]);
  assert.equal(r.ergs.c1.id, "correction");
});

test("received order breaks ties, and events not yet sent count as newest", () => {
  const tie = Model.resolve([
    ev("a", "erg", 100, { competitor: "c1", value: "1", received: 300 }),
    ev("b", "erg", 100, { competitor: "c1", value: "2", received: 200 }),
  ]);
  assert.equal(tie.ergs.c1.id, "a");
  const pending = Model.resolve([
    ev("a", "erg", 100, { competitor: "c1", value: "1", received: 300 }),
    ev("q", "erg", 100, { competitor: "c1", value: "2", received: null }),
  ]);
  assert.equal(pending.ergs.c1.id, "q");
});

test("a void removes an event and the one before it comes back", () => {
  const r = Model.resolve([
    ev("s1", "start", 100, { value: "7:15", time: 1000 }),
    ev("s2", "start", 200, { value: "7:15", time: 2000 }),
    ev("v", "void", 300, { target: "s2" }),
    ev("t1", "tap", 400, { station: "entrance", time: 5000 }),
    ev("n1", "name", 410, { target: "t1", competitor: "c1" }),
    ev("n2", "name", 420, { target: "t1", competitor: "" }),
  ]);
  assert.equal(r.starts["7:15"].id, "s1");
  assert.deepEqual(r.startIds["7:15"], ["s1"]);
  assert.equal(r.names.t1.id, "n2");
  assert.deepEqual(r.taps.map((t) => t.id), ["t1"]);
});

test("taps come out in the order they happened, and voided taps disappear", () => {
  const r = Model.resolve([
    ev("t2", "tap", 10, { station: "exit", time: 9000 }),
    ev("t1", "tap", 20, { station: "exit", time: 8000 }),
    ev("t3", "tap", 30, { station: "exit", time: 9500 }),
    ev("v", "void", 40, { target: "t3" }),
  ]);
  assert.deepEqual(r.taps.map((t) => t.id), ["t1", "t2"]);
});
