// Runs the real Code.gs (with model.js) in a vm with small in-memory stand-ins for the Apps Script services.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import Model from "../js/model.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const modelSource = read("../_apps-script/model.js");
const codeSource = read("../_apps-script/Code.gs");

function makeSheet(name, maxRows) {
  const sh = {
    name, data: [], maxRows, frozen: 0, formats: [], protections: [],
    getLastRow() {
      let last = 0;
      sh.data.forEach((r, i) => { if (r && r.some((c) => c !== "" && c !== undefined)) last = i + 1; });
      return last;
    },
    getMaxRows() { return sh.maxRows; },
    insertRowsAfter(after, n) { assert.ok(after <= sh.maxRows); sh.maxRows += n; },
    clearContents() { sh.data = []; },
    insertColumnBefore(n) { assert.equal(n, 1); sh.data.forEach((r) => { if (r) r.unshift(""); }); },
    setFrozenRows(n) { sh.frozen = n; },
    protect() {
      const p = {
        setDescription() { return p; }, getEditors() { return []; }, removeEditors() { return p; },
        canDomainEdit() { return true; }, setDomainEdit() { return p; }, remove() {},
      };
      sh.protections.push(p);
      return p;
    },
    getProtections() { return sh.protections; },
    getRange(a, b, c, d) {
      let row, col, rows, cols;
      if (typeof a === "string") {
        const m = /^([A-Z]):([A-Z])$/.exec(a);
        row = 1; col = m[1].charCodeAt(0) - 64; rows = sh.maxRows; cols = m[2].charCodeAt(0) - m[1].charCodeAt(0) + 1;
      } else {
        row = a; col = b; rows = c || 1; cols = d || 1;
      }
      if (row < 1 || col < 1 || row + rows - 1 > sh.maxRows) {
        throw new Error("The coordinates or dimensions of the range are invalid (outside the dimensions of the sheet).");
      }
      const cell = (i, j) => { const r = sh.data[row - 1 + i]; return r && r[col - 1 + j] !== undefined ? r[col - 1 + j] : ""; };
      const grid = (f) => Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => f(cell(i, j))));
      const range = {
        getValues: () => grid((v) => v),
        getDisplayValue: () => String(cell(0, 0)),
        getDisplayValues: () => grid((v) => String(v)),
        setValues(vals) {
          assert.equal(vals.length, rows, "setValues row count");
          vals.forEach((vr, i) => {
            assert.equal(vr.length, cols, "setValues column count");
            const at = row - 1 + i;
            sh.data[at] = sh.data[at] || [];
            vr.forEach((v, j) => { sh.data[at][col - 1 + j] = v; });
          });
          return range;
        },
        setValue(v) { return range.setValues([[v]]); },
        setNumberFormat(f) { sh.formats.push({ row, col, rows, cols, format: f }); return range; },
        clearContent() {
          for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            if (sh.data[row - 1 + i]) sh.data[row - 1 + i][col - 1 + j] = "";
          }
          return range;
        },
        setFontWeight() { return range; },
      };
      return range;
    },
  };
  return sh;
}

function makeWorld(preset) {
  const sheets = {};
  if (preset) preset(sheets);
  const alerts = [];
  const answer = { button: "OK", text: "" };
  const props = { PIN: "1234" };
  const cache = new Map();
  let held = false;
  const ui = {
    ButtonSet: { YES_NO: "YES_NO", OK: "OK", OK_CANCEL: "OK_CANCEL" }, Button: { YES: "YES", NO: "NO", OK: "OK", CANCEL: "CANCEL" },
    alert: (...a) => { alerts.push(a.join(" | ")); return "OK"; },
    prompt: (...a) => { alerts.push("prompt: " + a.join(" | ")); return { getSelectedButton: () => answer.button, getResponseText: () => answer.text }; },
    createMenu() { const m = { addItem: () => m, addToUi() {} }; return m; },
  };
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n, 5)),
      }),
      getUi: () => ui,
      flush() {},
      ProtectionType: { SHEET: "SHEET", RANGE: "RANGE" },
    },
    CacheService: { getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => { cache.set(k, v); },
      remove: (k) => { cache.delete(k); },
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { if (held) throw new Error("waitLock while the lock is already held"); held = true; },
      releaseLock() { held = false; },
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
    }) },
    Utilities: {
      getUuid: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, () => Math.floor(Math.random() * 16).toString(16)),
      newBlob: (s) => ({ getBytes: () => Buffer.from(s, "utf8") }),
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (s) => ({ text: s, setMimeType() { return this; }, getContent() { return this.text; } }),
    },
  });
  vm.runInContext(modelSource + "\n" + codeSource, ctx);
  const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  const authed = (body) => post(Object.assign({ pin: "1234", year: 2026 }, body));
  ctx.setup();
  const comp = (rows) => {
    sheets.Competitors.data = [sheets.Competitors.data[0]].concat(rows);
    sheets.Competitors.maxRows = Math.max(5, rows.length + 1);
  };
  // Put rows straight into a tab (below its header), growing the stand-in sheet to fit.
  const fill = (name, rows) => {
    sheets[name].data = [sheets[name].data[0]].concat(rows);
    sheets[name].maxRows = Math.max(5, rows.length + 1);
  };
  const snapshot = () => JSON.stringify([sheets.Competitors.data, sheets.Events.data, sheets.Results.data, props]);
  return {
    ctx, sheets, props, cache, post, authed, comp, fill, snapshot, alerts, answer,
    eventRows: (year) => sheets.Events.data.slice(1).filter((r) => r && r[1] && (!year || r[0] === year)),
  };
}

const ROSTER = [["2026", "Ann Rower", "12", "7:15", "", ""], ["2026", "Bo Runner", "13", "8:10", "Yes", ""], ["2026", "Cy Copy", "14", "7:15", "", ""]];
const BASE = Date.now() - 3 * 3600000;
const ev = (o) => Object.assign({ created: BASE, device: "t" }, o);

test("setup creates the three tabs with headers", () => {
  const w = makeWorld();
  assert.deepEqual(Object.keys(w.sheets).sort(), ["Competitors", "Events", "Results"]);
  assert.deepEqual(w.sheets.Competitors.data[0], ["Year", "Name", "Number", "Flight", "Non-traditional", "ID"]);
  assert.deepEqual(w.sheets.Events.data[0].slice(0, 2), ["Year", "Event ID"]);
  assert.deepEqual(w.sheets.Results.data[0].slice(0, 2), ["Year", "Place"]);
  w.ctx.setup(); // running it again is fine
});

test("wrong PIN and unreadable requests", () => {
  const w = makeWorld();
  const bad = w.post({ action: "state", pin: "nope" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "pin");
  assert.equal(w.post({ action: "state" }).error, "pin"); // a wrong PIN is told first, year or not
  assert.equal(w.post("hello").error, "bad-request");
  assert.equal(w.post(null).error, "bad-request");
  assert.equal(JSON.parse(w.ctx.doPost({ postData: { contents: "{oops" } }).getContent()).error, "bad-request");
  assert.equal(w.authed({ action: "dance" }).error, "bad-request");
});

test("state gives IDs to rows without one, and a copied row a new one", () => {
  const w = makeWorld();
  w.comp([["2026", "Ann Rower", "12", "7:15", "", "cabc"], ["2026", "Bo Runner", "13", "8:10", "Yes", ""], ["2026", "Cy Copy", "14", "7:15", "", "cabc"], ["", "", "", "", "", ""]]);
  const r = w.authed({ action: "state" });
  assert.equal(r.ok, true);
  const ids = r.state.competitors.map((c) => c.id);
  assert.equal(ids[0], "cabc");
  assert.ok(ids[1] && ids[1] !== "cabc");
  assert.ok(ids[2] && ids[2] !== "cabc" && ids[2] !== ids[1]);
  assert.equal(w.sheets.Competitors.data[2][5], ids[1]);
  assert.equal(w.sheets.Competitors.data[3][5], ids[2]);
  assert.equal(r.state.competitors[1].flight, "8:10"); // text stays text
  assert.equal(w.authed({ action: "state" }).state.competitors[2].id, ids[2]); // stable on the next read
});

function twoPeople(w) {
  w.comp(ROSTER.map((r) => r.slice()));
  const comps = w.authed({ action: "state" }).state.competitors;
  return { ann: comps[0].id, bo: comps[1].id, cy: comps[2].id };
}

function finishBatch(ann, start) {
  return [
    ev({ id: "e1", type: "start", value: "7:15", time: start }),
    ev({ id: "e2", type: "erg", competitor: ann, value: "22800", created: BASE + 2000 }),
    ev({ id: "e3", type: "tap", station: "entrance", time: start + 75 * 60000, created: BASE + 3000 }),
    ev({ id: "e4", type: "name", target: "e3", competitor: ann, created: BASE + 4000 }),
    ev({ id: "e5", type: "tap", station: "exit", time: start + 90 * 60000, created: BASE + 5000 }),
    ev({ id: "e6", type: "name", target: "e5", competitor: ann, created: BASE + 6000 }),
  ];
}

test("a batch with start, erg, tap and name is stored, and a resend adds nothing", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  const start = BASE + 1000;
  const batch = finishBatch(ann, start);
  const r = w.authed({ action: "write", events: batch });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rejected, []);
  assert.equal(w.eventRows().length, 6);
  const again = w.authed({ action: "write", events: batch });
  assert.deepEqual(again.rejected, []);
  assert.equal(w.eventRows().length, 6);
  const view = Model.buildView(again.state.competitors, again.state.events, start + 100 * 60000);
  const p = view.people.find((x) => x.id === ann);
  assert.equal(p.erg, 22800);
  assert.equal(p.arrival, start + 75 * 60000);
  assert.equal(p.finish, start + 90 * 60000);
  assert.ok(p.total > 0);
  // The text columns of appended Events rows are formatted as text (Value is column 8)
  assert.ok(w.sheets.Events.formats.some((f) => f.col <= 8 && f.col + f.cols > 8 && f.format === "@" && f.row === 2));
  assert.ok(w.sheets.Results.data.some((row) => row[2] === "Ann Rower" && row[1] === "1" && row[0] === "2026"));
});

test("events the sheet can't accept are rejected with a reason", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  const r = w.authed({ action: "write", events: [
    ev({ id: "x1", type: "start", value: "9:59", time: BASE }),
    ev({ id: "x2", type: "name", target: "nothere", competitor: ann }),
    ev({ id: "x3", type: "void", target: "nothere" }),
    ev({ id: "x4", type: "erg", competitor: "cnope", value: "22800" }),
  ] });
  assert.equal(r.ok, true);
  const why = Object.fromEntries(r.rejected.map((x) => [x.id, x.reason]));
  assert.equal(why.x1, "There's no 9:59 flight in Competitors.");
  assert.equal(why.x2, "The time it names isn't in the sheet.");
  assert.equal(why.x3, "The entry it cancels isn't in the sheet.");
  assert.equal(why.x4, "That person isn't in Competitors any more.");
  assert.equal(w.eventRows().length, 0);
});

test("removing a name and voiding a start are accepted and show in the view", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  const start = BASE + 1000;
  w.authed({ action: "write", events: [
    ev({ id: "s1", type: "start", value: "7:15", time: start }),
    ev({ id: "t1", type: "tap", station: "entrance", time: start + 60000 * 70, created: BASE + 2000 }),
    ev({ id: "n1", type: "name", target: "t1", competitor: ann, created: BASE + 3000 }),
  ] });
  const before = w.authed({ action: "state" }).state;
  const pb = Model.buildView(before.competitors, before.events, start + 3600000).people.find((x) => x.id === ann);
  assert.equal(pb.arrival, start + 60000 * 70);
  const r = w.authed({ action: "write", events: [
    ev({ id: "n2", type: "name", target: "t1", competitor: "", created: BASE + 4000 }),
    ev({ id: "v1", type: "void", target: "s1", created: BASE + 5000 }),
  ] });
  assert.deepEqual(r.rejected, []);
  const view = Model.buildView(r.state.competitors, r.state.events, start + 3600000);
  const p = view.people.find((x) => x.id === ann);
  assert.equal(p.arrival, null);
  assert.equal(p.start, null);
});

test("writing past the sheet's last row adds rows", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  assert.equal(w.sheets.Events.getMaxRows(), 5);
  const events = Array.from({ length: 12 }, (_, i) => ev({ id: "g" + i, type: "erg", competitor: ann, value: "22800", created: BASE + i }));
  const r = w.authed({ action: "write", events });
  assert.deepEqual(r.rejected, []);
  assert.equal(w.eventRows().length, 12);
  assert.ok(w.sheets.Events.getMaxRows() >= 13);
  assert.equal(r.state.events.length, 12);
});


// ---- Years ----

const evRow = (year, id, type, o) => Object.assign({ year, id, type, created: BASE, time: "", received: BASE, competitor: "", value: "", target: "", station: "", device: "t" }, o);
const toRow = (e) => [e.year, e.id, e.type, e.created, e.time, e.received, e.competitor, e.value, e.target, e.station, e.device];
const HAND_2025 = ["2025", "1", "Old Winner", "5", "7:15", "1:00:00.0", "10:00.0", "5:00.0", "1:15:00.0", "", ""];
const HAND_2024 = ["2024", "1", "Hand Typed", "1", "7:15", "", "", "", "1:00:00.0", "", ""];

function twoYears(w) {
  w.fill("Competitors", [
    ["2025", "Old Timer", "5", "7:15", "", "c2025"], ["2026", "Ann Rower", "12", "7:15", "", "c2026"],
  ]);
  w.fill("Events", [
    toRow(evRow("2025", "old1", "erg", { competitor: "c2025", value: "20000" })),
    toRow(evRow("2026", "new1", "erg", { competitor: "c2026", value: "22800" })),
  ]);
}

test("a request without a usable year is out of date, but a wrong PIN is still a PIN problem", () => {
  const w = makeWorld();
  const old = { ok: false, error: "bad-request", message: "This page is out of date. Reload it." };
  assert.deepEqual(w.authed({ action: "state", year: undefined }), old);
  assert.deepEqual(w.authed({ action: "state", year: "26" }), old);
  assert.deepEqual(w.authed({ action: "state", year: "abc" }), old);
  assert.deepEqual(w.authed({ action: "write", events: [], year: "1999" }), old);
  assert.equal(w.post({ action: "state", pin: "nope" }).error, "pin");
  assert.equal(w.authed({ action: "state", year: "2026" }).ok, true);
  assert.equal(w.authed({ action: "state", year: 2026 }).ok, true);
});

test("state is one year only, even asked back to back", () => {
  const w = makeWorld();
  twoYears(w);
  for (let i = 0; i < 2; i++) {
    const a = w.authed({ action: "state", year: 2026 }).state;
    assert.deepEqual(a.competitors.map((c) => c.id), ["c2026"]);
    assert.deepEqual(a.events.map((e) => e.id), ["new1"]);
    const b = w.authed({ action: "state", year: 2025 }).state;
    assert.deepEqual(b.competitors.map((c) => c.id), ["c2025"]);
    assert.deepEqual(b.events.map((e) => e.id), ["old1"]);
    assert.equal("year" in b.competitors[0], false);
    assert.equal("year" in b.events[0], false);
  }
});

test("a blank Year is filled on a state call, but not when results are rebuilt from the menu", () => {
  const w = makeWorld();
  w.fill("Competitors", [["", "Ann Rower", "12", "7:15", "", "c1"]]);
  const r = w.authed({ action: "state" });
  assert.equal(w.sheets.Competitors.data[1][0], "2026");
  assert.deepEqual(r.state.competitors.map((c) => c.name), ["Ann Rower"]);

  const m = makeWorld();
  m.fill("Competitors", [["", "Bo Runner", "13", "8:10", "", ""]]);
  m.fill("Events", [toRow(evRow("2026", "e1", "erg", { competitor: "x", value: "22800" }))]);
  m.ctx.rebuildAllResults();
  assert.equal(m.sheets.Competitors.data[1][0], "");
  assert.ok(m.sheets.Competitors.data[1][5]); // the ID is still filled
});

test("a write is stamped with its year and checked against that year", () => {
  const w = makeWorld();
  twoYears(w);
  const r = w.authed({ action: "write", events: [
    ev({ id: "w1", type: "erg", competitor: "c2026", value: "22800" }),
    ev({ id: "w2", type: "erg", competitor: "c2025", value: "22800" }),
    ev({ id: "old1", type: "erg", competitor: "c2026", value: "22800" }),
    ev({ id: "w3", type: "void", target: "old1" }),
  ] });
  assert.deepEqual(r.rejected, [
    { id: "w2", reason: "That person isn't in Competitors any more." },
    { id: "w3", reason: "The entry it cancels isn't in the sheet." },
  ]);
  assert.equal(w.sheets.Events.data.slice(1).find((x) => x[1] === "w1")[0], "2026");
  assert.equal(w.eventRows().length, 3); // old1, new1, w1: old1 was not added again
  assert.equal(w.eventRows("2025").length, 1);
  assert.deepEqual(r.state.events.map((e) => e.id), ["new1", "w1"]);
});

test("a blank-Year competitor can already take events for this year", () => {
  const w = makeWorld();
  w.fill("Competitors", [["", "Ann Rower", "12", "7:15", "", "c1"]]);
  const r = w.authed({ action: "write", events: [ev({ id: "b1", type: "erg", competitor: "c1", value: "22800" })] });
  assert.deepEqual(r.rejected, []);
  assert.equal(w.sheets.Competitors.data[1][0], "2026");
});

test("Results keeps a hand-typed past year and has no blank or heading rows", () => {
  const w = makeWorld();
  const ids = twoPeople(w);
  w.sheets.Results.data.push(HAND_2025.slice());
  const bobStart = BASE + 2000;
  const batch = finishBatch(ids.ann, BASE + 1000).concat([
    ev({ id: "b1", type: "start", value: "8:10", time: bobStart }),
    ev({ id: "b2", type: "erg", competitor: ids.bo, value: "24000", created: BASE + 2000 }),
    ev({ id: "b3", type: "tap", station: "entrance", time: bobStart + 70 * 60000, created: BASE + 3000 }),
    ev({ id: "b4", type: "name", target: "b3", competitor: ids.bo, created: BASE + 4000 }),
    ev({ id: "b5", type: "tap", station: "exit", time: bobStart + 95 * 60000, created: BASE + 5000 }),
    ev({ id: "b6", type: "name", target: "b5", competitor: ids.bo, created: BASE + 6000 }),
  ]);
  const r = w.authed({ action: "write", events: batch });
  assert.deepEqual(r.rejected, []);
  const rows = w.sheets.Results.data;
  assert.deepEqual(rows[0], ["Year", "Place", "Name", "Number", "Flight", "Erg", "Run", "Stadium", "Total", "Non-traditional", "Status"]);
  const body = rows.slice(1);
  assert.deepEqual(body.map((x) => x[2]), ["Ann Rower", "Bo Runner*", "Cy Copy", "Old Winner"]);
  assert.deepEqual(body.map((x) => x[0]), ["2026", "2026", "2026", "2025"]);
  assert.equal(body[0][1], "1");
  assert.ok(body[1][1]); // the non-traditional finisher has a place of their own
  assert.equal(body[1][9], "Yes");
  assert.equal(body[2][1], ""); // not finished: no place
  assert.deepEqual(body[3], HAND_2025);
  assert.ok(body.every((x) => x.some((c) => c !== "")));
  // writing again leaves the 2025 row exactly as it was
  w.authed({ action: "write", events: [ev({ id: "z1", type: "erg", competitor: ids.cy, value: "23000", created: BASE + 9000 })] });
  assert.deepEqual(w.sheets.Results.data.slice(1).find((x) => x[0] === "2025"), HAND_2025);
});

function clearWorld() {
  const w = makeWorld();
  twoYears(w);
  w.sheets.Results.data.push(HAND_2025.slice(), HAND_2024.slice());
  return w;
}

test("clearing a year removes only that year's events and refuses its older ones", () => {
  const w = clearWorld();
  w.answer.text = " 2026 ";
  w.ctx.clearTimingData();
  assert.deepEqual(w.eventRows().map((x) => [x[0], x[1]]), [["2025", "old1"]]);
  assert.ok(Number(w.props.CLEARED_AT_2026) > 0);
  assert.equal(w.props.CLEARED_AT_2025, undefined);
  assert.equal(w.authed({ action: "state" }).state.events.length, 0);
  assert.equal(w.authed({ action: "state", year: 2025 }).state.events.length, 1);
  assert.ok(w.sheets.Results.data.some((x) => x[0] === "2025" && x[2] === "Old Winner")); // other years untouched
  const r = w.authed({ action: "write", events: [
    ev({ id: "k2", type: "erg", competitor: "c2026", value: "22800", created: Date.now() - 5000 }),
    ev({ id: "k3", type: "erg", competitor: "c2026", value: "22800", created: Date.now() + 1000 }),
  ] });
  assert.deepEqual(r.rejected, [{ id: "k2", reason: "It was made before the timing data was cleared." }]);
  assert.equal(w.eventRows("2026").length, 1);
  assert.ok(w.alerts.every((a) => a.startsWith("prompt: Clear timing data | Type the year to clear, like 2026.")));
});

test("clearing does nothing for a year with no events, Cancel, or something that isn't a year", () => {
  const w = clearWorld();
  const before = w.snapshot();
  w.answer.text = "2024";
  w.ctx.clearTimingData();
  assert.equal(w.snapshot(), before); // the hand-typed 2024 Results row stays
  assert.equal(w.alerts[w.alerts.length - 1], "There's no 2024 timing data, so nothing was cleared.");
  w.answer.text = "abc";
  w.ctx.clearTimingData();
  assert.equal(w.snapshot(), before);
  assert.equal(w.alerts[w.alerts.length - 1], "That isn't a year, so nothing was cleared.");
  w.answer.text = "2026";
  w.answer.button = "CANCEL";
  const n = w.alerts.length;
  w.ctx.clearTimingData();
  assert.equal(w.snapshot(), before);
  assert.equal(w.alerts.length, n + 1); // only the prompt itself
});

test("rebuild results from the menu rebuilds each year with events and leaves other years alone", () => {
  const w = clearWorld();
  w.ctx.rebuildAllResults();
  const rows = w.sheets.Results.data.slice(1);
  // 2025 and 2026 have events, so they are rebuilt from the Sheet; 2024 has none and stays as typed
  assert.deepEqual(rows.map((x) => [x[0], x[2]]), [["2026", "Ann Rower"], ["2025", "Old Timer"], ["2024", "Hand Typed"]]);
  assert.deepEqual(rows[2], HAND_2024);
});

test("setup upgrades a Sheet made before the Year column, and a second run changes nothing", () => {
  const w = makeWorld((sheets) => {
    sheets.Competitors = makeSheet("Competitors", 5);
    sheets.Competitors.data = [["Name", "Number", "Flight", "Non-traditional", "ID"], ["Ann Rower", "12", "7:15", "", "cabc"]];
    sheets.Results = makeSheet("Results", 5);
    sheets.Results.data = [["Place", "Name"], ["1", "Ann Rower"]];
  });
  const c = w.sheets.Competitors.data;
  assert.deepEqual(c[0], ["Year", "Name", "Number", "Flight", "Non-traditional", "ID"]);
  assert.deepEqual(c[1], ["", "Ann Rower", "12", "7:15", "", "cabc"]);
  assert.equal(w.sheets.Results.getLastRow(), 1);
  assert.equal(w.sheets.Results.data[0][0], "Year");
  const before = w.snapshot();
  w.ctx.setup();
  assert.equal(w.snapshot(), before);
  assert.equal(w.authed({ action: "state" }).state.competitors[0].name, "Ann Rower"); // a blank Year becomes this year's
});
