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

function makeWorld() {
  const sheets = {};
  const props = { PIN: "1234" };
  const cache = new Map();
  let held = false;
  const ui = {
    ButtonSet: { YES_NO: "YES_NO", OK: "OK" }, Button: { YES: "YES", NO: "NO" },
    alert: () => "YES",
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
  const authed = (body) => post(Object.assign({ pin: "1234" }, body));
  ctx.setup();
  const comp = (rows) => {
    sheets.Competitors.data = [sheets.Competitors.data[0]].concat(rows);
    sheets.Competitors.maxRows = Math.max(5, rows.length + 1);
  };
  return { ctx, sheets, props, cache, post, authed, comp, eventRows: () => sheets.Events.data.slice(1).filter((r) => r && r[0]) };
}

const ROSTER = [["Ann Rower", "12", "7:15", "", ""], ["Bo Runner", "13", "8:10", "Yes", ""], ["Cy Copy", "14", "7:15", "", ""]];
const BASE = Date.now() - 3 * 3600000;
const ev = (o) => Object.assign({ created: BASE, device: "t" }, o);

test("setup creates the three tabs with headers", () => {
  const w = makeWorld();
  assert.deepEqual(Object.keys(w.sheets).sort(), ["Competitors", "Events", "Results"]);
  assert.deepEqual(w.sheets.Competitors.data[0], ["Name", "Number", "Flight", "Non-traditional", "ID"]);
  assert.equal(w.sheets.Events.data[0][0], "Event ID");
  assert.equal(w.sheets.Results.data[0][0], "Place");
  w.ctx.setup(); // running it again is fine
});

test("wrong PIN and unreadable requests", () => {
  const w = makeWorld();
  const bad = w.post({ action: "state", pin: "nope" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "pin");
  assert.equal(w.post({ action: "state" }).error, "pin");
  assert.equal(w.post("hello").error, "bad-request");
  assert.equal(w.post(null).error, "bad-request");
  assert.equal(JSON.parse(w.ctx.doPost({ postData: { contents: "{oops" } }).getContent()).error, "bad-request");
  assert.equal(w.authed({ action: "dance" }).error, "bad-request");
});

test("state gives IDs to rows without one, and a copied row a new one", () => {
  const w = makeWorld();
  w.comp([["Ann Rower", "12", "7:15", "", "cabc"], ["Bo Runner", "13", "8:10", "Yes", ""], ["Cy Copy", "14", "7:15", "", "cabc"], ["", "", "", "", ""]]);
  const r = w.authed({ action: "state" });
  assert.equal(r.ok, true);
  const ids = r.state.competitors.map((c) => c.id);
  assert.equal(ids[0], "cabc");
  assert.ok(ids[1] && ids[1] !== "cabc");
  assert.ok(ids[2] && ids[2] !== "cabc" && ids[2] !== ids[1]);
  assert.equal(w.sheets.Competitors.data[2][4], ids[1]);
  assert.equal(w.sheets.Competitors.data[3][4], ids[2]);
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
  // The text columns of appended Events rows are formatted as text (Value is column 7)
  assert.ok(w.sheets.Events.formats.some((f) => f.col <= 7 && f.col + f.cols > 7 && f.format === "@" && f.row === 2));
  assert.ok(w.sheets.Results.data.some((row) => row[1] === "Ann Rower" && row[0] === "1"));
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

test("clearing timing data empties Events and refuses older events", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  w.authed({ action: "write", events: [ev({ id: "k1", type: "erg", competitor: ann, value: "22800", created: Date.now() - 5000 })] });
  assert.equal(w.eventRows().length, 1);
  w.ctx.clearTimingData();
  assert.equal(w.eventRows().length, 0);
  assert.equal(w.authed({ action: "state" }).state.events.length, 0);
  const r = w.authed({ action: "write", events: [
    ev({ id: "k2", type: "erg", competitor: ann, value: "22800", created: Date.now() - 5000 }),
    ev({ id: "k3", type: "erg", competitor: ann, value: "22800", created: Date.now() + 1000 }),
  ] });
  assert.deepEqual(r.rejected, [{ id: "k2", reason: "It was made before the timing data was cleared." }]);
  assert.equal(w.eventRows().length, 1);
});

test("rebuildResults writes headers first and lists a finisher", () => {
  const w = makeWorld();
  const { ann } = twoPeople(w);
  w.authed({ action: "write", events: finishBatch(ann, BASE + 1000) });
  w.sheets.Results.data = [];
  w.ctx.rebuildResults();
  const rows = w.sheets.Results.data;
  assert.deepEqual(rows[0], ["Place", "Name", "Number", "Flight", "Erg", "Run", "Stadium", "Total", "Non-traditional", "Status"]);
  const mine = rows.find((r) => r[1] === "Ann Rower");
  assert.equal(mine[0], "1");
  assert.ok(mine[7]);
  assert.ok(rows.some((r) => r[1] === "Not finished"));
  assert.ok(rows.some((r) => r[1] === "Bo Runner*"));
});
