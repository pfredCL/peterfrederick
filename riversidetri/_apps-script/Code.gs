/* Tri-Wrathlon timer: the web app behind peterfrederick.com/riversidetri.
   Lives in the race Sheet's Apps Script project, next to "model" (a copy of riversidetri/js/model.js).
   Setup and deployment steps: README.md in this folder. The PIN is the script property PIN. */

const TABS = { competitors: "Competitors", events: "Events", results: "Results" };
const COMPETITOR_HEADERS = ["Year", "Name", "Number", "Flight", "Non-traditional", "ID"];
const EVENT_HEADERS = ["Year", "Event ID", "Type", "Created", "Time", "Received", "Competitor", "Value", "Target", "Station", "Device"];
const RESULT_HEADERS = ["Year", "Place", "Name", "Number", "Flight", "Erg", "Run", "Stadium", "Total", "Non-traditional", "Status"];
const TYPES = ["start", "erg", "tap", "name", "void"];
const YEAR_PATTERN = /^2\d{3}$/;

function doGet() {
  return ContentService.createTextOutput("Tri-Wrathlon timer. The app talks to this address; there's nothing to see here.");
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad-request", message: "That request couldn't be read." });
  }
  if (!body || typeof body !== "object") {
    return reply({ ok: false, error: "bad-request", message: "That request couldn't be read." });
  }
  const pin = PropertiesService.getScriptProperties().getProperty("PIN");
  if (!pin || String(body.pin || "") !== pin) {
    return reply({ ok: false, error: "pin", message: "That PIN didn't work. Check it with the race organiser." });
  }
  // Every request says which year it is for, so an old page can't write into the wrong year.
  const year = body.year === undefined || body.year === null ? "" : String(body.year);
  if (!YEAR_PATTERN.test(year)) {
    return reply({ ok: false, error: "bad-request", message: "This page is out of date. Reload it." });
  }
  try {
    if (body.action === "state") return reply({ ok: true, serverTime: Date.now(), state: readState(year) });
    if (body.action === "write") {
      const result = writeEvents(Array.isArray(body.events) ? body.events : [], year);
      if (result.changed) {
        try {
          rebuildResults(year, true);
        } catch (err) {
          console.error(err && err.stack ? err.stack : err); // the events are safe; Results can be rebuilt from the menu
        }
      }
      return reply({ ok: true, serverTime: Date.now(), rejected: result.rejected, state: readState(year) });
    }
    return reply({ ok: false, error: "bad-request", message: "The timer asked for something this sheet doesn't do." });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return reply({ ok: false, error: "server", message: "The sheet couldn't do that just now. It will try again." });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tab(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

// Named rows with no ID, or whose ID an earlier row already has (a copied row): the earlier row keeps it.
function needIds(rows) {
  const seen = Object.create(null);
  return rows.filter((r) => {
    if (!String(r.name).trim()) return false;
    if (r.id && !seen[r.id]) { seen[r.id] = true; return false; }
    return true;
  });
}

// One year's Competitors as typed (display text keeps "7:15" as "7:15"). A named row without an ID gets one
// (IDs are unique across every year), and with fillBlankYear a named row with no Year gets this year.
function readCompetitorRows(year, fillBlankYear) {
  const sh = tab(TABS.competitors);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, COMPETITOR_HEADERS.length).getDisplayValues().map((v, i) => ({
    row: i + 2, year: String(v[0]).trim(), name: v[1], number: v[2], flight: v[3], nontrad: v[4], id: String(v[5]).trim(),
  }));
  const blankYear = (r) => fillBlankYear && !r.year && String(r.name).trim();
  if (needIds(rows).length || rows.some(blankYear)) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const years = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
      const ids = sh.getRange(2, 6, last - 1, 1).getDisplayValues();
      rows.forEach((r, i) => { r.year = String(years[i][0]).trim(); r.id = String(ids[i][0]).trim(); });
      needIds(rows).forEach((r) => {
        r.id = "c" + Utilities.getUuid().replace(/-/g, "").slice(0, 7);
        sh.getRange(r.row, 6).setValue(r.id);
      });
      rows.filter(blankYear).forEach((r) => {
        r.year = year;
        sh.getRange(r.row, 1).setValue(year);
      });
    } finally {
      lock.releaseLock();
    }
  }
  return rows.filter((r) => r.year === year).map((r) => ({
    row: r.row, name: r.name, number: r.number, flight: r.flight, nontrad: r.nontrad, id: r.id,
  }));
}

// Every Events row of every year, each with its year.
function readEventRows() {
  const sh = tab(TABS.events);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, EVENT_HEADERS.length).getValues().map((v) => ({
    year: String(v[0]).trim(),
    id: String(v[1]), type: String(v[2]), created: Number(v[3]), time: v[4] === "" ? null : Number(v[4]),
    received: Number(v[5]), competitor: String(v[6]), value: String(v[7]), target: String(v[8]),
    station: String(v[9]), device: String(v[10]),
  }));
}

// One year's events, in the shape the phones know (no year key).
function readEvents(year) {
  return readEventRows().filter((e) => e.year === year).map((e) => {
    const out = Object.assign({}, e);
    delete out.year;
    return out;
  });
}

// Every write changes "gen", so a reader that started before the write can't cache its stale copy.
// Flushing first means a reader that starts after this sees the new rows, not the old sheet.
// Cached copies are keyed by gen, so a new gen retires them all; the old keys expire on their own.
function invalidate() {
  SpreadsheetApp.flush();
  CacheService.getScriptCache().put("gen", String(Date.now()) + Math.random(), 21600);
}

function readState(year) {
  const cache = CacheService.getScriptCache();
  const gen = cache.get("gen") || "0";
  const key = "state:" + year + ":" + gen;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const state = { competitors: readCompetitorRows(year, true), events: readEvents(year) };
  const json = JSON.stringify(state);
  try {
    if ((cache.get("gen") || "0") === gen && Utilities.newBlob(json).getBytes().length < 90000) cache.put(key, json, 60);
  } catch (err) {
    // the cache is only a speed-up
  }
  return state;
}

// Tabs start with a fixed number of rows; add rows rather than fail when a write would run past the end.
function ensureRows(sh, lastRowNeeded) {
  const max = sh.getMaxRows();
  if (lastRowNeeded > max) sh.insertRowsAfter(max, lastRowNeeded - max);
}

// Shape checks only; the phones do the real validation. Returns "" when the event is fine.
function checkEvent(e, known, flights, types, clearedAt) {
  if (!e || typeof e.id !== "string" || !e.id || e.id.length > 64) return "It had no ID.";
  if (TYPES.indexOf(e.type) < 0) return "It wasn't a kind of entry the timer knows.";
  if (typeof e.created !== "number") return "It didn't say when it was made.";
  if (clearedAt && e.created < clearedAt) return "It was made before the timing data was cleared.";
  if (e.type === "start") {
    if (!flights[e.value]) return "There's no " + e.value + " flight in Competitors.";
    if (typeof e.time !== "number") return "It had no start time.";
  }
  if (e.type === "erg") {
    if (!known[e.competitor]) return "That person isn't in Competitors any more.";
    const t = Number(e.value);
    if (!(t > 0 && t < 5 * 36000 && Math.round(t) === t)) return "The erg time wasn't a time.";
  }
  if (e.type === "tap") {
    if (e.station !== "entrance" && e.station !== "exit") return "It didn't say which station.";
    if (typeof e.time !== "number") return "It had no time.";
  }
  if (e.type === "name") {
    if (types[e.target] !== "tap") return "The time it names isn't in the sheet.";
    if (e.competitor && !known[e.competitor]) return "That person isn't in Competitors any more.";
  }
  if (e.type === "void" && !types[e.target]) return "The entry it cancels isn't in the sheet.";
  return "";
}

function writeEvents(events, year) {
  const rejected = [];
  if (!events.length) return { rejected: rejected, changed: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let changed = false;
  try {
    const clearedAt = Number(PropertiesService.getScriptProperties().getProperty("CLEARED_AT_" + year)) || 0;
    const known = Object.create(null);
    const flights = Object.create(null);
    const comp = tab(TABS.competitors);
    if (comp.getLastRow() > 1) {
      comp.getRange(2, 1, comp.getLastRow() - 1, COMPETITOR_HEADERS.length).getDisplayValues().forEach((v) => {
        // A blank Year is about to become this year's. The lock is held, so readCompetitorRows can't be used here.
        const y = String(v[0]).trim();
        if (y !== year && y !== "") return;
        if (String(v[5]).trim()) known[String(v[5]).trim()] = true;
        const f = Model.parseFlight(v[3]);
        if (f) flights[f.label] = true;
      });
    }
    const stored = Object.create(null); // event IDs of every year
    const types = Object.create(null); // this year's events only: what a name or void may point at
    readEventRows().forEach((e) => {
      stored[e.id] = true;
      if (e.year === year) types[e.id] = e.type;
    });
    const received = Date.now();
    const rows = [];
    events.forEach((e) => {
      if (e && stored[e.id]) return; // already stored: resending is harmless
      const why = checkEvent(e, known, flights, types, clearedAt);
      if (why) { rejected.push({ id: e && e.id ? String(e.id) : "", reason: why }); return; }
      stored[e.id] = true;
      types[e.id] = e.type; // later events in the same batch may point at this one
      rows.push([year, e.id, e.type, e.created, typeof e.time === "number" ? e.time : "", received,
        e.competitor || "", e.value === undefined || e.value === null ? "" : String(e.value), e.target || "", e.station || "", e.device || ""]);
    });
    if (rows.length) {
      const ev = tab(TABS.events);
      const first = ev.getLastRow() + 1;
      ensureRows(ev, first + rows.length - 1);
      // Text columns stay text, so a rebuilt Events tab cannot turn "7:15" into a time.
      ev.getRange(first, 1, rows.length, 3).setNumberFormat("@");
      ev.getRange(first, 7, rows.length, 5).setNumberFormat("@");
      ev.getRange(first, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
      invalidate();
      changed = true;
    }
  } finally {
    lock.releaseLock();
  }
  return { rejected: rejected, changed: changed };
}

// The Results tab: one flat row per competitor per year, newest year first, so it filters and sorts like a table.
// Only this year's rows are rebuilt; every other year's rows stay as they are (past years can be typed in by hand).
// Call it without the lock held: it takes the lock itself.
function rebuildResults(year, fillBlankYear) {
  const competitors = readCompetitorRows(year, fillBlankYear); // takes the lock itself if it has to fill something in
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const view = Model.buildView(competitors, readEvents(year), Date.now());
    const ranks = Model.rank(view.people);
    const fmt = (t) => (t === null ? "" : Model.formatTenths(t));
    const line = (place, p) => [year, place, p.name + (p.nontrad ? "*" : ""), p.number === null ? "" : p.number, p.flight,
      fmt(p.erg), fmt(p.run), fmt(p.stadium), fmt(p.total), p.nontrad ? "Yes" : "", p.status];
    const mine = [];
    ranks.overall.forEach((r) => mine.push(line(r.place, r.person)));
    ranks.nontrad.forEach((r) => mine.push(line(r.place, r.person)));
    view.people.filter((p) => p.total === null).forEach((p) => mine.push(line("", p)));
    const sh = tab(TABS.results);
    const last = sh.getLastRow();
    const others = last < 2 ? [] : sh.getRange(2, 1, last - 1, RESULT_HEADERS.length).getDisplayValues().filter((r) =>
      r.some((c) => String(c).trim() !== "") && String(r[0]).trim() !== year);
    // Array sort is stable, so each year keeps its own order.
    const rows = others.concat(mine).sort((a, b) => (Number(b[0]) || 0) - (Number(a[0]) || 0));
    rows.unshift(RESULT_HEADERS);
    sh.clearContents();
    ensureRows(sh, rows.length);
    sh.getRange(1, 1, rows.length, RESULT_HEADERS.length).setNumberFormat("@").setValues(rows.map((r) => r.map(String)));
  } finally {
    lock.releaseLock();
  }
}

// Menu: rebuild every year that has events. A year with none (typed into Results by hand) is left alone.
function rebuildAllResults() {
  const years = Object.create(null);
  readEventRows().forEach((e) => { if (e.year) years[e.year] = true; });
  // The menu doesn't know which year is current, so it fills no blank Years.
  Object.keys(years).forEach((y) => rebuildResults(y, false));
}

// Simple trigger: a hand edit (say, a late entry in Competitors) shows on the phones at the next refresh.
function onEdit() {
  invalidate();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Tri-Wrathlon")
    .addItem("Rebuild results", "rebuildAllResults")
    .addItem("Clear timing data", "clearTimingData")
    .addToUi();
}

function clearTimingData() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt("Clear timing data",
    "Type the year to clear, like 2026. This deletes that year's flight starts, erg times and stadium times and rebuilds its Results. " +
    "Competitors and other years stay. It can't be undone.",
    ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  const y = String(answer.getResponseText()).trim();
  if (!YEAR_PATTERN.test(y)) {
    ui.alert("That isn't a year, so nothing was cleared.");
    return;
  }
  let found = false;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ev = tab(TABS.events);
    const last = ev.getLastRow();
    const all = last < 2 ? [] : ev.getRange(2, 1, last - 1, EVENT_HEADERS.length).getValues();
    found = all.some((r) => String(r[0]).trim() === y);
    if (found) {
      const kept = all.filter((r) => String(r[0]).trim() !== y && r.some((c) => c !== ""));
      ev.getRange(2, 1, last - 1, EVENT_HEADERS.length).clearContent();
      if (kept.length) {
        ev.getRange(2, 1, kept.length, 3).setNumberFormat("@");
        ev.getRange(2, 7, kept.length, 5).setNumberFormat("@");
        ev.getRange(2, 1, kept.length, EVENT_HEADERS.length).setValues(kept);
      }
      invalidate();
      // Phones may still hold rehearsal events; writeEvents refuses anything made before this moment.
      PropertiesService.getScriptProperties().setProperty("CLEARED_AT_" + y, String(Date.now()));
    }
  } finally {
    lock.releaseLock();
  }
  if (!found) {
    ui.alert("There's no " + y + " timing data, so nothing was cleared.");
    return;
  }
  rebuildResults(y, false);
}

// Run once from the editor: tabs, headers, text formats, protection and the menu.
// A Sheet made before the Year column existed is upgraded: rows already typed keep their data and get a blank Year.
function setup() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, headers, rebuildable) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() > 0 && sh.getRange(1, 1).getDisplayValue() !== "Year") {
      if (rebuildable) sh.clearContents();
      else sh.insertColumnBefore(1);
    }
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
    return sh;
  };
  make(TABS.competitors, COMPETITOR_HEADERS, false).getRange("A:F").setNumberFormat("@");
  const ev = make(TABS.events, EVENT_HEADERS, false);
  ev.getRange("A:C").setNumberFormat("@");
  ev.getRange("D:F").setNumberFormat("0");
  ev.getRange("G:K").setNumberFormat("@");
  make(TABS.results, RESULT_HEADERS, true);
  [TABS.events, TABS.results].forEach((name) => {
    const sh = ss.getSheetByName(name);
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach((p) => p.remove());
    const p = sh.protect().setDescription("Written by the timer. Edit Competitors instead.");
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  onOpen();
  if (!PropertiesService.getScriptProperties().getProperty("PIN")) {
    SpreadsheetApp.getUi().alert("One more step", "Add a script property called PIN (Project Settings, Script properties) before deploying.",
      SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
