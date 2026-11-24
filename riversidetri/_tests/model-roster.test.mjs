import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";

test("normaliseRoster reads rows as typed and skips blank ones", () => {
  const { competitors, issues } = Model.normaliseRoster([
    { row: 2, name: "Dana Price", number: "8", flight: "8:10", nontrad: "", id: "c1" },
    { row: 3, name: "", number: "", flight: "", nontrad: "", id: "" },
    { row: 4, name: " Blair Nolan ", number: "", flight: "7:15:00", nontrad: "Yes", id: "c2" },
  ]);
  assert.deepEqual(issues, []);
  assert.deepEqual(competitors, [
    { id: "c1", row: 2, name: "Dana Price", number: 8, flight: "8:10", flightMinutes: 490, nontrad: false },
    { id: "c2", row: 4, name: "Blair Nolan", number: null, flight: "7:15", flightMinutes: 435, nontrad: true },
  ]);
});

test("normaliseRoster explains the rows it can't use", () => {
  const { competitors, issues } = Model.normaliseRoster([
    { row: 2, name: "", number: "8", flight: "8:10", nontrad: "", id: "" },
    { row: 3, name: "Sam Carter", number: "12", flight: "8.10", nontrad: "", id: "c3" },
    { row: 4, name: "Jamie Lowe", number: "12", flight: "8:10", nontrad: "", id: "c4" },
    { row: 5, name: "Pat Kelly", number: "twelve", flight: "8:10", nontrad: "", id: "c5" },
  ]);
  assert.deepEqual(competitors.map((c) => c.name), ["Sam Carter", "Jamie Lowe", "Pat Kelly"]);
  assert.equal(competitors[0].flight, "");
  assert.deepEqual(issues.map((i) => i.text), [
    "Row 2 of Competitors has no name, so it's left out. Add a name or clear the row.",
    'Row 3 of Competitors has "8.10" as its flight. Type it as a time, like 8:10.',
    'Row 5 of Competitors has "twelve" as its number. Use a whole number, or leave it blank.',
    "Number 12 is used more than once in Competitors (rows 3 and 4). Give each person their own number.",
  ]);
  assert.ok(issues.every((i) => i.kind === "roster"));
});

test("a missing flight is called out", () => {
  const { issues } = Model.normaliseRoster([{ row: 7, name: "Riley Grant", number: "", flight: "", nontrad: "", id: "c7" }]);
  assert.deepEqual(issues.map((i) => i.text), ["Row 7 of Competitors has no flight. Type one, like 8:10."]);
});

test("a number used on three rows lists them all", () => {
  const r = (n, id) => ({ row: n, name: "P" + n, number: "12", flight: "8:10", nontrad: "", id });
  const { issues } = Model.normaliseRoster([r(3, "a"), r(4, "b"), r(9, "c")]);
  assert.deepEqual(issues.map((i) => i.text), ["Number 12 is used more than once in Competitors (rows 3, 4 and 9). Give each person their own number."]);
});
