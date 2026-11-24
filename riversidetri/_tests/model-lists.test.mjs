import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";
import { race2025 } from "./fixtures/race2025.mjs";

const ev = (id, type, created, extra) => Object.assign(
  { id, type, created, time: null, received: created, competitor: "", value: "", target: "", station: "", device: "d" }, extra);
const row = (r, id, name, flight, extra) => Object.assign({ row: r, id, name, number: String(r), flight, nontrad: "" }, extra);

test("rank orders finishers by total, shares places on equal totals and splits out non-traditional", () => {
  const r = Model.rank([
    { name: "B", total: 100, nontrad: false },
    { name: "A", total: 100, nontrad: false },
    { name: "C", total: 90, nontrad: false },
    { name: "D", total: 80, nontrad: true },
    { name: "E", total: null, nontrad: false },
  ]);
  assert.deepEqual(r.overall.map((x) => [x.place, x.person.name]), [[1, "C"], [2, "A"], [2, "B"]]);
  assert.deepEqual(r.nontrad.map((x) => [x.place, x.person.name]), [[1, "D"]]);
});

test("the 2025 race ranks 22 overall and 9 non-traditional", () => {
  const { rows, events, t0 } = race2025();
  const r = Model.rank(Model.buildView(rows, events, t0 + 4 * 3600e3).people);
  assert.equal(r.overall.length, 22);
  assert.equal(r.nontrad.length, 9);
  assert.equal(r.overall[0].person.name, "Sam Carter");
  assert.equal(r.nontrad[0].person.name, "Blair Nolan");
  assert.equal(Model.formatTenths(r.nontrad[0].person.total), "1:35:07.4");
});

function midRace() {
  const t0 = 1_000_000;
  const rows = [
    row(2, "c1", "Dana Price", "8:10"),
    row(3, "c2", "Jamie Lowe", "8:10"),
    row(4, "c3", "Sam Carter", "7:15"),
    row(5, "c4", "Blair Nolan", "7:15"),
    row(6, "c5", "Avery Cole", "7:15"),
  ];
  const events = [
    ev("s715", "start", t0, { value: "7:15", time: t0 }),
    ev("e3", "erg", t0 + 1, { competitor: "c3", value: "21267" }),
    ev("e4", "erg", t0 + 2, { competitor: "c4", value: "18167" }),
    ev("e1", "erg", t0 + 3, { competitor: "c1", value: "22960" }),
    ev("i3", "tap", t0 + 4, { station: "entrance", time: t0 + 4_486_200 }),
    ev("n3", "name", t0 + 5, { target: "i3", competitor: "c3" }),
    ev("i9", "tap", t0 + 6, { station: "entrance", time: t0 + 4_500_000 }),
  ];
  return Model.buildView(rows, events, t0 + 4_600_000);
}

test("the erg list groups who is waiting by flight, started flights first", () => {
  const groups = Model.waitingForErg(midRace());
  assert.deepEqual(groups.map((g) => [g.flight, g.started, g.people.map((p) => p.name)]), [
    ["7:15", true, ["Avery Cole"]],
    ["8:10", false, ["Jamie Lowe"]],
  ]);
  assert.deepEqual(Model.ergEntered(midRace()).map((p) => p.name), ["Dana Price", "Blair Nolan", "Sam Carter"]);
});

test("the stadium lists offer only people it could be", () => {
  const v = midRace();
  const entrance = Model.nameCandidates(v, "entrance");
  assert.deepEqual(entrance.main.map((g) => g.people.map((p) => p.name)), [["Avery Cole", "Blair Nolan"]]);
  assert.deepEqual(entrance.extra, []);
  const exit = Model.nameCandidates(v, "exit");
  assert.deepEqual(exit.main.map((g) => g.people.map((p) => p.name)), [["Sam Carter"]]);
  assert.deepEqual(exit.extra.map((g) => g.people.map((p) => p.name)), [["Avery Cole", "Blair Nolan"]]);
  assert.deepEqual(Model.unnamedTaps(v, "entrance").map((t) => t.id), ["i9"]);
  assert.deepEqual(Model.namedTaps(v, "entrance").map((t) => [t.id, t.person.name]), [["i3", "Sam Carter"]]);
});

test("bestOffset trusts the sample with the shortest round trip", () => {
  assert.equal(Model.bestOffset([{ rtt: 300, offset: 5 }, { rtt: 80, offset: -2 }, { rtt: 120, offset: 1 }]), -2);
  assert.equal(Model.bestOffset([]), null);
});
