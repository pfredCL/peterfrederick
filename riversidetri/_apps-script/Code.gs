/* Tri-Wrathlon timer: the web app behind peterfrederick.com/riversidetri.
   Lives in the race Sheet's Apps Script project, next to "model" (a copy of riversidetri/js/model.js).
   Setup and deployment steps: README.md in this folder. The PIN is the script property PIN. */

const TABS = { competitors: "Competitors", events: "Events", results: "Results" };
const COMPETITOR_HEADERS = ["Name", "Number", "Flight", "Non-traditional", "ID"];
const EVENT_HEADERS = ["Event ID", "Type", "Created", "Time", "Received", "Competitor", "Value", "Target", "Station", "Device"];
const RESULT_HEADERS = ["Place", "Name", "Number", "Flight", "Erg", "Run", "Stadium", "Total", "Non-traditional", "Status"];
const TYPES = ["start", "erg", "tap", "name", "void"];
const CACHE_KEY = "state";

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
  try {
    if (body.action === "state") return reply({ ok: true, serverTime: Date.now(), state: readState() });
    if (body.action === "write") {
      const result = writeEvents(Array.isArray(body.events) ? body.events : []);
      if (result.changed) {
        try {
          rebuildResults();
        } catch (err) {
          console.error(err && err.stack ? err.stack : err); // the events are safe; Results can be rebuilt from the menu
        }
      }
      return reply({ ok: true, serverTime: Date.now(), rejected: result.rejected, state: readState() });
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

// Competitors as typed (display text keeps "7:15" as "7:15"), giving any named row without an ID one.
function readCompetitorRows() {
  const sh = tab(TABS.competitors);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, COMPETITOR_HEADERS.length).getDisplayValues();
  const rows = values.map((v, i) => ({ row: i + 2, name: v[0], number: v[1], flight: v[2], nontrad: v[3], id: String(v[4]).trim() }));
  if (needIds(rows).length) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ids = sh.getRange(2, 5, last - 1, 1).getDisplayValues();
      rows.forEach((r, i) => { r.id = String(ids[i][0]).trim(); });
      needIds(rows).forEach((r) => {
        r.id = "c" + Utilities.getUuid().replace(/-/g, "").slice(0, 7);
        sh.getRange(r.row, 5).setValue(r.id);
      });
    } finally {
      lock.releaseLock();
    }
  }
  return rows;
}

function readEvents() {
  const sh = tab(TABS.events);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, EVENT_HEADERS.length).getValues().map((v) => ({
    id: String(v[0]), type: String(v[1]), created: Number(v[2]), time: v[3] === "" ? null : Number(v[3]),
    received: Number(v[4]), competitor: String(v[5]), value: String(v[6]), target: String(v[7]),
    station: String(v[8]), device: String(v[9]),
  }));
}

// Every write changes "gen", so a reader that started before the write can't cache its stale copy.
// Flushing first means a reader that starts after this sees the new rows, not the old sheet.
function invalidate() {
  SpreadsheetApp.flush();
  const cache = CacheService.getScriptCache();
  cache.put("gen", String(Date.now()) + Math.random(), 21600);
  cache.remove(CACHE_KEY);
}

function readState() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const gen = cache.get("gen");
  const state = { competitors: readCompetitorRows(), events: readEvents() };
  const json = JSON.stringify(state);
  try {
    if (cache.get("gen") === gen && Utilities.newBlob(json).getBytes().length < 90000) cache.put(CACHE_KEY, json, 60);
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

function writeEvents(events) {
  const rejected = [];
  if (!events.length) return { rejected: rejected, changed: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let changed = false;
  try {
    const clearedAt = Number(PropertiesService.getScriptProperties().getProperty("CLEARED_AT")) || 0;
    const known = Object.create(null);
    const flights = Object.create(null);
    const comp = tab(TABS.competitors);
    if (comp.getLastRow() > 1) {
      comp.getRange(2, 1, comp.getLastRow() - 1, COMPETITOR_HEADERS.length).getDisplayValues().forEach((v) => {
        if (String(v[4]).trim()) known[String(v[4]).trim()] = true;
        const f = Model.parseFlight(v[2]);
        if (f) flights[f.label] = true;
      });
    }
    const types = Object.create(null);
    readEvents().forEach((e) => { types[e.id] = e.type; });
    const received = Date.now();
    const rows = [];
    events.forEach((e) => {
      if (e && types[e.id]) return; // already stored: resending is harmless
      const why = checkEvent(e, known, flights, types, clearedAt);
      if (why) { rejected.push({ id: e && e.id ? String(e.id) : "", reason: why }); return; }
      types[e.id] = e.type; // later events in the same batch may point at this one
      rows.push([e.id, e.type, e.created, typeof e.time === "number" ? e.time : "", received,
        e.competitor || "", e.value === undefined || e.value === null ? "" : String(e.value), e.target || "", e.station || "", e.device || ""]);
    });
    if (rows.length) {
      const ev = tab(TABS.events);
      const first = ev.getLastRow() + 1;
      ensureRows(ev, first + rows.length - 1);
      // Text columns stay text, so a rebuilt Events tab cannot turn "7:15" into a time.
      ev.getRange(first, 1, rows.length, 2).setNumberFormat("@");
      ev.getRange(first, 6, rows.length, 5).setNumberFormat("@");
      ev.getRange(first, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
      invalidate();
      changed = true;
    }
  } finally {
    lock.releaseLock();
  }
  return { rejected: rejected, changed: changed };
}

// The Results tab: a plain copy of the results so the Sheet works on its own.
function rebuildResults() {
  const view = Model.buildView(readCompetitorRows(), readEvents(), Date.now());
  const ranks = Model.rank(view.people);
  const fmt = (t) => (t === null ? "" : Model.formatTenths(t));
  const line = (place, p) => [place, p.name + (p.nontrad ? "*" : ""), p.number === null ? "" : p.number, p.flight,
    fmt(p.erg), fmt(p.run), fmt(p.stadium), fmt(p.total), p.nontrad ? "Yes" : "", p.status];
  const blank = () => RESULT_HEADERS.map(() => "");
  const heading = (title) => { const r = blank(); r[1] = title; return r; };
  const rows = [RESULT_HEADERS];
  ranks.overall.forEach((r) => rows.push(line(r.place, r.person)));
  if (ranks.nontrad.length) {
    rows.push(blank(), heading("Non-traditional (not eligible for awards)"));
    ranks.nontrad.forEach((r) => rows.push(line(r.place, r.person)));
  }
  const unfinished = view.people.filter((p) => p.total === null);
  if (unfinished.length) {
    rows.push(blank(), heading("Not finished"));
    unfinished.forEach((p) => rows.push(line("", p)));
  }
  const sh = tab(TABS.results);
  sh.clearContents();
  ensureRows(sh, rows.length);
  sh.getRange(1, 1, rows.length, RESULT_HEADERS.length).setNumberFormat("@").setValues(rows.map((r) => r.map(String)));
}

// Simple trigger: a hand edit (say, a late entry in Competitors) shows on the phones at the next refresh.
function onEdit() {
  invalidate();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Tri-Wrathlon")
    .addItem("Rebuild results", "rebuildResults")
    .addItem("Clear timing data", "clearTimingData")
    .addToUi();
}

function clearTimingData() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert("Clear timing data?",
    "This deletes every flight start, erg time and stadium time, and empties Results. Competitors stay. It can't be undone.",
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ev = tab(TABS.events);
    if (ev.getLastRow() > 1) ev.getRange(2, 1, ev.getLastRow() - 1, EVENT_HEADERS.length).clearContent();
    invalidate();
    // Phones may still hold rehearsal events; writeEvents refuses anything made before this moment.
    PropertiesService.getScriptProperties().setProperty("CLEARED_AT", String(Date.now()));
  } finally {
    lock.releaseLock();
  }
  rebuildResults();
}

// Run once from the editor: tabs, headers, text formats, protection and the menu.
function setup() {
  const ss = SpreadsheetApp.getActive();
  const make = (name, headers) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
    return sh;
  };
  make(TABS.competitors, COMPETITOR_HEADERS).getRange("A:E").setNumberFormat("@");
  const ev = make(TABS.events, EVENT_HEADERS);
  ev.getRange("A:B").setNumberFormat("@");
  ev.getRange("C:E").setNumberFormat("0");
  ev.getRange("F:J").setNumberFormat("@");
  make(TABS.results, RESULT_HEADERS);
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
