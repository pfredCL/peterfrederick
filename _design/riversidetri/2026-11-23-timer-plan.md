# Tri-Wrathlon Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the RBC Tri-Wrathlon timer described in `_design/riversidetri/2026-11-23-timer-design.md`: three one-screen phone stations, an organiser page and a results page at `peterfrederick.com/riversidetri/`, backed by a Google Sheet through an Apps Script web app.

**Architecture:** Static HTML/CSS/JS in `riversidetri/` (no build step), published by GitHub Pages. All timing maths lives in one dependency-free file, `js/model.js`, used by the pages, copied into Apps Script, and unit-tested in Node. Phones write locally first (`js/store.js` queues events in `localStorage`) and sync to the web app, which appends immutable events to the Sheet.

**Tech Stack:** Plain JavaScript (classic scripts, globals `Model`, `Store`, `UI`, `TimeEntry`, `CONFIG`), CSS custom properties from the approved tokens, Overpass self-hosted from Fontsource, Google Apps Script (V8), Node's built-in test runner, Playwright with axe-core.

---

## Before you start

- **Repo:** `C:\Users\peter\Desktop\peterfrederick`, branch `riversidetri`. Commands are Git Bash. Run them from the repo root unless a step says `cd`.
- **Read first:** the spec (`_design/riversidetri/2026-11-23-timer-design.md`), the tokens (`_design/riversidetri/tokens.css`) and the mockups (`_design/riversidetri/mockups/*.html`). The screens must match the mockups.
- **Never commit** the PIN, the organiser's email address, or real competitor names. Tests and fixtures use made-up names only.
- **Commit messages** end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push; the last task asks the user first.
- **Underscore folders** (`_apps-script`, `_tests`) are not published by GitHub Pages' Jekyll build.
- **Ask the user early (they can do it now, in parallel):** in the club Google account, open any Sheet → Extensions → Apps Script → Deploy → New deployment → Web app, and check that "Anyone" is offered under "Who has access". If it isn't, the Sheet must belong to a personal Google account instead (spec section 12).

## File map

| File | Responsibility |
|---|---|
| `riversidetri/index.html` | Start page: choose station, enter PIN |
| `riversidetri/erg.html` | Erg station |
| `riversidetri/entrance.html`, `exit.html` | Stadium stations (same script, `data-station` on `<body>`) |
| `riversidetri/organiser.html` | Organiser page (laptop) |
| `riversidetri/results.html` | Results page (laptop, screenshot for the email) |
| `riversidetri/css/tokens.css` | Live copy of the approved tokens |
| `riversidetri/css/app.css` | Components, tokens only |
| `riversidetri/fonts/` | Overpass 400/600 latin woff2 + licence |
| `riversidetri/js/config.js` | Web app URL, refresh interval, race name and date |
| `riversidetri/js/model.js` | Pure timing model: parse, format, resolve events, compute splits, rank, issues, lists |
| `riversidetri/js/store.js` | Local-first sync: state, write queue, retries, clock offset |
| `riversidetri/js/ui.js` | Escaping, icons, rows, confirm blocks, sync status, page boot |
| `riversidetri/js/time-entry.js` | The `00:00.0` digits-only field |
| `riversidetri/js/start.js`, `erg.js`, `stadium.js`, `organiser.js`, `results.js` | One per page |
| `riversidetri/_apps-script/Code.gs` | Web app: `doPost`, Sheet reads/writes, setup, menu |
| `riversidetri/_apps-script/model.js` | Byte-for-byte copy of `js/model.js` (pasted into Apps Script as `model`) |
| `riversidetri/_apps-script/README.md` | Deployment steps for the organiser |
| `riversidetri/_tests/` | `package.json`, Node unit tests, Playwright e2e, fake web app, static server |

---

### Task 1: Scaffold the app folder and test tooling

**Files:**
- Create: `riversidetri/css/tokens.css` (copy), `riversidetri/_tests/package.json`, `riversidetri/_tests/.gitignore`, `riversidetri/_tests/copy-fonts.mjs`
- Create (generated): `riversidetri/fonts/overpass-latin-400-normal.woff2`, `riversidetri/fonts/overpass-latin-600-normal.woff2`, `riversidetri/fonts/LICENSE.txt`

- [ ] **Step 1: Make the folders and copy the tokens**

```bash
mkdir -p riversidetri/css riversidetri/js riversidetri/fonts riversidetri/_apps-script riversidetri/_tests/e2e riversidetri/_tests/fixtures
cp _design/riversidetri/tokens.css riversidetri/css/tokens.css
```

- [ ] **Step 2: Write `riversidetri/_tests/package.json`**

```json
{
  "name": "riversidetri-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "e2e": "playwright test",
    "fonts": "node copy-fonts.mjs"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.0",
    "@fontsource/overpass": "^5.1.0",
    "@playwright/test": "^1.49.0"
  }
}
```

- [ ] **Step 3: Write `riversidetri/_tests/.gitignore`**

```
node_modules/
screenshots/
test-results/
playwright-report/
```

- [ ] **Step 4: Write `riversidetri/_tests/copy-fonts.mjs`**

```js
// Copies the two Overpass weights the app uses, and the font licence, from Fontsource into riversidetri/fonts.
import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("./node_modules/@fontsource/overpass/", import.meta.url);
const to = new URL("../fonts/", import.meta.url);
mkdirSync(to, { recursive: true });
for (const weight of [400, 600]) {
  const name = `overpass-latin-${weight}-normal.woff2`;
  copyFileSync(new URL("files/" + name, from), new URL(name, to));
  console.log("copied", name);
}
copyFileSync(new URL("LICENSE", from), new URL("LICENSE.txt", to));
console.log("copied LICENSE.txt");
```

- [ ] **Step 5: Install, fetch the browser for Playwright, copy the fonts**

```bash
cd riversidetri/_tests && npm install && npx playwright install chromium && npm run fonts && ls ../fonts
```

Expected: `LICENSE.txt  overpass-latin-400-normal.woff2  overpass-latin-600-normal.woff2`

- [ ] **Step 6: Commit**

```bash
git add riversidetri/css/tokens.css riversidetri/fonts riversidetri/_tests/package.json riversidetri/_tests/package-lock.json riversidetri/_tests/.gitignore riversidetri/_tests/copy-fonts.mjs
git commit -m "Scaffold the Tri-Wrathlon timer folder, tokens, fonts and test tooling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Model — formatting and parsing

**Files:**
- Create: `riversidetri/js/model.js`
- Test: `riversidetri/_tests/model-format.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/model-format.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";

test("formatTenths shows m:ss.t under an hour and h:mm:ss.t from an hour", () => {
  assert.equal(Model.formatTenths(22960), "38:16.0");
  assert.equal(Model.formatTenths(3032), "5:03.2");
  assert.equal(Model.formatTenths(37360), "1:02:16.0");
  assert.equal(Model.formatTenths(0), "0:00.0");
  assert.equal(Model.formatTenths(null), "");
});

test("formatClock shows a 12-hour local clock, with tenths when asked", () => {
  const t = new Date(2026, 11, 5, 8, 52, 54, 180).getTime();
  assert.equal(Model.formatClock(t, false), "8:52:54");
  assert.equal(Model.formatClock(t, true), "8:52:54.1");
  assert.equal(Model.formatClock(new Date(2026, 11, 5, 13, 5, 0).getTime(), false), "1:05:00");
});

test("parseFlight accepts the ways Sheets shows a time", () => {
  assert.deepEqual(Model.parseFlight("7:15"), { label: "7:15", minutes: 435 });
  assert.deepEqual(Model.parseFlight("07:15:00"), { label: "7:15", minutes: 435 });
  assert.deepEqual(Model.parseFlight("8:10 AM"), { label: "8:10", minutes: 490 });
  assert.equal(Model.parseFlight("8.10"), null);
  assert.equal(Model.parseFlight(""), null);
  assert.equal(Model.parseFlight("7:75"), null);
});

test("parseTimeOfDay reads a clock time on the same local day", () => {
  const base = new Date(2026, 11, 5, 9, 0, 0).getTime();
  assert.equal(Model.parseTimeOfDay("8:14:37", base), new Date(2026, 11, 5, 8, 14, 37).getTime());
  assert.equal(Model.parseTimeOfDay("8:14", base), new Date(2026, 11, 5, 8, 14, 0).getTime());
  assert.equal(Model.parseTimeOfDay("1:05:00", base), new Date(2026, 11, 5, 13, 5, 0).getTime());
  assert.equal(Model.parseTimeOfDay("8:14:61", base), null);
  assert.equal(Model.parseTimeOfDay("soon", base), null);
});

test("durationText and the flight notes read naturally", () => {
  assert.equal(Model.durationText(125000), "2 min 5 s");
  assert.equal(Model.durationText(45000), "45 s");
  assert.equal(Model.durationText(180000), "3 min");
  assert.equal(Model.durationText(3780000), "1 h 3 min");
  const started = { label: "7:15", minutes: 435, start: new Date(2026, 11, 5, 7, 17, 5).getTime() };
  assert.equal(Model.startNote(started), "2 min 5 s after 7:15");
  const waiting = { label: "8:10", minutes: 490, start: null };
  assert.equal(Model.dueNote(waiting, new Date(2026, 11, 5, 8, 13, 20).getTime()), "Due at 8:10, 3 min ago");
  assert.equal(Model.dueNote(waiting, new Date(2026, 11, 5, 8, 0, 0).getTime()), "Due at 8:10");
});

test("ergEntry turns typed digits into tenths", () => {
  assert.deepEqual(Model.ergEntry("38160"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("3816"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("102160"), { tenths: 37360, outside: false });
  assert.deepEqual(Model.ergEntry("25120"), { tenths: 15120, outside: true });
  assert.deepEqual(Model.ergEntry("38:16.0"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("381"), { error: "short" });
  assert.deepEqual(Model.ergEntry("38760"), { error: "range" });
  assert.deepEqual(Model.ergEntry("172160"), { error: "range" });
});

test("tenthsToDigits types a time back in", () => {
  assert.equal(Model.tenthsToDigits(22960), "38160");
  assert.equal(Model.tenthsToDigits(37360), "102160");
  assert.equal(Model.tenthsToDigits(3032), "05032");
});

test("the erg messages are plain sentences", () => {
  assert.equal(Model.ergOutsideMessage(15120), "That's 25:12.0, outside the usual 30 to 70 minutes. Save it anyway?");
  assert.match(Model.ERG_ERRORS.short, /^That time is missing digits\./);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test model-format.test.mjs`
Expected: FAIL — `Cannot find module '../js/model.js'`.

- [ ] **Step 3: Write `riversidetri/js/model.js`**

```js
/* Tri-Wrathlon timing model: pure functions, no DOM and no network.
   The pages load it as a classic script (global Model), the Apps Script project has an identical
   copy (model.gs), and the Node tests require it. No ?. or ?? so every runtime accepts it. */
var Model = (function () {
  "use strict";

  const TENTHS_PER_MIN = 600;
  const ERG_MIN = 30 * TENTHS_PER_MIN;
  const ERG_MAX = 70 * TENTHS_PER_MIN;
  const RUN_MIN = 20 * TENTHS_PER_MIN;
  const RUN_MAX = 120 * TENTHS_PER_MIN;
  const STADIUM_MIN = 10 * TENTHS_PER_MIN;
  const STADIUM_MAX = 90 * TENTHS_PER_MIN;
  const UNNAMED_AFTER_MS = 2 * 60 * 1000;
  const STATIONS = ["entrance", "exit"];
  const STATION_NAMES = { entrance: "Stadium entrance", exit: "Stadium exit" };
  const ERG_ERRORS = {
    short: "That time is missing digits. Type at least the minutes and seconds from the monitor, like 3816 for 38:16.0.",
    range: "That isn't a time the monitor can show, because minutes and seconds stop at 59. Check the monitor and type it again.",
  };

  const pad2 = (n) => (n < 10 ? "0" : "") + n;
  const has = (v) => v !== null && v !== undefined;
  const text = (v) => (has(v) ? String(v) : "");
  const byName = (a, b) => a.name.localeCompare(b.name);

  function issue(kind, message, extra) {
    return Object.assign({ kind: kind, text: message }, extra || {});
  }

  // ---- Formatting and parsing ----

  // Tenths of a second as results show them: 22960 -> "38:16.0", 37360 -> "1:02:16.0".
  function formatTenths(t) {
    if (!has(t) || isNaN(t)) return "";
    const sign = t < 0 ? "-" : "";
    t = Math.abs(Math.round(t));
    const tenth = t % 10;
    const s = Math.floor(t / 10) % 60;
    const m = Math.floor(t / TENTHS_PER_MIN) % 60;
    const h = Math.floor(t / (60 * TENTHS_PER_MIN));
    return sign + (h > 0 ? h + ":" + pad2(m) : String(m)) + ":" + pad2(s) + "." + tenth;
  }

  // A moment as a 12-hour local clock: "8:52:54", or "8:52:54.1" with tenths.
  function formatClock(ms, withTenths) {
    const d = new Date(ms);
    const out = (d.getHours() % 12 || 12) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    return withTenths ? out + "." + Math.floor(d.getMilliseconds() / 100) : out;
  }

  function readClock(value, withSeconds) {
    const pattern = withSeconds
      ? /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?\s*$/i
      : /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?\s*$/i;
    const m = pattern.exec(text(value));
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    const sec = withSeconds && m[3] ? Number(m[3]) : 0;
    const ampm = withSeconds ? m[4] : m[3];
    if (h > 23 || min > 59 || sec > 59) return null;
    if (ampm) {
      if (h < 1 || h > 12) return null;
      const pm = ampm.toLowerCase() === "pm";
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return { h: h, min: min, sec: sec, ampm: !!ampm };
  }

  // A flight as typed in Competitors: "7:15", "07:15", "7:15:00", "7:15 AM" -> { label: "7:15", minutes: 435 }.
  function parseFlight(value) {
    const c = readClock(value, false);
    return c ? { label: (c.h % 12 || 12) + ":" + pad2(c.min), minutes: c.h * 60 + c.min } : null;
  }

  // Midnight of baseMs's local day plus some minutes, in ms.
  function atMinutes(baseMs, minutes) {
    const d = new Date(baseMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime() + minutes * 60000;
  }

  // "8:14:37" or "8:14" on the same local day as baseMs -> ms. Without am/pm, 1 to 5 o'clock means
  // the afternoon (nobody races at 3 in the morning).
  function parseTimeOfDay(value, baseMs) {
    const c = readClock(value, true);
    if (!c) return null;
    const h = !c.ampm && c.h >= 1 && c.h <= 5 ? c.h + 12 : c.h;
    return atMinutes(baseMs, h * 60 + c.min) + c.sec * 1000;
  }

  // 125000 -> "2 min 5 s", 45000 -> "45 s", 3780000 -> "1 h 3 min".
  function durationText(ms) {
    const s = Math.round(Math.abs(ms) / 1000);
    if (s < 60) return s + " s";
    if (s < 3600) return Math.floor(s / 60) + " min" + (s % 60 ? " " + (s % 60) + " s" : "");
    const m = Math.floor(s / 60) % 60;
    return Math.floor(s / 3600) + " h" + (m ? " " + m + " min" : "");
  }

  // Under a started flight on the organiser page: "2 min 5 s after 7:15".
  function startNote(flight) {
    const diff = flight.start - atMinutes(flight.start, flight.minutes);
    if (Math.abs(diff) < 1000) return "Right on " + flight.label;
    return durationText(diff) + (diff > 0 ? " after " : " before ") + flight.label;
  }

  // Under a flight that hasn't started: "Due at 8:10" or "Due at 8:10, 3 min ago".
  function dueNote(flight, now) {
    const diff = now - atMinutes(now, flight.minutes);
    if (diff < 60000) return "Due at " + flight.label;
    return "Due at " + flight.label + ", " + durationText(Math.floor(diff / 60000) * 60000) + " ago";
  }

  // Digits typed into a time field -> tenths. Four digits are whole seconds (3816 -> 38:16.0),
  // five are mm:ss.t (38160), six are h:mm:ss.t (102160 -> 1:02:16.0).
  function ergEntry(digits) {
    let d = text(digits).replace(/\D/g, "").slice(0, 6);
    if (d.length < 4) return { error: "short" };
    if (d.length === 4) d += "0";
    let h = 0;
    let m;
    let s;
    let t;
    if (d.length === 6) {
      h = Number(d[0]); m = Number(d.slice(1, 3)); s = Number(d.slice(3, 5)); t = Number(d[5]);
    } else {
      m = Number(d.slice(0, 2)); s = Number(d.slice(2, 4)); t = Number(d[4]);
    }
    if (s > 59 || (d.length === 6 && m > 59)) return { error: "range" };
    const tenths = ((h * 60 + m) * 60 + s) * 10 + t;
    return { tenths: tenths, outside: tenths < ERG_MIN || tenths > ERG_MAX };
  }

  // The digits that type a time back in: 22960 -> "38160", 37360 -> "102160".
  function tenthsToDigits(t) {
    const d = formatTenths(t).replace(/\D/g, "");
    return d.length < 5 ? ("00000" + d).slice(-5) : d;
  }

  function ergOutsideMessage(tenths) {
    return "That's " + formatTenths(tenths) + ", outside the usual 30 to 70 minutes. Save it anyway?";
  }

  // ---- Roster ----

  // ---- Events ----

  // ---- The race ----

  // ---- Lists for the screens ----

  return {
    ERG_ERRORS, STATION_NAMES,
    formatTenths, formatClock, parseFlight, atMinutes, parseTimeOfDay, durationText, startNote, dueNote,
    ergEntry, tenthsToDigits, ergOutsideMessage,
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Model;
```

- [ ] **Step 4: Pin `js/` to CommonJS for Node.** The tests `import` these classic scripts; this stops Node treating them as ES modules if a `package.json` with `"type": "module"` ever appears in a parent folder. Write `riversidetri/js/package.json`:

```json
{ "type": "commonjs" }
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && node --test model-format.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/js/model.js riversidetri/js/package.json riversidetri/_tests/model-format.test.mjs
git commit -m "Add timing model: time formats and parsing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Model — reading the Competitors tab

**Files:**
- Modify: `riversidetri/js/model.js` (the `// ---- Roster ----` section and the `return` block)
- Test: `riversidetri/_tests/model-roster.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/model-roster.test.mjs`

```js
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
    "Row 2 of Competitors has no name, so it's left out.",
    'Row 3 of Competitors has "8.10" as its flight, which isn\'t a time like 8:10.',
    'Row 5 of Competitors has "twelve" as its number. Use a whole number, or leave it blank.',
    "Number 12 is used more than once in Competitors (rows 3 and 4).",
  ]);
  assert.ok(issues.every((i) => i.kind === "roster"));
});

test("a missing flight is called out", () => {
  const { issues } = Model.normaliseRoster([{ row: 7, name: "Riley Grant", number: "", flight: "", nontrad: "", id: "c7" }]);
  assert.deepEqual(issues.map((i) => i.text), ["Row 7 of Competitors has no flight."]);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test model-roster.test.mjs`
Expected: FAIL — `Model.normaliseRoster is not a function`.

- [ ] **Step 3: Add the roster code.** In `riversidetri/js/model.js`, replace the line `  // ---- Roster ----` with:

```js
  // ---- Roster ----

  const isYes = (v) => /^(y|yes|true|x|1|✓)$/i.test(text(v).trim());

  // Rows from the Competitors tab, as display text ({ row, name, number, flight, nontrad, id }),
  // -> the competitors the timer can use, plus plain-sentence issues for the rows it can't.
  function normaliseRoster(rows) {
    const competitors = [];
    const issues = [];
    const rowsByNumber = {};
    (rows || []).forEach((r) => {
      const name = text(r.name).trim();
      const numberText = text(r.number).trim();
      const flightText = text(r.flight).trim();
      if (!name && !numberText && !flightText) return;
      if (!name) {
        issues.push(issue("roster", "Row " + r.row + " of Competitors has no name, so it's left out."));
        return;
      }
      let number = null;
      if (numberText) {
        if (/^\d+$/.test(numberText)) number = Number(numberText);
        else issues.push(issue("roster", "Row " + r.row + ' of Competitors has "' + numberText + '" as its number. Use a whole number, or leave it blank.'));
      }
      const flight = parseFlight(flightText);
      if (!flight) {
        issues.push(issue("roster", "Row " + r.row + " of Competitors has " +
          (flightText ? '"' + flightText + "\" as its flight, which isn't a time like 8:10." : "no flight.")));
      }
      if (number !== null) (rowsByNumber[number] = rowsByNumber[number] || []).push(r.row);
      competitors.push({
        id: text(r.id).trim(), row: r.row, name: name, number: number,
        flight: flight ? flight.label : "", flightMinutes: flight ? flight.minutes : null, nontrad: isYes(r.nontrad),
      });
    });
    Object.keys(rowsByNumber).forEach((n) => {
      if (rowsByNumber[n].length > 1) {
        issues.push(issue("roster", "Number " + n + " is used more than once in Competitors (rows " + rowsByNumber[n].join(" and ") + ")."));
      }
    });
    return { competitors: competitors, issues: issues };
  }
```

Then replace the `return { ... };` block at the bottom of the IIFE with:

```js
  return {
    ERG_ERRORS, STATION_NAMES,
    formatTenths, formatClock, parseFlight, atMinutes, parseTimeOfDay, durationText, startNote, dueNote,
    ergEntry, tenthsToDigits, ergOutsideMessage,
    normaliseRoster,
  };
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS, all tests in both files.

- [ ] **Step 5: Commit**

```bash
git add riversidetri/js/model.js riversidetri/_tests/model-roster.test.mjs
git commit -m "Model: read the Competitors tab and explain unusable rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Model — resolving events (replacements and voids)

**Files:**
- Modify: `riversidetri/js/model.js` (the `// ---- Events ----` section and the `return` block)
- Test: `riversidetri/_tests/model-resolve.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/model-resolve.test.mjs`

```js
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test model-resolve.test.mjs`
Expected: FAIL — `Model.resolve is not a function`.

- [ ] **Step 3: Add the events code.** Replace the line `  // ---- Events ----` with:

```js
  // ---- Events ----

  // Later means made later (created), then received later; events not yet sent count as newest.
  function compareEvents(a, b) {
    const ra = has(a.received) ? a.received : Infinity;
    const rb = has(b.received) ? b.received : Infinity;
    return (a.created - b.created) || (ra === rb ? 0 : ra < rb ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  // Apply voids and replacements: the latest start per flight, erg per competitor and name per tap.
  function resolve(events) {
    const list = (events || []).slice().sort(compareEvents);
    const voided = {};
    list.forEach((e) => { if (e.type === "void" && e.target) voided[e.target] = true; });
    const out = { starts: {}, startIds: {}, ergs: {}, taps: [], names: {} };
    list.forEach((e) => {
      if (voided[e.id] || e.type === "void") return;
      if (e.type === "start") {
        const label = text(e.value);
        out.starts[label] = e;
        (out.startIds[label] = out.startIds[label] || []).push(e.id);
      } else if (e.type === "erg") out.ergs[e.competitor] = e;
      else if (e.type === "tap") out.taps.push(e);
      else if (e.type === "name") out.names[e.target] = e;
    });
    out.taps.sort((a, b) => Number(a.time) - Number(b.time) || compareEvents(a, b));
    return out;
  }
```

Then add `resolve` to the `return` block, after `normaliseRoster,`:

```js
    normaliseRoster, resolve,
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add riversidetri/js/model.js riversidetri/_tests/model-resolve.test.mjs
git commit -m "Model: resolve events by when they were made, with voids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Model — computing the race (splits, status, issues)

**Files:**
- Modify: `riversidetri/js/model.js` (the `// ---- The race ----` section and the `return` block)
- Create: `riversidetri/_tests/fixtures/race2025.mjs`
- Test: `riversidetri/_tests/model-compute.test.mjs`

- [ ] **Step 1: Write the fixture** — `riversidetri/_tests/fixtures/race2025.mjs`

```js
// The 2025 splits under made-up names (the repo is public). Real: every split. Made up: every name.
// Everyone is put in one flight starting at t0, because the 2025 sheet doesn't say who was in which.
export const RESULTS_2025 = [
  ["Sam Carter", "35:26.7", "39:19.5", "23:45.6", false],
  ["Jordan Hayes", "36:31.2", "41:44.8", "20:39.7", false],
  ["Chris Walsh", "34:57.1", "41:04.9", "22:55.3", false],
  ["Taylor Brooks", "33:39.8", "42:28.3", "26:10.2", false],
  ["Morgan Reed", "37:07.5", "42:45.2", "27:46.9", false],
  ["Casey Doyle", "37:23.8", "46:01.5", "27:30.6", false],
  ["Riley Grant", "35:10.2", "46:48.6", "35:30.1", false],
  ["Jamie Lowe", "38:56.8", "45:39.8", "29:02.6", false],
  ["Drew Mason", "36:08.8", "49:07.4", "28:31.7", false],
  ["Pat Kelly", "36:15.4", "48:06.5", "31:53.5", false],
  ["Robin Shaw", "38:44.4", "50:35.1", "28:54.4", false],
  ["Dana Price", "38:16.0", "48:14.8", "32:28.4", false],
  ["Avery Cole", "38:00.6", "51:57.9", "31:26.1", false],
  ["Quinn Foster", "38:43.6", "50:41.1", "35:30.1", false],
  ["Jesse Lane", "40:59.7", "54:49.4", "30:42.6", false],
  ["Cameron Ward", "37:42.0", "59:15.3", "30:24.3", false],
  ["Reese Hughes", "36:39.1", "55:47.8", "35:38.7", false],
  ["Skyler Bell", "38:05.4", "58:50.6", "32:26.6", false],
  ["Logan Park", "41:35.9", "54:17.9", "36:49.5", false],
  ["Hayden Moss", "43:45.2", "51:24.9", "40:10.2", false],
  ["Emerson Clay", "42:14.7", "55:49.1", "40:07.1", false],
  ["Rowan Pike", "51:29.1", "55:02.3", "48:19.2", false],
  ["Blair Nolan", "30:16.7", "32:25.4", "32:25.3", true],
  ["Devon Hart", "33:58.0", "30:24.1", "31:34.2", true],
  ["Kendall Rios", "34:19.7", "39:00.9", "34:09.3", true],
  ["Parker Stone", "34:13.5", "39:07.4", "34:33.6", true],
  ["Sydney Vale", "34:27.1", "39:17.1", "37:38.7", true],
  ["Finley Ross", "34:26.1", "39:17.1", "41:35.5", true],
  ["Harper Lund", "34:22.4", "44:28.8", "40:25.3", true],
  ["Elliot Shea", "34:20.5", "39:26.6", "46:19.9", true],
  ["Marley Dunn", "37:21.5", "57:18.3", "31:24.6", true],
];

export const tenths = (s) => {
  const [m, rest] = s.split(":");
  return Number(m) * 600 + Math.round(Number(rest) * 10);
};

const event = (id, type, at, extra) => Object.assign(
  { id, type, created: at, time: null, received: at, competitor: "", value: "", target: "", station: "", device: "fixture" }, extra);

// Competitor rows and events that replay the 2025 race exactly.
export function race2025(t0 = new Date(2026, 11, 5, 7, 17, 5).getTime()) {
  const rows = [];
  const events = [event("start-715", "start", t0, { value: "7:15", time: t0 })];
  RESULTS_2025.forEach(([name, erg, run, stadium, nontrad], i) => {
    const id = "c" + String(i + 1).padStart(7, "0");
    rows.push({ row: i + 2, id, name, number: String(i + 1), flight: "7:15", nontrad: nontrad ? "Yes" : "" });
    const e = tenths(erg);
    const arrival = t0 + (e + tenths(run)) * 100;
    const finish = arrival + tenths(stadium) * 100;
    events.push(
      event("erg-" + id, "erg", t0 + e * 100, { competitor: id, value: String(e) }),
      event("in-" + id, "tap", arrival, { station: "entrance", time: arrival }),
      event("in-name-" + id, "name", arrival + 1, { target: "in-" + id, competitor: id }),
      event("out-" + id, "tap", finish, { station: "exit", time: finish }),
      event("out-name-" + id, "name", finish + 1, { target: "out-" + id, competitor: id }),
    );
  });
  return { rows, events, t0 };
}
```

- [ ] **Step 2: Write the failing test** — `riversidetri/_tests/model-compute.test.mjs`

```js
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
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test model-compute.test.mjs`
Expected: FAIL — `Model.buildView is not a function`.

- [ ] **Step 4: Add the race code.** Replace the line `  // ---- The race ----` with:

```js
  // ---- The race ----

  // Competitors (from normaliseRoster) + events -> everything the screens show.
  function compute(competitors, events, now) {
    const r = resolve(events);
    const byId = {};
    const issues = [];
    const people = competitors.map((c) => {
      const p = {
        id: c.id, name: c.name, number: c.number, flight: c.flight, flightMinutes: c.flightMinutes, nontrad: c.nontrad,
        start: null, erg: null, ergCreated: null, arrival: null, arrivalTapId: null, finish: null, finishTapId: null,
        run: null, stadium: null, total: null, status: "Not started",
      };
      byId[c.id] = p;
      return p;
    });

    const flightMap = {};
    competitors.forEach((c) => {
      if (!c.flight) return;
      if (!flightMap[c.flight]) flightMap[c.flight] = { label: c.flight, minutes: c.flightMinutes, count: 0, start: null, startEventId: null, startEventIds: [] };
      flightMap[c.flight].count++;
    });
    const flights = Object.keys(flightMap).map((k) => flightMap[k]).sort((a, b) => a.minutes - b.minutes);
    flights.forEach((f) => {
      const s = r.starts[f.label];
      if (s) { f.start = Number(s.time); f.startEventId = s.id; f.startEventIds = r.startIds[f.label]; }
    });

    Object.keys(r.ergs).forEach((cid) => {
      const e = r.ergs[cid];
      if (byId[cid]) { byId[cid].erg = Number(e.value); byId[cid].ergCreated = e.created; }
      else issues.push(issue("orphan", "An erg time of " + formatTenths(Number(e.value)) + " belongs to someone no longer in Competitors."));
    });

    const taps = { entrance: [], exit: [] };
    r.taps.forEach((t) => {
      if (!taps[t.station]) return;
      const n = r.names[t.id];
      const cid = n && n.competitor && byId[n.competitor] ? n.competitor : "";
      taps[t.station].push({ id: t.id, station: t.station, time: Number(t.time), competitor: cid });
    });

    STATIONS.forEach((st) => {
      const key = st === "entrance" ? "arrival" : "finish";
      const seen = {};
      taps[st].forEach((tap) => {
        if (!tap.competitor) return;
        if (seen[tap.competitor]) { seen[tap.competitor].push(tap); return; }
        seen[tap.competitor] = [tap];
        byId[tap.competitor][key] = tap.time;
        byId[tap.competitor][key + "TapId"] = tap.id;
      });
      Object.keys(seen).forEach((cid) => {
        const list = seen[cid];
        if (list.length < 2) return;
        issues.push(issue("duplicate", byId[cid].name + " is named on " + list.length + " " + STATION_NAMES[st].toLowerCase() +
          " times (" + list.map((t) => formatClock(t.time, true)).join(", ") + "). The earliest counts until you fix it.", { competitor: cid, station: st }));
      });
      const unnamed = taps[st].filter((t) => !t.competitor && now - t.time > UNNAMED_AFTER_MS);
      if (unnamed.length) {
        issues.push(issue("unnamed", STATION_NAMES[st] + " has " + (unnamed.length === 1 ? "a time" : unnamed.length + " times") +
          " without a name, the oldest from " + formatClock(unnamed[0].time, true) + ".", { station: st }));
      }
    });

    const startOf = {};
    flights.forEach((f) => { startOf[f.label] = f.start; });
    people.forEach((p) => {
      p.start = has(startOf[p.flight]) ? startOf[p.flight] : null;
      // Rounding rule: arrival and finish become tenths after the start first, so the row adds up exactly.
      const A = has(p.start) && has(p.arrival) ? Math.round((p.arrival - p.start) / 100) : null;
      const F = has(p.start) && has(p.finish) ? Math.round((p.finish - p.start) / 100) : null;
      if (has(A) && has(p.erg)) p.run = A - p.erg;
      if (has(p.arrival) && has(p.finish)) p.stadium = has(A) && has(F) ? F - A : Math.round((p.finish - p.arrival) / 100);
      if (has(p.run) && has(p.stadium) && has(F)) p.total = F;
      p.status = has(p.finish) ? "Finished" : has(p.arrival) ? "In the stadium" : !has(p.start) ? "Not started" : has(p.erg) ? "On the run" : "On the erg";

      const who = { competitor: p.id };
      if (has(p.arrival) && !has(p.erg)) issues.push(issue("ergMissing", p.name + " has arrived at the stadium but has no erg time.", who));
      if (has(p.finish) && !has(p.arrival)) issues.push(issue("arrivalMissing", p.name + " has finished but has no stadium arrival.", who));
      if (has(p.run) && p.run <= 0) {
        issues.push(issue("run", p.name + "'s arrival is before the end of their erg. Check the erg time and the arrival.", who));
      } else if (has(p.run) && (p.run < RUN_MIN || p.run > RUN_MAX)) {
        issues.push(issue("run", p.name + "'s run of " + formatTenths(p.run) + " is " + (p.run < RUN_MIN ? "under 20 minutes" : "over 2 hours") +
          ". Check the erg time and the arrival.", who));
      }
      if (has(p.stadium) && (p.stadium < STADIUM_MIN || p.stadium > STADIUM_MAX)) {
        issues.push(issue("stadium", p.name + "'s stadium time of " + formatTenths(p.stadium) + " is " +
          (p.stadium < STADIUM_MIN ? "under 10 minutes" : "over 90 minutes") + ". Check the arrival and the finish.", who));
      }
    });

    return { flights: flights, people: people, byId: byId, taps: taps, issues: issues };
  }

  // Raw Competitors rows + events -> the view, with roster problems listed first.
  function buildView(rows, events, now) {
    const roster = normaliseRoster(rows);
    const view = compute(roster.competitors, events, now);
    view.issues = roster.issues.concat(view.issues);
    return view;
  }
```

Then extend the `return` block line to:

```js
    normaliseRoster, resolve, compute, buildView,
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/js/model.js riversidetri/_tests/model-compute.test.mjs riversidetri/_tests/fixtures/race2025.mjs
git commit -m "Model: compute splits, status and issues; replay the 2025 splits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Model — ranking, station lists and clock offset

**Files:**
- Modify: `riversidetri/js/model.js` (the `// ---- Lists for the screens ----` section and the `return` block)
- Test: `riversidetri/_tests/model-lists.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/model-lists.test.mjs`

```js
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test model-lists.test.mjs`
Expected: FAIL — `Model.rank is not a function`.

- [ ] **Step 3: Add the lists code.** Replace the line `  // ---- Lists for the screens ----` with:

```js
  // ---- Lists for the screens ----

  // Finishers by total, fastest first; equal totals share a place. Non-traditional ranked separately.
  function rank(people) {
    const ranked = (list) => {
      list.sort((a, b) => a.total - b.total || a.name.localeCompare(b.name));
      let place = 0;
      return list.map((p, i) => {
        if (i === 0 || p.total !== list[i - 1].total) place = i + 1;
        return { place: place, person: p };
      });
    };
    const done = people.filter((p) => has(p.total));
    return { overall: ranked(done.filter((p) => !p.nontrad)), nontrad: ranked(done.filter((p) => p.nontrad)) };
  }

  // People in flight groups: started flights first, then by time; first names within each; no flight last.
  function groupByFlight(view, people) {
    const order = view.flights.filter((f) => has(f.start)).concat(view.flights.filter((f) => !has(f.start)));
    const groups = order.map((f) => ({ flight: f.label, started: has(f.start), people: people.filter((p) => p.flight === f.label).sort(byName) }));
    groups.push({ flight: "", started: false, people: people.filter((p) => !p.flight).sort(byName) });
    return groups.filter((g) => g.people.length);
  }

  function waitingForErg(view) {
    return groupByFlight(view, view.people.filter((p) => !has(p.erg)));
  }

  // Newest first.
  function ergEntered(view) {
    return view.people.filter((p) => has(p.erg)).sort((a, b) => b.ergCreated - a.ergCreated);
  }

  // Who a new stadium time could belong to. Exit: those in the stadium, then (extra) anyone missed at the entrance.
  function nameCandidates(view, station) {
    const started = view.people.filter((p) => has(p.start));
    if (station === "entrance") return { main: groupByFlight(view, started.filter((p) => !has(p.arrival))), extra: [] };
    return {
      main: groupByFlight(view, started.filter((p) => has(p.arrival) && !has(p.finish))),
      extra: groupByFlight(view, started.filter((p) => !has(p.arrival) && !has(p.finish))),
    };
  }

  // Oldest first.
  function unnamedTaps(view, station) {
    return view.taps[station].filter((t) => !t.competitor);
  }

  // Newest first, each with its person.
  function namedTaps(view, station) {
    return view.taps[station]
      .filter((t) => t.competitor)
      .map((t) => Object.assign({ person: view.byId[t.competitor] }, t))
      .sort((a, b) => b.time - a.time);
  }

  // Clock samples { rtt, offset } -> the offset from the quickest round trip, or null with none.
  function bestOffset(samples) {
    if (!samples || !samples.length) return null;
    let best = samples[0];
    samples.forEach((s) => { if (s.rtt < best.rtt) best = s; });
    return best.offset;
  }
```

Then replace the whole `return` block with the final one:

```js
  return {
    ERG_ERRORS, STATION_NAMES,
    formatTenths, formatClock, parseFlight, atMinutes, parseTimeOfDay, durationText, startNote, dueNote,
    ergEntry, tenthsToDigits, ergOutsideMessage,
    normaliseRoster, resolve, compute, buildView, rank,
    groupByFlight, waitingForErg, ergEntered, nameCandidates, unnamedTaps, namedTaps, bestOffset,
  };
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS, every model test.

- [ ] **Step 5: Commit**

```bash
git add riversidetri/js/model.js riversidetri/_tests/model-lists.test.mjs
git commit -m "Model: ranking, station lists and clock offset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The Apps Script web app

**Files:**
- Create: `riversidetri/_apps-script/Code.gs`, `riversidetri/_apps-script/model.js` (copy), `riversidetri/_apps-script/README.md`
- Test: `riversidetri/_tests/apps-script.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/apps-script.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Model from "../js/model.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the Apps Script copy of model.js matches the site's", () => {
  assert.equal(read("../_apps-script/model.js"), read("../js/model.js"),
    "Copy riversidetri/js/model.js over riversidetri/_apps-script/model.js");
});

test("Code.gs only calls Model functions that exist", () => {
  const used = [...read("../_apps-script/Code.gs").matchAll(/Model\.(\w+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  used.forEach((name) => assert.ok(name in Model, "Model." + name + " is missing"));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test apps-script.test.mjs`
Expected: FAIL — `ENOENT: no such file or directory ... _apps-script/model.js`.

- [ ] **Step 3: Write `riversidetri/_apps-script/Code.gs`**

```js
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
  const pin = PropertiesService.getScriptProperties().getProperty("PIN");
  if (!pin || String(body.pin || "") !== pin) {
    return reply({ ok: false, error: "pin", message: "That PIN didn't work. Check it with the race organiser." });
  }
  try {
    if (body.action === "state") return reply({ ok: true, serverTime: Date.now(), state: readState() });
    if (body.action === "write") {
      const result = writeEvents(Array.isArray(body.events) ? body.events : []);
      if (result.changed) rebuildResults();
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

// Competitors as typed (display text keeps "7:15" as "7:15"), giving any named row without an ID one.
function readCompetitorRows() {
  const sh = tab(TABS.competitors);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, COMPETITOR_HEADERS.length).getDisplayValues();
  const rows = values.map((v, i) => ({ row: i + 2, name: v[0], number: v[1], flight: v[2], nontrad: v[3], id: String(v[4]).trim() }));
  const missing = rows.filter((r) => String(r.name).trim() && !r.id);
  if (missing.length) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ids = sh.getRange(2, 5, last - 1, 1).getDisplayValues();
      missing.forEach((r) => {
        const now = String(ids[r.row - 2][0]).trim();
        if (now) { r.id = now; return; }
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

function readState() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const state = { competitors: readCompetitorRows(), events: readEvents() };
  const json = JSON.stringify(state);
  if (json.length < 90000) cache.put(CACHE_KEY, json, 60);
  return state;
}

// Shape checks only; the phones do the real validation. Returns "" when the event is fine.
function checkEvent(e, known, flights, types) {
  if (!e || typeof e.id !== "string" || !e.id || e.id.length > 64) return "It had no ID.";
  if (TYPES.indexOf(e.type) < 0) return "It wasn't a kind of entry the timer knows.";
  if (typeof e.created !== "number") return "It didn't say when it was made.";
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
    const known = {};
    const flights = {};
    const comp = tab(TABS.competitors);
    if (comp.getLastRow() > 1) {
      comp.getRange(2, 1, comp.getLastRow() - 1, COMPETITOR_HEADERS.length).getDisplayValues().forEach((v) => {
        if (String(v[4]).trim()) known[String(v[4]).trim()] = true;
        const f = Model.parseFlight(v[2]);
        if (f) flights[f.label] = true;
      });
    }
    const types = {};
    readEvents().forEach((e) => { types[e.id] = e.type; });
    const received = Date.now();
    const rows = [];
    events.forEach((e) => {
      if (e && types[e.id]) return; // already stored: resending is harmless
      const why = checkEvent(e, known, flights, types);
      if (why) { rejected.push({ id: e && e.id ? String(e.id) : "", reason: why }); return; }
      types[e.id] = e.type; // later events in the same batch may point at this one
      rows.push([e.id, e.type, e.created, typeof e.time === "number" ? e.time : "", received,
        e.competitor || "", e.value === undefined || e.value === null ? "" : String(e.value), e.target || "", e.station || "", e.device || ""]);
    });
    if (rows.length) {
      const ev = tab(TABS.events);
      ev.getRange(ev.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
      CacheService.getScriptCache().remove(CACHE_KEY);
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
  sh.getRange(1, 1, rows.length, RESULT_HEADERS.length).setNumberFormat("@").setValues(rows.map((r) => r.map(String)));
}

// Simple trigger: a hand edit (say, a late entry in Competitors) shows on the phones at the next refresh.
function onEdit() {
  CacheService.getScriptCache().remove(CACHE_KEY);
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
    CacheService.getScriptCache().remove(CACHE_KEY);
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
```

- [ ] **Step 4: Copy the model**

```bash
cp riversidetri/js/model.js riversidetri/_apps-script/model.js
```

- [ ] **Step 5: Write `riversidetri/_apps-script/README.md`**

```markdown
# Tri-Wrathlon timer: Apps Script back end

The web app behind peterfrederick.com/riversidetri. It lives in the race Sheet's Apps Script project.

## Set up once (about 15 minutes)

1. Signed in to the Google account that will own the race Sheet, create a Sheet called "RBC Tri-Wrathlon 2026".
2. Extensions → Apps Script.
3. Replace everything in `Code.gs` with `Code.gs` from this folder.
4. Add a script file (＋ → Script) named `model` and replace its contents with `model.js` from this folder.
5. Project Settings (gear icon) → Script properties → Add script property: name `PIN`, value the race PIN. Save.
6. Back in the editor, pick `setup` in the function menu and click Run. Approve Google's permission screen.
   The Sheet now has Competitors, Events and Results tabs and a "Tri-Wrathlon" menu.
7. Deploy → New deployment → gear → Web app. Execute as: Me. Who has access: Anyone. Deploy, then copy the
   web app URL (it ends in `/exec`). If "Anyone" isn't offered, the account's Workspace admin blocks it:
   use a personal Google account for the Sheet instead.
8. The URL goes in `riversidetri/js/config.js` as `apiUrl`.

## After changing Code.gs or model.js

Paste the new files in, then Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
The URL stays the same.

## The Tri-Wrathlon menu

- **Rebuild results** rewrites the Results tab.
- **Clear timing data** deletes every flight start, erg time and stadium time (it asks first). Use it after the rehearsal.
```

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS, including both Apps Script checks.

- [ ] **Step 7: Commit**

```bash
git add riversidetri/_apps-script riversidetri/_tests/apps-script.test.mjs
git commit -m "Add the Apps Script web app, its model copy and setup steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Store — local-first sync, retries and clock offset

**Files:**
- Create: `riversidetri/js/store.js`
- Test: `riversidetri/_tests/store.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/store.test.mjs`

```js
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test store.test.mjs`
Expected: FAIL — `Cannot find module '../js/store.js'`.

- [ ] **Step 3: Write `riversidetri/js/store.js`**

```js
/* Local-first sync with the Apps Script web app. Keeps the last state, queues every write in
   localStorage, sends writes in order, retries, and tracks this device's clock offset.
   Uses the global Model. Its dependencies can be swapped so the Node tests can drive it. */
var Store = (function () {
  "use strict";
  const RETRY_MS = [2000, 5000, 10000, 30000];
  const FAILING_AFTER_MS = 60000;
  const SAMPLES = 5;

  function create(opts) {
    const url = opts.url || "";
    const fetchImpl = opts.fetch || ((u, o) => fetch(u, o));
    const storage = opts.storage || window.localStorage;
    const now = opts.now || (() => Date.now());
    const later = opts.later || ((fn, ms) => setTimeout(fn, ms));
    const uuid = opts.uuid || (() => crypto.randomUUID());
    const listeners = [];

    function load(key, fallback) {
      try {
        const v = storage.getItem("tw:" + key);
        return v === null || v === undefined ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    }
    function save(key, value) {
      try { storage.setItem("tw:" + key, JSON.stringify(value)); } catch (e) { /* storage blocked or full: carry on in memory */ }
    }

    const s = {
      pin: load("pin", ""), station: load("station", ""), device: load("device", "") || uuid(),
      state: load("state", null), queue: load("queue", []), rejected: load("rejected", []), samples: load("samples", []),
      inflight: null, failingSince: null, pinError: false, retries: 0, retryPending: false,
    };
    save("device", s.device);

    const emit = () => listeners.forEach((fn) => fn());
    const offset = () => Model.bestOffset(s.samples);
    const correctedNow = () => { const o = offset(); return o === null ? now() : now() + o; };
    const succeeded = () => { s.failingSince = null; s.retries = 0; };
    const failed = () => { if (s.failingSince === null) s.failingSince = now(); };

    async function call(body) {
      const t0 = now();
      const res = await fetchImpl(url, {
        method: "POST", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ pin: s.pin }, body)),
      });
      const t1 = now();
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (typeof data.serverTime === "number") {
        s.samples = s.samples.concat([{ rtt: t1 - t0, offset: data.serverTime - (t0 + t1) / 2 }]).slice(-SAMPLES);
        save("samples", s.samples);
      }
      if (!data.ok && data.error === "pin") { s.pinError = true; throw new Error("pin"); }
      if (!data.ok) throw new Error(data.message || "server");
      s.pinError = false;
      if (data.state) { s.state = data.state; save("state", s.state); }
      return data;
    }

    async function refresh() {
      if (!url) return;
      try { await call({ action: "state" }); succeeded(); } catch (e) { if (e.message !== "pin") failed(); }
      emit();
    }

    // Events made before this device had a clock sample carry raw device time: correct them as they go.
    function corrected(e) {
      const o = offset();
      if (e.corrected || o === null) return e;
      const out = Object.assign({}, e, { created: e.created + o, corrected: true });
      if (typeof e.time === "number") out.time = e.time + o;
      return out;
    }
    function wire(e) {
      const out = Object.assign({}, e);
      delete out.corrected;
      return out;
    }

    async function send() {
      while (s.queue.length) {
        s.queue = s.queue.map(corrected);
        save("queue", s.queue);
        const batch = s.queue.slice();
        try {
          const data = await call({ action: "write", events: batch.map(wire) });
          const reasons = {};
          (data.rejected || []).forEach((r) => { reasons[r.id] = r.reason; });
          const sent = {};
          batch.forEach((e) => {
            sent[e.id] = true;
            if (reasons[e.id]) s.rejected.push({ event: wire(e), reason: reasons[e.id] });
          });
          s.queue = s.queue.filter((e) => !sent[e.id]);
          save("queue", s.queue);
          save("rejected", s.rejected);
          succeeded();
        } catch (e) {
          if (e.message !== "pin") { failed(); retryLater(); }
          break;
        } finally {
          emit();
        }
      }
    }

    // One send at a time; anything added meanwhile goes in the same loop.
    function flush() {
      if (!url) return Promise.resolve();
      if (!s.inflight) s.inflight = send().finally(() => { s.inflight = null; });
      return s.inflight;
    }

    function retryLater() {
      if (s.retryPending) return;
      s.retryPending = true;
      const ms = RETRY_MS[Math.min(s.retries, RETRY_MS.length - 1)];
      s.retries++;
      later(() => { s.retryPending = false; flush(); }, ms);
    }

    function add(partial) {
      const o = offset();
      const raw = now();
      const e = Object.assign({
        id: uuid(), type: "", created: o === null ? raw : raw + o, time: null,
        competitor: "", value: "", target: "", station: "", device: s.device, corrected: o !== null,
      }, partial);
      s.queue.push(e);
      save("queue", s.queue);
      emit();
      flush();
      return e;
    }

    function view() {
      if (!s.state) return null;
      const stored = {};
      s.state.events.forEach((e) => { stored[e.id] = true; });
      const pending = s.queue.filter((e) => !stored[e.id]).map((e) => Object.assign({}, e, { received: null }));
      return Model.buildView(s.state.competitors, s.state.events.concat(pending), correctedNow());
    }

    function status() {
      return {
        loaded: !!s.state, pending: s.queue.length, pinError: s.pinError, rejected: s.rejected.slice(),
        failing: s.failingSince !== null && now() - s.failingSince >= FAILING_AFTER_MS,
      };
    }

    async function checkPin(pin) {
      s.pin = String(pin).trim();
      try {
        await call({ action: "state" });
        save("pin", s.pin);
        succeeded();
        emit();
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: e.message === "pin" ? "pin" : "network" };
      }
    }

    // Browser only: refresh every refreshMs while visible, at once on coming back, and when online again.
    function start(refreshMs) {
      const tick = () => { if (document.visibilityState === "visible") { refresh(); flush(); } };
      tick();
      setInterval(tick, refreshMs);
      document.addEventListener("visibilitychange", tick);
      window.addEventListener("online", () => { s.retries = 0; flush(); });
    }

    return {
      get pin() { return s.pin; },
      get station() { return s.station; },
      setStation(st) { s.station = st; save("station", st); },
      forgetPin() { s.pin = ""; save("pin", ""); },
      dismissRejected(i) { s.rejected.splice(i, 1); save("rejected", s.rejected); emit(); },
      onChange(fn) { listeners.push(fn); },
      checkPin, refresh, flush, add, view, status, correctedNow, start,
    };
  }

  return { create: create };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Store;
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS, including 6 store tests.

- [ ] **Step 5: Commit**

```bash
git add riversidetri/js/store.js riversidetri/_tests/store.test.mjs
git commit -m "Add the local-first store: queue, retries, clock offset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Shared front end — config, UI helpers, time field, styles

**Files:**
- Create: `riversidetri/js/config.js`, `riversidetri/js/ui.js`, `riversidetri/js/time-entry.js`, `riversidetri/css/app.css`
- Test: `riversidetri/_tests/ui.test.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/ui.test.mjs`

```js
import test from "node:test";
import assert from "node:assert/strict";
import UI from "../js/ui.js";
import TimeEntry from "../js/time-entry.js";

test("esc makes text safe to put in HTML", () => {
  assert.equal(UI.esc('<b>"Dana" & co</b>'), "&lt;b&gt;&quot;Dana&quot; &amp; co&lt;/b&gt;");
  assert.equal(UI.esc(null), "");
});

test("search matches part of a name, or the start of a number", () => {
  const dana = { name: "Dana Price", number: 8 };
  const jamie = { name: "Jamie Lowe", number: 22 };
  assert.ok(UI.matches(dana, "pri"));
  assert.ok(!UI.matches(jamie, "pri"));
  assert.ok(UI.matches(jamie, "2"));
  assert.ok(UI.matches(jamie, "22"));
  assert.ok(!UI.matches(dana, "2"));
  assert.ok(UI.matches(dana, "  "));
});

test("flight labels say when a flight hasn't started", () => {
  assert.equal(UI.flightLabel({ flight: "7:15", started: true }), "7:15 flight");
  assert.equal(UI.flightLabel({ flight: "8:10", started: false }), "8:10 flight, not started");
  assert.equal(UI.flightLabel({ flight: "", started: false }), "No flight set");
});

test("a person row is one button: number, name, and the right-hand column", () => {
  assert.equal(UI.personRow({ name: "Dana <Price>", number: 8 }, 'data-open="c1"', "38:16.0"),
    '<li><button type="button" class="row" data-open="c1"><span class="bib">8</span><span class="main"><span class="name">Dana &lt;Price&gt;</span></span><span class="aside-col">38:16.0</span></button></li>');
});

test("the time field fills in the punctuation", () => {
  assert.equal(TimeEntry.format("381"), "38:1");
  assert.equal(TimeEntry.format("38160"), "38:16.0");
  assert.equal(TimeEntry.format("102160"), "1:02:16.0");
  assert.equal(TimeEntry.digitsOf("38:16.0x9"), "381609");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && node --test ui.test.mjs`
Expected: FAIL — `Cannot find module '../js/ui.js'`.

- [ ] **Step 3: Write `riversidetri/js/config.js`**

```js
/* Where the timer's Apps Script web app lives, and what the race is called. The URL isn't secret: the PIN guards it. */
var CONFIG = {
  apiUrl: "", // the web app URL, ending in /exec, pasted in after deployment (see _apps-script/README.md)
  refreshMs: 5000,
  race: { name: "RBC Tri-Wrathlon 2026", date: "Saturday 5 December" },
};
```

- [ ] **Step 4: Write `riversidetri/js/time-entry.js`**

```js
/* The digits-only time field: ghost zeros, printed colon and decimal point, digits fill from the left.
   A real input sits invisibly on top and holds the formatted time for screen readers. */
var TimeEntry = (function () {
  "use strict";
  const layoutFor = (n) => (n > 5 ? "d:dd:dd.d" : "dd:dd.d");
  const digitsOf = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

  function format(d) {
    let out = "";
    let i = 0;
    for (const ch of layoutFor(d.length)) {
      if (i >= d.length) break;
      out += ch === "d" ? d[i++] : ch;
    }
    return out;
  }

  // label must already be HTML-escaped.
  function html(id, label, digits) {
    return '<div class="time-entry"><input class="time-input" id="' + id + '" inputmode="numeric" autocomplete="off" enterkeyhint="done" aria-label="' +
      label + '" value="' + format(digitsOf(digits)) + '"><div class="time-display" aria-hidden="true"></div></div>';
  }

  // root is the .time-entry element. Mounting the same element twice returns the first handle.
  function mount(root, opts) {
    if (root.__timeEntry) return root.__timeEntry;
    opts = opts || {};
    const input = root.querySelector(".time-input");
    const display = root.querySelector(".time-display");
    const toEnd = () => input.setSelectionRange(input.value.length, input.value.length);

    function paint() {
      const d = digitsOf(input.value);
      input.value = format(d);
      display.replaceChildren();
      let i = 0;
      let next = null;
      for (const ch of layoutFor(d.length)) {
        const el = document.createElement("span");
        if (ch !== "d") el.textContent = ch;
        else if (i < d.length) el.textContent = d[i++];
        else { el.textContent = "0"; el.className = "ghost"; if (!next) next = el; i++; }
        display.append(el);
      }
      const caret = document.createElement("span");
      caret.className = "caret";
      if (next) next.before(caret); else display.append(caret);
    }

    input.addEventListener("input", () => { paint(); toEnd(); if (opts.onInput) opts.onInput(digitsOf(input.value)); });
    input.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].indexOf(e.key) >= 0) e.preventDefault();
      if (e.key === "Enter" && opts.onEnter) { e.preventDefault(); opts.onEnter(); }
      if (e.key === "Escape" && opts.onEscape) { e.preventDefault(); opts.onEscape(); }
    });
    input.addEventListener("focus", () => requestAnimationFrame(toEnd));
    input.addEventListener("pointerup", () => requestAnimationFrame(toEnd));
    paint();
    root.__timeEntry = { input: input, digits: () => digitsOf(input.value), focus: () => input.focus() };
    return root.__timeEntry;
  }

  return { html: html, mount: mount, format: format, digitsOf: digitsOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = TimeEntry;
```

- [ ] **Step 5: Write `riversidetri/js/ui.js`**

```js
/* Shared helpers for the pages: escaping, icons, rows, confirm blocks, the sync status and page start-up. */
var UI = (function () {
  "use strict";
  // Lucide icons, 2px stroke.
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };
  const WHAT = { erg: "An erg time", tap: "A stadium time", name: "A name", start: "A flight start", void: "A deletion" };
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function icon(name, cls) {
    return '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  function esc(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  }

  // Search: part of a name, or the start of a number.
  function matches(p, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    if (/^\d+$/.test(q)) return p.number !== null && p.number !== undefined && String(p.number).indexOf(q) === 0;
    return p.name.toLowerCase().indexOf(q) >= 0;
  }

  function flightLabel(g) {
    return !g.flight ? "No flight set" : g.flight + " flight" + (g.started ? "" : ", not started");
  }

  const num = (p) => (p.number === null || p.number === undefined ? "" : String(p.number));

  // A tappable person row. attrs: extra button attributes. right: HTML for the right-hand column.
  function personRow(p, attrs, right) {
    return '<li><button type="button" class="row" ' + attrs + '><span class="bib">' + num(p) + '</span><span class="main"><span class="name">' +
      esc(p.name) + '</span></span><span class="aside-col">' + (right || "") + "</span></button></li>";
  }

  // An inline question with two answers. yes/no: { attr, text, danger }.
  function confirm(message, yes, no) {
    return '<div class="confirm" role="alert"><p>' + esc(message) + '</p><div class="confirm-actions">' +
      '<button type="button" class="button ' + (yes.danger ? "danger" : "primary") + '" ' + yes.attr + "><span>" + esc(yes.text) + "</span></button>" +
      '<button type="button" class="button" ' + no.attr + "><span>" + esc(no.text) + "</span></button></div></div>";
  }

  function errorLine(message, id) {
    return '<p class="row-error"' + (id ? ' id="' + id + '"' : "") + ">" + icon("alert", "icon-16") + "<span>" + esc(message) + "</span></p>";
  }

  // Only touch the DOM when the HTML actually changed, so polling doesn't disturb taps or focus.
  function setHtml(el, html) {
    if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; }
  }

  function announce(text) {
    const el = document.getElementById("live");
    if (!el) return;
    el.textContent = "";
    setTimeout(() => { el.textContent = text; }, 50);
  }

  function loading(store) {
    return '<p class="empty-line">' + (store.status().failing
      ? "Can't reach the timing sheet. Check your signal; this page keeps trying."
      : "Loading the start list…") + "</p>";
  }

  function emptyRoster() {
    return '<p class="empty-line">The start list is empty. Add competitors to the Competitors tab in the Sheet.</p>';
  }

  // Top-bar status (#sync) and the notices strip (#notices), on pages that have them.
  function renderStatus(store) {
    const st = store.status();
    const sync = document.getElementById("sync");
    if (sync) {
      const s = st.failing ? ["sync is-failing", "alert", "Not connected"]
        : st.pending ? ["sync is-waiting", "clock", st.pending + " waiting to send"]
        : ["sync", "check", "All saved"];
      sync.className = s[0];
      setHtml(sync, icon(s[1], "icon-16") + "<span>" + esc(s[2]) + "</span>");
    }
    const box = document.getElementById("notices");
    if (box) {
      let html = st.failing ? '<p class="notice">' + icon("alert", "icon-16") +
        "<span>Can't reach the sheet. Your times are safe on this phone and will send when the connection is back.</span></p>" : "";
      st.rejected.forEach((r, i) => {
        html += '<p class="notice">' + icon("alert", "icon-16") + "<span>" + esc(WHAT[r.event.type] || "An entry") + " wasn't saved. " +
          esc(r.reason) + '</span><button type="button" class="link-button" data-dismiss="' + i + '">OK</button></p>';
      });
      setHtml(box, html);
    }
  }

  function focus(selector) {
    const el = document.querySelector(selector);
    if (el) el.focus();
  }

  // Page start-up: check config and PIN, wire notices, re-render on every change, start syncing.
  // opts.next: "organiser" or "results", so the start page knows where to come back to.
  function boot(render, opts) {
    opts = opts || {};
    if (!window.CONFIG || !CONFIG.apiUrl) {
      const main = document.querySelector("main");
      if (main) main.innerHTML = "<p class=\"empty-line\">The timer isn't connected to its sheet yet.</p>";
      return null;
    }
    const store = Store.create({ url: CONFIG.apiUrl });
    const toStart = (extra) => {
      const q = [opts.next ? "next=" + opts.next : "", extra || ""].filter(Boolean).join("&");
      location.replace("index.html" + (q ? "?" + q : ""));
    };
    if (!store.pin) { toStart(""); return null; }
    const box = document.getElementById("notices");
    if (box) {
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-dismiss]");
        if (b) store.dismissRejected(Number(b.dataset.dismiss));
      });
    }
    store.onChange(() => {
      if (store.status().pinError) { store.forgetPin(); toStart("pin=changed"); return; }
      render();
    });
    store.start(CONFIG.refreshMs || 5000);
    return store;
  }

  return { icon, esc, matches, flightLabel, num, personRow, confirm, errorLine, setHtml, announce, loading, emptyRoster, renderStatus, focus, boot };
})();
if (typeof module !== "undefined" && module.exports) module.exports = UI;
```

- [ ] **Step 6: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && node --test`
Expected: PASS, including 5 UI tests.

- [ ] **Step 7: Write `riversidetri/css/app.css`** (the mockups' components, made real: rows are buttons, plus states)

```css
/* Tri-Wrathlon timer: components, built only from tokens.css. */

@font-face { font-family: "Overpass"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("../fonts/overpass-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Overpass"; font-style: normal; font-weight: 600; font-display: swap;
  src: url("../fonts/overpass-latin-600-normal.woff2") format("woff2"); }

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: var(--font-ui); font-size: var(--text-16); line-height: var(--leading-16);
}
h1, h2, h3, p { margin: 0; }
a { color: var(--accent); text-underline-offset: var(--space-1); }
button, input { font: inherit; color: inherit; }
[hidden] { display: none !important; }
.num, td, .time { font-variant-numeric: tabular-nums; }
.muted { color: var(--ink-muted); }
.icon { width: var(--icon-20); height: var(--icon-20); flex: none; }
.icon-16 { width: var(--icon-16); height: var(--icon-16); flex: none; }
/* Standard screen-reader-only pattern; its 1px sizes are deliberate. */
.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
:is(button, input, a):focus-visible { outline: var(--focus-width) solid var(--accent); outline-offset: var(--focus-offset); }

/* Text inside a box is trimmed to cap height and baseline so it centres optically. */
.topbar h1, .sync span, .button > span, .record > span, .row > .bib, .row > .main > *, .row > .time,
.row > .aside-col, .choice-text > * { text-box: trim-both cap alphabetic; }

/* ---------- Phone shell ---------- */
.phone { max-width: var(--measure-phone); margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  min-height: var(--space-8); padding: 0 var(--space-4); border-bottom: var(--rule-width) solid var(--rule);
}
.topbar h1 { font-size: var(--text-20); line-height: var(--leading-20); font-weight: var(--weight-strong); }
.sync { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); white-space: nowrap; }
.sync.is-waiting, .sync.is-failing { color: var(--ink); }
.sync.is-failing .icon-16 { color: var(--danger); }
.notice {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-3) var(--space-4); background: var(--danger-tint); border-bottom: var(--rule-width) solid var(--rule);
  font-size: var(--text-14); line-height: var(--leading-14);
}
.notice .icon-16 { color: var(--danger); margin-top: calc((var(--leading-14) - var(--icon-16)) / 2); }
.notice span { flex: 1; }
.notice .link-button { min-height: 0; }
.content { flex: 1; padding: 0 var(--space-4) var(--space-6); }
.page-title { margin-top: var(--space-5); font-size: var(--text-20); line-height: var(--leading-20); font-weight: var(--weight-strong); }
.status-line { margin-top: var(--space-4); font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.footer-links { margin-top: var(--space-6); font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }

/* ---------- Sections, lists and rows ---------- */
.section { margin-top: var(--space-5); }
.section-head {
  display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3);
  padding-bottom: var(--space-2); border-bottom: var(--rule-width) solid var(--rule-strong);
}
.section-head h2 { font-size: var(--text-16); line-height: var(--leading-16); font-weight: var(--weight-strong); }
.section-head .count { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.group-label, .subsection {
  padding: var(--space-4) 0 var(--space-2); border-bottom: var(--rule-width) solid var(--rule);
  font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted);
}
.subsection { margin-top: var(--space-4); color: var(--ink); font-weight: var(--weight-strong); }
.empty-line { padding: var(--space-4) 0; color: var(--ink-muted); list-style: none; }
.list { list-style: none; margin: 0; padding: 0; }
.row {
  display: grid; grid-template-columns: var(--space-6) 1fr auto; align-items: center; gap: var(--space-3);
  width: 100%; min-height: var(--tap-min); padding: var(--space-3) 0;
  border: 0; border-bottom: var(--rule-width) solid var(--rule); background: none; color: var(--ink); text-align: left;
}
button.row { cursor: pointer; }
button.row:focus-visible { outline-offset: calc(var(--focus-width) * -1); }
button.row:disabled { cursor: default; color: var(--ink-faint); }
button.row:disabled .bib { color: var(--ink-faint); }
@media (hover: hover) and (pointer: fine) { button.row:not(:disabled):hover { background: var(--surface); } }
.row > .bib { color: var(--ink-muted); text-align: right; font-variant-numeric: tabular-nums; }
.row > .main { display: grid; gap: var(--space-2); min-width: 0; }
.row .sub { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.row > .time { color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.row > .aside-col { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.row > .aside-col .time { font-size: var(--text-16); }

/* A row opened in place for input: an erg time, or fixing a stadium time. */
.row.is-open {
  background: var(--accent-tint); box-shadow: inset var(--mark-width) 0 0 var(--accent);
  row-gap: var(--space-3); padding-right: var(--space-3); padding-bottom: var(--space-4);
}
.row.is-open > .row-entry, .row.is-open > .row-hint, .row.is-open > .row-error,
.row.is-open > .confirm, .row.is-open > .row-actions { grid-column: 2 / -1; }
.row-entry { display: flex; align-items: center; gap: var(--space-3); }
.row-entry .button { flex: 1; }
.row-hint { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.row-error { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--text-14); line-height: var(--leading-14); color: var(--danger); }
.row-error .icon-16 { margin-top: calc((var(--leading-14) - var(--icon-16)) / 2); }
.row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.confirm { display: grid; gap: var(--space-3); padding: var(--space-3) 0; }
.confirm-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }

/* Stadium times waiting for a name. The target is the one the next tapped name goes to. */
.stamp-item { display: flex; align-items: center; gap: var(--space-3); border-bottom: var(--rule-width) solid var(--rule); }
.stamp-item .row { flex: 1; grid-template-columns: 1fr auto; border-bottom: 0; padding-left: var(--space-3); padding-right: var(--space-3); }
.stamp-item .row > .time { font-size: var(--text-20); line-height: var(--leading-20); color: var(--ink); }
.stamp-item.is-target { background: var(--accent-tint); box-shadow: inset var(--mark-width) 0 0 var(--accent); }
.stamp-item.is-target .aside-col { color: var(--ink); }
.stamp-item > .link-button { padding: 0 var(--space-3); }
.stamp-item > .confirm { flex: 1; padding: var(--space-3); }

/* ---------- Search ---------- */
.search { position: relative; margin-top: var(--space-3); }
.search .icon { position: absolute; left: var(--space-3); top: 50%; translate: 0 -50%; color: var(--ink-muted); pointer-events: none; }
.search input {
  width: 100%; min-height: var(--tap-min);
  padding: var(--input-nudge) var(--space-3) 0 calc(var(--space-3) + var(--icon-20) + var(--space-2));
  border: var(--rule-width) solid var(--rule-strong); border-radius: var(--radius-s);
  background: var(--surface); color: var(--ink); font-size: var(--text-16);
}
.search input::placeholder { color: var(--ink-muted); opacity: 1; }

/* ---------- Buttons ---------- */
.button {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  min-height: var(--tap-min); padding: 0 var(--space-4);
  border: var(--rule-width) solid var(--rule-strong); border-radius: var(--radius-s);
  background: var(--surface); color: var(--ink); font-size: var(--text-16); white-space: nowrap; cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-press) var(--ease-out);
}
.button:active:not(:disabled) { transform: scale(var(--press-scale)); }
.button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: var(--weight-strong); }
.button.primary:active:not(:disabled) { background: var(--accent-pressed); }
.button.danger { color: var(--danger); border-color: var(--danger); }
.button:disabled { background: var(--bg); border-color: var(--rule); color: var(--ink-faint); cursor: not-allowed; }
.button.block { display: flex; width: 100%; }
.link-button {
  display: inline-flex; align-items: center; min-height: var(--tap-min); padding: 0;
  border: 0; background: none; color: var(--accent); font-size: var(--text-16);
  text-decoration: underline; text-underline-offset: var(--space-1); cursor: pointer;
}

/* ---------- The record button, docked where a thumb reaches it ---------- */
.dock {
  position: sticky; bottom: 0; padding: var(--space-3) var(--space-4) var(--space-4);
  background: var(--bg); border-top: var(--rule-width) solid var(--rule);
}
.record {
  display: grid; place-content: center; gap: var(--space-3);
  width: 100%; min-height: var(--tap-primary); border: 0; border-radius: var(--radius-m);
  background: var(--accent); color: var(--on-accent); text-align: center; cursor: pointer; touch-action: manipulation;
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-press) var(--ease-out);
}
.record .what { font-size: var(--text-20); line-height: var(--leading-20); font-weight: var(--weight-strong); }
.record .clock { font-size: var(--text-32); line-height: var(--leading-32); font-variant-numeric: tabular-nums; }
.record:active { transform: scale(var(--press-scale)); background: var(--accent-pressed); }

/* ---------- Fields ---------- */
.field { display: grid; gap: var(--space-2); margin-top: var(--space-5); }
.field label { font-size: var(--text-14); line-height: var(--leading-14); }
.field .hint { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.text-input {
  width: 100%; min-height: var(--tap-min); padding: var(--input-nudge) var(--space-3) 0;
  border: var(--rule-width) solid var(--rule-strong); border-radius: var(--radius-s);
  background: var(--surface); color: var(--ink); font-size: var(--text-20);
}
.after-form { margin-top: var(--space-5); }

/* ---------- Time entry: ghost zeros and printed punctuation ---------- */
.time-entry {
  position: relative; justify-self: start; flex: none;
  display: flex; align-items: center; min-height: var(--tap-min); padding: 0 var(--space-3);
  border: var(--rule-width) solid var(--rule-strong); border-radius: var(--radius-s); background: var(--surface);
}
.time-input { position: absolute; inset: 0; width: 100%; margin: 0; padding: 0; border: 0; opacity: 0; font-size: var(--text-16); cursor: text; }
.time-input:focus-visible { outline: none; }
.time-display { font-size: var(--text-32); line-height: var(--leading-32); text-box: trim-both cap alphabetic; font-variant-numeric: tabular-nums; white-space: nowrap; }
.time-display .ghost { color: var(--ink-faint); }
.time-display .caret {
  display: none; width: 0; height: calc(1cap + var(--space-2)); vertical-align: calc(var(--space-1) * -1);
  border-left: var(--focus-width) solid var(--accent); margin: 0 calc(var(--focus-width) / -2);
}
.time-entry:has(.time-input:focus) .caret { display: inline-block; }
.time-entry:has(.time-input:focus-visible) { outline: var(--focus-width) solid var(--accent); outline-offset: var(--focus-offset); }
.has-error .time-entry { border-color: var(--danger); box-shadow: inset 0 0 0 var(--rule-width) var(--danger); }

/* ---------- Station choice (start page) ---------- */
.stations { margin: 0; padding: 0; border: 0; min-width: 0; }
.stations legend { padding: 0; }
.choices { margin-top: var(--space-3); border-top: var(--rule-width) solid var(--rule); }
.choice {
  position: relative; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: var(--space-3);
  min-height: var(--tap-min); padding: var(--space-4) var(--space-3);
  border-bottom: var(--rule-width) solid var(--rule); cursor: pointer;
}
.choice input { position: absolute; left: var(--space-3); width: var(--icon-20); height: var(--icon-20); margin: 0; opacity: 0; }
.choice input:focus-visible { outline: none; }
.choice-text { display: grid; gap: var(--space-2); }
.choice-name { font-weight: var(--weight-strong); }
.choice-sub { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.radio { width: var(--icon-20); height: var(--icon-20); border-radius: 50%; border: var(--focus-width) solid var(--rule-strong); background: var(--surface); }
.choice:has(input:checked) { background: var(--accent-tint); box-shadow: inset var(--mark-width) 0 0 var(--accent); }
.choice:has(input:checked) .radio { border-color: var(--accent); background: var(--accent); box-shadow: inset 0 0 0 var(--space-1) var(--surface); }
.choice:has(input:focus-visible) { outline: var(--focus-width) solid var(--accent); outline-offset: calc(var(--focus-width) * -1); }

/* ---------- Laptop pages ---------- */
.desk { max-width: var(--measure-laptop); margin: 0 auto; padding: var(--space-6) var(--space-5) var(--space-8); }
.desk-head {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--space-3) var(--space-5);
  padding-bottom: var(--space-4); border-bottom: var(--rule-width) solid var(--rule-strong);
}
.desk-head h1 { font-size: var(--text-24); line-height: var(--leading-24); font-weight: var(--weight-strong); }
.desk-head p { margin-top: var(--space-2); }
.desk-head .meta { display: flex; align-items: baseline; gap: var(--space-5); }
.nav { display: flex; gap: var(--space-4); }
.nav a { color: var(--ink-muted); text-decoration: none; }
.nav a[aria-current="page"] {
  color: var(--ink); text-decoration: underline; text-decoration-color: var(--accent);
  text-decoration-thickness: var(--focus-width); text-underline-offset: var(--space-2);
}
.desk .notice { margin-top: var(--space-4); border-radius: var(--radius-s); border-bottom: 0; }
.desk h2 { font-size: var(--text-20); line-height: var(--leading-20); font-weight: var(--weight-strong); }
.block-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-4); margin: var(--space-7) 0 var(--space-3); }
.block-head p { color: var(--ink-muted); font-size: var(--text-14); line-height: var(--leading-14); }
.flights { border-top: var(--rule-width) solid var(--rule-strong); }
.flight {
  display: grid; grid-template-columns: calc(var(--space-8) * 3) 1fr auto; align-items: center; gap: var(--space-5);
  padding: var(--space-4) 0; border-bottom: var(--rule-width) solid var(--rule);
}
.flight h3 { font-size: var(--text-20); line-height: var(--leading-20); font-weight: var(--weight-strong); }
.flight .stack { display: grid; gap: var(--space-1); }
.flight .stack > span:last-child { font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }
.flight .actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-4); }
.clock-input { width: calc(var(--space-8) * 2); }
.issues { list-style: none; margin: 0; padding: 0; border-top: var(--rule-width) solid var(--rule-strong); }
.issues li { display: flex; align-items: baseline; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: var(--rule-width) solid var(--rule); }
.issues li .icon-16 { color: var(--danger); align-self: center; }
.issues li span { flex: 1; }
.empty { padding: var(--space-4) 0; border-top: var(--rule-width) solid var(--rule-strong); border-bottom: var(--rule-width) solid var(--rule); color: var(--ink-muted); }
.footnote { margin-top: var(--space-3); font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted); }

/* ---------- Tables ---------- */
.table-scroll { overflow-x: auto; }
table.data { width: 100%; border-collapse: collapse; white-space: nowrap; }
.data th {
  text-align: right; font-weight: var(--weight-regular); font-size: var(--text-14); line-height: var(--leading-14); color: var(--ink-muted);
  padding: var(--space-2) var(--space-3); border-bottom: var(--rule-width) solid var(--rule-strong);
}
.data td { text-align: right; padding: var(--space-2) var(--space-3); border-bottom: var(--rule-width) solid var(--rule); }
.data th:first-child, .data td:first-child { padding-left: 0; }
.data th:last-child, .data td:last-child { padding-right: 0; }
.data .l { text-align: left; }
.data td.rank { color: var(--ink-muted); width: var(--space-7); }
.data td.strong { font-weight: var(--weight-strong); }
.data .pending { color: var(--ink-muted); }
/* Results tables share fixed column widths so the two tables line up. */
.data.fixed { table-layout: fixed; }
.data.fixed th:first-child { width: var(--space-7); }
.data.fixed th:nth-child(n+3) { width: calc(var(--space-8) * 2); }
.name-button { padding: 0; border: 0; background: none; color: var(--ink); text-align: left; cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .name-button:hover { text-decoration: underline; text-underline-offset: var(--space-1); } }
tr.is-open td, tr.edit-row td { background: var(--accent-tint); }
.edit { display: grid; gap: var(--space-3); padding: var(--space-3) 0; white-space: normal; text-align: left; }
.edit-line { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.edit-label { width: var(--space-8); color: var(--ink-muted); }
```

- [ ] **Step 8: Commit**

```bash
git add riversidetri/js/config.js riversidetri/js/ui.js riversidetri/js/time-entry.js riversidetri/css/app.css riversidetri/_tests/ui.test.mjs
git commit -m "Add shared front end: config, UI helpers, time field and styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end test harness

**Files:**
- Create: `riversidetri/_tests/serve.mjs`, `riversidetri/_tests/fake-api.mjs`, `riversidetri/_tests/playwright.config.mjs`, `riversidetri/_tests/e2e/fixtures.mjs`
- Test: `riversidetri/_tests/e2e/smoke.spec.mjs`

- [ ] **Step 1: Write `riversidetri/_tests/serve.mjs`**

```js
// A tiny static server for the Playwright tests: serves riversidetri/ at http://127.0.0.1:4173.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2" };

http.createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4173, "127.0.0.1");
```

- [ ] **Step 2: Write `riversidetri/_tests/fake-api.mjs`**

```js
// An in-memory stand-in for the Apps Script web app, for the Playwright tests.
export const API = "https://fake-api.test/exec";
export const PIN = "0000";

export function createFakeApi({ rows }) {
  const api = { rows: rows.map((r, i) => Object.assign({ row: i + 2 }, r)), events: [], down: false };
  api.handle = async (route) => {
    if (api.down) return route.abort("internetdisconnected");
    const body = JSON.parse(route.request().postData() || "{}");
    const send = (obj) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(Object.assign({ serverTime: Date.now() }, obj)),
    });
    if (body.pin !== PIN) return send({ ok: false, error: "pin", message: "That PIN didn't work. Check it with the race organiser." });
    const rejected = [];
    if (body.action === "write") {
      for (const e of body.events) {
        if (api.events.some((x) => x.id === e.id)) continue;
        const known = api.rows.some((r) => r.id === e.competitor);
        if ((e.type === "erg" || (e.type === "name" && e.competitor)) && !known) {
          rejected.push({ id: e.id, reason: "That person isn't in Competitors any more." });
          continue;
        }
        api.events.push(Object.assign({}, e, { received: Date.now() }));
      }
    }
    return send({ ok: true, rejected, state: { competitors: api.rows, events: api.events } });
  };
  return api;
}
```

- [ ] **Step 3: Write `riversidetri/_tests/playwright.config.mjs`**

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: { command: "node serve.mjs", url: "http://127.0.0.1:4173/css/app.css", reuseExistingServer: true },
  projects: [
    {
      name: "phone",
      testMatch: /(smoke|start|erg|stadium|a11y|screens)\.spec\.mjs/,
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    {
      name: "laptop",
      testMatch: /(organiser|results|a11y|screens)\.spec\.mjs/,
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
});
```

- [ ] **Step 4: Write `riversidetri/_tests/e2e/fixtures.mjs`**

```js
// Shared Playwright setup: a fake web app, a test config, and a phone that already has the PIN.
import { test as base, expect } from "@playwright/test";
import { createFakeApi, API, PIN } from "../fake-api.mjs";

export const ROWS = [
  { id: "c0000001", name: "Dana Price", number: "8", flight: "8:10", nontrad: "" },
  { id: "c0000002", name: "Jamie Lowe", number: "22", flight: "8:10", nontrad: "" },
  { id: "c0000003", name: "Sam Carter", number: "23", flight: "7:15", nontrad: "" },
  { id: "c0000004", name: "Blair Nolan", number: "5", flight: "7:15", nontrad: "Yes" },
];

const CONFIG_JS = `var CONFIG = { apiUrl: "${API}", refreshMs: 1000, race: { name: "RBC Tri-Wrathlon 2026", date: "Saturday 5 December" } };`;

export const test = base.extend({
  api: async ({}, use) => { await use(createFakeApi({ rows: ROWS })); },
  app: async ({ page, api }, use) => {
    await page.route("**/js/config.js", (route) => route.fulfill({ contentType: "text/javascript", body: CONFIG_JS }));
    await page.route(API, (route) => api.handle(route));
    await use(page);
  },
  signedIn: async ({ app }, use) => {
    await app.addInitScript((pin) => {
      if (localStorage.getItem("tw:pin") === null) localStorage.setItem("tw:pin", JSON.stringify(pin));
    }, PIN);
    await use(app);
  },
});
export { expect, PIN };

let n = 0;
// A stored event, made a minute ago unless fields say otherwise.
export function event(type, fields) {
  n++;
  const at = Date.now() - 60_000 + n;
  return Object.assign({ id: "seed-" + n, type, created: at, time: null, received: at, competitor: "", value: "", target: "", station: "", device: "seed" }, fields);
}

export function started(flight, minutesAgo) {
  const t = Date.now() - minutesAgo * 60_000;
  return event("start", { value: flight, time: t, created: t, received: t });
}

// A race in progress: both flights started, two erg times, one runner in, one time not yet named.
export function seedRace(api) {
  const ago = (min) => Date.now() - min * 60_000;
  api.events.push(
    started("7:15", 80),
    started("8:10", 20),
    event("erg", { competitor: "c0000003", value: "21267" }),
    event("erg", { competitor: "c0000004", value: "18167" }),
    event("tap", { id: "seed-in-1", station: "entrance", time: ago(5) }),
    event("name", { target: "seed-in-1", competitor: "c0000003" }),
    event("tap", { id: "seed-in-2", station: "entrance", time: ago(1) }),
  );
}
```

- [ ] **Step 5: Write the smoke test** — `riversidetri/_tests/e2e/smoke.spec.mjs`

```js
import { test, expect } from "./fixtures.mjs";

test("the test server serves the app and the test config points at the fake web app", async ({ app }) => {
  const config = await app.goto("/js/config.js");
  expect(await config.text()).toContain("fake-api.test");
  const css = await app.request.get("/css/app.css");
  expect(await css.text()).toContain("@font-face");
});
```

- [ ] **Step 6: Run it**

Run: `cd riversidetri/_tests && npx playwright test smoke`
Expected: PASS (1 test, phone project).

- [ ] **Step 7: Commit**

```bash
git add riversidetri/_tests/serve.mjs riversidetri/_tests/fake-api.mjs riversidetri/_tests/playwright.config.mjs riversidetri/_tests/e2e
git commit -m "Add the end-to-end harness: static server, fake web app, fixtures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Start page

**Files:**
- Create: `riversidetri/index.html`, `riversidetri/js/start.js`
- Test: `riversidetri/_tests/e2e/start.spec.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/e2e/start.spec.mjs`

```js
import { test, expect, PIN } from "./fixtures.mjs";

test("a wrong PIN explains; the right one opens the chosen station and is remembered", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByText("Stadium entrance", { exact: true }).click();
  await app.getByLabel("PIN").fill("9999");
  await app.getByRole("button", { name: "Open stadium entrance" }).click();
  await expect(app.getByText("That PIN didn't work. Check it with the race organiser.")).toBeVisible();
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open stadium entrance" }).click();
  await expect(app).toHaveURL(/entrance\.html$/);
  await app.goto("/index.html");
  await expect(app).toHaveURL(/entrance\.html$/);
});

test("it asks for a station before anything else", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open station" }).click();
  await expect(app.getByText("Choose your station first.")).toBeVisible();
});

test("change=1 shows the choices again, with the current station picked", async ({ signedIn }) => {
  await signedIn.addInitScript(() => localStorage.setItem("tw:station", JSON.stringify("exit")));
  await signedIn.goto("/index.html?change=1");
  await expect(signedIn.getByRole("radio", { name: /Stadium exit/ })).toBeChecked();
  await expect(signedIn.getByRole("button", { name: "Open stadium exit" })).toBeVisible();
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && npx playwright test start`
Expected: FAIL — the page is a 404, so the "Stadium entrance" text isn't found.

- [ ] **Step 3: Write `riversidetri/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>RBC Tri-Wrathlon timer</title>
<link rel="preload" href="fonts/overpass-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/app.css">
<script defer src="js/config.js"></script>
<script defer src="js/model.js"></script>
<script defer src="js/store.js"></script>
<script defer src="js/ui.js"></script>
<script defer src="js/start.js"></script>
</head>
<body>
<div class="phone">
  <header class="topbar"><h1>RBC Tri-Wrathlon</h1></header>
  <main class="content">
    <form id="start" novalidate>
      <fieldset class="stations" id="stations">
        <legend class="page-title">Which station are you at?</legend>
        <div class="choices">
          <label class="choice"><input type="radio" name="station" value="erg"><span class="radio"></span><span class="choice-text"><span class="choice-name">Erg</span><span class="choice-sub">In the boathouse. Type each rower's time from the monitor.</span></span></label>
          <label class="choice"><input type="radio" name="station" value="entrance"><span class="radio"></span><span class="choice-text"><span class="choice-name">Stadium entrance</span><span class="choice-sub">Where the run ends. Tap as each runner comes in.</span></span></label>
          <label class="choice"><input type="radio" name="station" value="exit"><span class="radio"></span><span class="choice-text"><span class="choice-name">Stadium exit</span><span class="choice-sub">The finish. Tap as each runner comes out.</span></span></label>
        </div>
      </fieldset>
      <div class="field">
        <label for="pin">PIN</label>
        <input class="text-input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" aria-describedby="pin-hint pin-error">
        <span class="hint" id="pin-hint">Ask the race organiser for it. You only need it once on this phone.</span>
        <p class="row-error" id="pin-error" hidden></p>
      </div>
      <div class="after-form"><button class="button primary block" type="submit" id="open"><span>Open station</span></button></div>
    </form>
    <p class="footer-links" id="links">Organising? Open the <a href="organiser.html">organiser page</a> or the <a href="results.html">results</a>.</p>
  </main>
</div>
</body>
</html>
```

- [ ] **Step 4: Write `riversidetri/js/start.js`**

```js
/* Start page: choose a station, enter the PIN once. Comes straight back to the station next time. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PAGES = { erg: "erg.html", entrance: "entrance.html", exit: "exit.html" };
  const NAMES = { erg: "erg", entrance: "stadium entrance", exit: "stadium exit" };
  const DESK = { organiser: "organiser page", results: "results" };
  const params = new URLSearchParams(location.search);
  const next = DESK[params.get("next")] ? params.get("next") : "";
  const store = Store.create({ url: CONFIG.apiUrl });

  if (!params.has("change") && !params.has("pin") && !next && store.pin && PAGES[store.station]) {
    location.replace(PAGES[store.station]);
    return;
  }

  const form = $("start");
  const open = $("open");
  const chosen = () => { const r = form.querySelector("input[name=station]:checked"); return r ? r.value : ""; };
  const label = () => {
    open.querySelector("span").textContent = next ? "Open the " + DESK[next] : chosen() ? "Open " + NAMES[chosen()] : "Open station";
  };
  const showError = (message) => {
    const el = $("pin-error");
    el.hidden = !message;
    el.innerHTML = message ? UI.icon("alert", "icon-16") + "<span>" + UI.esc(message) + "</span>" : "";
  };

  if (next) { $("stations").hidden = true; $("links").hidden = true; }
  else if (PAGES[store.station]) form.querySelector('input[value="' + store.station + '"]').checked = true;
  if (params.get("pin") === "changed") showError("The PIN has changed. Enter the new one.");
  if (!CONFIG.apiUrl) showError("The timer isn't connected to its sheet yet.");
  label();
  form.addEventListener("change", () => { label(); showError(""); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const station = chosen();
    const pin = $("pin").value.trim();
    if (!next && !station) { showError("Choose your station first."); return; }
    if (!pin) { showError("Enter the PIN."); return; }
    open.disabled = true;
    open.querySelector("span").textContent = "Checking…";
    const r = await store.checkPin(pin);
    open.disabled = false;
    label();
    if (!r.ok) {
      showError(r.reason === "pin" ? "That PIN didn't work. Check it with the race organiser." : "Can't reach the timing sheet. Check your signal and try again.");
      return;
    }
    if (next) { location.href = next + ".html"; return; }
    store.setStation(station);
    location.href = PAGES[station];
  });
})();
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && npx playwright test start`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/index.html riversidetri/js/start.js riversidetri/_tests/e2e/start.spec.mjs
git commit -m "Add the start page: station choice and PIN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Erg station

**Files:**
- Create: `riversidetri/erg.html`, `riversidetri/js/erg.js`
- Test: `riversidetri/_tests/e2e/erg.spec.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/e2e/erg.spec.mjs`

```js
import { test, expect, event, started } from "./fixtures.mjs";

test.beforeEach(async ({ api }) => { api.events.push(started("8:10", 40)); });

test("tap a name, type the digits, save: the time moves to Entered", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await expect(field).toBeFocused();
  await field.pressSequentially("3816");
  await expect(signedIn.locator(".time-display")).toHaveText("38:16.0");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#entered")).toContainText("Dana Price");
  await expect(signedIn.locator("#entered")).toContainText("38:16.0");
  await expect(signedIn.locator("#waiting")).not.toContainText("Dana Price");
  await expect(signedIn.locator("#sync")).toHaveText("All saved");
});

test("too few digits keeps Save off, and Enter explains what to type", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await field.pressSequentially("381");
  await expect(signedIn.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await field.press("Enter");
  await expect(signedIn.getByText("That time is missing digits.", { exact: false })).toBeVisible();
});

test("a time outside 30 to 70 minutes asks first", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  await signedIn.getByLabel("Erg time for Dana Price").pressSequentially("25120");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("That's 25:12.0, outside the usual 30 to 70 minutes. Save it anyway?")).toBeVisible();
  await signedIn.getByRole("button", { name: "Save anyway" }).click();
  await expect(signedIn.locator("#entered")).toContainText("25:12.0");
});

test("correcting an entered time asks before replacing it", async ({ signedIn, api }) => {
  api.events.push(event("erg", { competitor: "c0000001", value: "22960" }));
  await signedIn.goto("/erg.html");
  await signedIn.locator("#entered").getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  for (let i = 0; i < 5; i++) await field.press("Backspace");
  await field.pressSequentially("38061");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("Replace 38:16.0 with 38:06.1?")).toBeVisible();
  await signedIn.getByRole("button", { name: "Replace" }).click();
  await expect(signedIn.locator("#entered")).toContainText("38:06.1");
});

test("search finds people by number", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByLabel("Find a rower").fill("22");
  await expect(signedIn.locator("#waiting")).toContainText("Jamie Lowe");
  await expect(signedIn.locator("#waiting")).not.toContainText("Dana Price");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && npx playwright test erg`
Expected: FAIL — `/erg.html` is a 404.

- [ ] **Step 3: Write `riversidetri/erg.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Erg – RBC Tri-Wrathlon timer</title>
<link rel="preload" href="fonts/overpass-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/app.css">
<script defer src="js/config.js"></script>
<script defer src="js/model.js"></script>
<script defer src="js/store.js"></script>
<script defer src="js/ui.js"></script>
<script defer src="js/time-entry.js"></script>
<script defer src="js/erg.js"></script>
</head>
<body>
<div class="phone">
  <header class="topbar"><h1>Erg</h1><span id="sync" class="sync" role="status"></span></header>
  <div id="notices"></div>
  <main class="content">
    <section class="section" aria-labelledby="waiting-title">
      <div class="section-head"><h2 id="waiting-title">Waiting for a time</h2><span class="count" id="waiting-count"></span></div>
      <div class="search">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="search" type="search" placeholder="Name or number" aria-label="Find a rower" autocomplete="off">
      </div>
      <div id="waiting"></div>
    </section>
    <section class="section" aria-labelledby="entered-title">
      <div class="section-head"><h2 id="entered-title">Entered</h2><span class="count" id="entered-count"></span></div>
      <div id="entered"></div>
    </section>
    <p class="status-line" id="erg-status"></p>
    <p class="footer-links"><a href="index.html?change=1">Change station</a></p>
  </main>
  <div id="live" class="visually-hidden" aria-live="polite"></div>
</div>
</body>
</html>
```

- [ ] **Step 4: Write `riversidetri/js/erg.js`**

```js
/* Erg station: tap a name and its row opens for the time; save. Everything happens on this one screen. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const HINT = "Type the digits only. The colon and decimal point fill in for you.";
  let open = null;  // { id, list: "waiting" | "entered", digits, error, confirm, tenths }
  let entry = null; // the mounted TimeEntry in the open row
  let query = "";
  let showAll = false;

  const store = UI.boot(render);
  if (!store) return;
  store.setStation("erg");
  render();

  $("search").addEventListener("input", (e) => {
    query = e.target.value;
    if (open && open.list === "waiting") open = null;
    render(true);
  });
  document.querySelector("main").addEventListener("click", onClick);

  function render(force) {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("waiting"), UI.loading(store)); return; }
    if (!v.people.length) { UI.setHtml($("waiting"), UI.emptyRoster()); return; }
    // Don't rebuild the rows under someone's thumb while they type a time.
    if (!force && open && document.activeElement && document.activeElement.closest(".is-open")) return;
    if (open && !v.byId[open.id]) open = null;
    renderWaiting(v);
    renderEntered(v);
    const complete = v.flights.filter((f) => v.people.every((p) => p.flight !== f.label || p.erg !== null));
    UI.setHtml($("erg-status"), complete.map((f) => "All " + f.count + " times from the " + f.label + " flight are in.").join(" "));
    mountEntry();
  }

  function renderWaiting(v) {
    const all = Model.waitingForErg(v);
    const total = all.reduce((n, g) => n + g.people.length, 0);
    $("waiting-count").textContent = total ? String(total) : "";
    const groups = all
      .map((g) => Object.assign({}, g, { people: g.people.filter((p) => UI.matches(p, query)) }))
      .filter((g) => g.people.length);
    let html;
    if (!total) html = '<p class="empty-line">Everyone has an erg time.</p>';
    else if (!groups.length) html = '<p class="empty-line">No one waiting matches “' + UI.esc(query) + "”.</p>";
    else {
      html = groups.map((g) => '<p class="group-label">' + UI.esc(UI.flightLabel(g)) + '</p><ul class="list">' +
        g.people.map((p) => (open && open.list === "waiting" && open.id === p.id ? openRow(p) : UI.personRow(p, 'data-open="' + p.id + '"', ""))).join("") +
        "</ul>").join("");
    }
    UI.setHtml($("waiting"), html);
  }

  function renderEntered(v) {
    const done = Model.ergEntered(v);
    $("entered-count").textContent = done.length ? String(done.length) : "";
    if (!done.length) { UI.setHtml($("entered"), '<p class="empty-line">No erg times yet.</p>'); return; }
    const shown = showAll ? done : done.slice(0, 3);
    let html = '<ul class="list">' + shown.map((p) => (open && open.list === "entered" && open.id === p.id
      ? openRow(p)
      : UI.personRow(p, 'data-fix="' + p.id + '"', '<span class="time">' + Model.formatTenths(p.erg) + "</span>"))).join("") + "</ul>";
    if (done.length > 3) html += '<button type="button" class="link-button" data-more>' + (showAll ? "Show the latest 3" : "Show all " + done.length) + "</button>";
    UI.setHtml($("entered"), html);
  }

  function openRow(p) {
    let foot;
    if (open.confirm === "outside") {
      foot = UI.confirm(Model.ergOutsideMessage(open.tenths), { attr: 'data-confirm="outside"', text: "Save anyway" }, { attr: "data-change", text: "Change it" });
    } else if (open.confirm === "replace") {
      foot = UI.confirm("Replace " + Model.formatTenths(p.erg) + " with " + Model.formatTenths(open.tenths) + "?",
        { attr: 'data-confirm="replace"', text: "Replace" }, { attr: "data-close", text: "Keep " + Model.formatTenths(p.erg) });
    } else if (open.error) {
      foot = UI.errorLine(open.error, "open-msg");
    } else {
      foot = '<p class="row-hint" id="open-msg">' + HINT + "</p>";
    }
    const disabled = open.confirm || open.digits.length < 4 ? " disabled" : "";
    return '<li><div class="row is-open' + (open.error ? " has-error" : "") + '">' +
      '<span class="bib">' + UI.num(p) + '</span><span class="main"><span class="name">' + UI.esc(p.name) + "</span></span>" +
      '<button type="button" class="link-button" data-close>Cancel</button>' +
      '<div class="row-entry">' + TimeEntry.html("erg-input", "Erg time for " + UI.esc(p.name), open.digits) +
      '<button type="button" class="button primary" data-save' + disabled + "><span>Save</span></button></div>" +
      foot + "</div></li>";
  }

  function mountEntry() {
    const root = document.querySelector(".row.is-open .time-entry");
    entry = root ? TimeEntry.mount(root, {
      onInput: (d) => {
        open.digits = d;
        const row = root.closest(".row");
        row.querySelector("[data-save]").disabled = d.length < 4;
        if (open.error) {
          open.error = null;
          row.classList.remove("has-error");
          row.querySelector("#open-msg").outerHTML = '<p class="row-hint" id="open-msg">' + HINT + "</p>";
        }
      },
      onEnter: () => save(),
      onEscape: close,
    }) : null;
  }

  function openFor(id, list) {
    const p = store.view().byId[id];
    open = { id: id, list: list, digits: list === "entered" ? Model.tenthsToDigits(p.erg) : "", error: null, confirm: null, tenths: null };
    render(true);
    if (entry) entry.focus();
  }

  function close() {
    const id = open ? open.id : null;
    open = null;
    render(true);
    if (id) UI.focus('[data-open="' + id + '"], [data-fix="' + id + '"]');
  }

  function save(confirmed) {
    if (!open) return;
    const p = store.view().byId[open.id];
    const r = Model.ergEntry(open.digits);
    if (r.error) {
      open.error = Model.ERG_ERRORS[r.error];
      open.confirm = null;
      render(true);
      if (entry) entry.focus();
      return;
    }
    open.tenths = r.tenths;
    if (r.outside && !confirmed) { open.confirm = "outside"; render(true); UI.focus("[data-confirm]"); return; }
    if (p.erg !== null && p.erg !== r.tenths && confirmed !== "replace") { open.confirm = "replace"; render(true); UI.focus("[data-confirm]"); return; }
    if (p.erg !== r.tenths) store.add({ type: "erg", competitor: p.id, value: r.tenths });
    UI.announce("Saved " + Model.formatTenths(r.tenths) + " for " + p.name + ".");
    open = null;
    query = "";
    $("search").value = "";
    render(true);
  }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.open) openFor(d.open, "waiting");
    else if (d.fix) openFor(d.fix, "entered");
    else if ("close" in d) close();
    else if ("save" in d) save();
    else if (d.confirm) save(d.confirm);
    else if ("change" in d) { open.confirm = null; render(true); if (entry) entry.focus(); }
    else if ("more" in d) { showAll = !showAll; render(true); }
  }
})();
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && npx playwright test erg`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/erg.html riversidetri/js/erg.js riversidetri/_tests/e2e/erg.spec.mjs
git commit -m "Add the erg station: rows open in place for the time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Stadium entrance and exit

**Files:**
- Create: `riversidetri/entrance.html`, `riversidetri/exit.html`, `riversidetri/js/stadium.js`
- Test: `riversidetri/_tests/e2e/stadium.spec.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/e2e/stadium.spec.mjs`

```js
import { test, expect, event, started } from "./fixtures.mjs";

test.beforeEach(async ({ api }) => {
  api.events.push(
    started("7:15", 80),
    event("erg", { competitor: "c0000003", value: "21267" }),
    event("erg", { competitor: "c0000004", value: "18167" }),
  );
});

test("record, then tap who it was: the oldest time is named first", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await expect(signedIn.getByText("Record a time first, then tap who it was.")).toBeVisible();
  await expect(signedIn.getByRole("button", { name: /Sam Carter/ })).toBeDisabled();
  const record = signedIn.getByRole("button", { name: "Record arrival" });
  await record.click();
  await signedIn.waitForTimeout(350); // a second press inside 300 ms counts as a bounce
  await record.click();
  const queue = signedIn.locator("#queue");
  await expect(queue.locator(".stamp-item")).toHaveCount(2);
  await expect(queue.locator(".stamp-item").first()).toContainText("Tap who it was");
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await expect(queue.locator(".stamp-item")).toHaveCount(1);
  await expect(signedIn.locator("#log")).toContainText("Sam Carter");
  await signedIn.getByRole("button", { name: /Blair Nolan/ }).click();
  await expect(signedIn.getByText("No times waiting for a name.")).toBeVisible();
  await expect(signedIn.locator("#log")).toContainText("Blair Nolan");
});

test("a stray press can be deleted, and a named time can go back to needing a name", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await signedIn.getByRole("button", { name: "Delete", exact: true }).click();
  await signedIn.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(signedIn.getByText("No times waiting for a name.")).toBeVisible();
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await signedIn.locator("#log").getByRole("button", { name: /Sam Carter/ }).click();
  await signedIn.getByRole("button", { name: "Change name" }).click();
  await expect(signedIn.locator("#queue .stamp-item")).toHaveCount(1);
  await expect(signedIn.locator("#pool")).toContainText("Sam Carter");
});

test("the exit lists who is in the stadium, then anyone missed at the entrance", async ({ signedIn, api }) => {
  api.events.push(
    event("tap", { id: "in-1", station: "entrance", time: Date.now() - 30 * 60_000 }),
    event("name", { target: "in-1", competitor: "c0000003" }),
  );
  await signedIn.goto("/exit.html");
  await expect(signedIn.getByRole("heading", { name: "In the stadium" })).toBeVisible();
  await expect(signedIn.locator("#pool")).toContainText("Sam Carter");
  await expect(signedIn.getByText("Not recorded at the entrance")).toBeVisible();
  await expect(signedIn.locator("#pool")).toContainText("Blair Nolan");
});

test("with no signal, taps wait on the phone, survive a reload and send when it's back", async ({ signedIn, api }) => {
  await signedIn.goto("/entrance.html");
  await expect(signedIn.locator("#sync")).toHaveText("All saved");
  api.down = true;
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await expect(signedIn.locator("#sync")).toHaveText("1 waiting to send");
  await signedIn.reload();
  await expect(signedIn.locator("#sync")).toHaveText("1 waiting to send");
  api.down = false;
  await expect(signedIn.locator("#sync")).toHaveText("All saved", { timeout: 15_000 });
  expect(api.events.filter((e) => e.type === "tap")).toHaveLength(1);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && npx playwright test stadium`
Expected: FAIL — `/entrance.html` is a 404.

- [ ] **Step 3: Write `riversidetri/entrance.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Stadium entrance – RBC Tri-Wrathlon timer</title>
<link rel="preload" href="fonts/overpass-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/app.css">
<script defer src="js/config.js"></script>
<script defer src="js/model.js"></script>
<script defer src="js/store.js"></script>
<script defer src="js/ui.js"></script>
<script defer src="js/stadium.js"></script>
</head>
<body data-station="entrance">
<div class="phone">
  <header class="topbar"><h1>Stadium entrance</h1><span id="sync" class="sync" role="status"></span></header>
  <div id="notices"></div>
  <main class="content">
    <section class="section" aria-labelledby="queue-title">
      <div class="section-head"><h2 id="queue-title">Needs a name</h2><span class="count" id="queue-count"></span></div>
      <ul class="list" id="queue"></ul>
    </section>
    <section class="section" aria-labelledby="pool-title">
      <div class="section-head"><h2 id="pool-title">On the run</h2><span class="count" id="pool-count"></span></div>
      <div class="search">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="search" type="search" placeholder="Name or number" aria-label="Find a runner" autocomplete="off">
      </div>
      <div id="pool"></div>
    </section>
    <section class="section" aria-labelledby="log-title">
      <div class="section-head"><h2 id="log-title">Arrived</h2><span class="count" id="log-count"></span></div>
      <div id="log"></div>
    </section>
    <p class="footer-links"><a href="index.html?change=1">Change station</a></p>
  </main>
  <div class="dock"><button type="button" class="record" id="record" aria-label="Record arrival"><span class="what">Record arrival</span><span class="clock" id="clock" aria-hidden="true"></span></button></div>
  <div id="live" class="visually-hidden" aria-live="polite"></div>
</div>
</body>
</html>
```

- [ ] **Step 4: Write `riversidetri/exit.html`** — identical to `entrance.html` except these six lines:

```html
<title>Stadium exit – RBC Tri-Wrathlon timer</title>
<body data-station="exit">
  <header class="topbar"><h1>Stadium exit</h1><span id="sync" class="sync" role="status"></span></header>
      <div class="section-head"><h2 id="pool-title">In the stadium</h2><span class="count" id="pool-count"></span></div>
      <div class="section-head"><h2 id="log-title">Finished</h2><span class="count" id="log-count"></span></div>
  <div class="dock"><button type="button" class="record" id="record" aria-label="Record finish"><span class="what">Record finish</span><span class="clock" id="clock" aria-hidden="true"></span></button></div>
```

Create it with:

```bash
sed -e 's#<title>Stadium entrance – #<title>Stadium exit – #' \
    -e 's#<body data-station="entrance">#<body data-station="exit">#' \
    -e 's#<h1>Stadium entrance</h1>#<h1>Stadium exit</h1>#' \
    -e 's#<h2 id="pool-title">On the run</h2>#<h2 id="pool-title">In the stadium</h2>#' \
    -e 's#<h2 id="log-title">Arrived</h2>#<h2 id="log-title">Finished</h2>#' \
    -e 's#aria-label="Record arrival"><span class="what">Record arrival</span>#aria-label="Record finish"><span class="what">Record finish</span>#' \
    riversidetri/entrance.html > riversidetri/exit.html
grep -c "Stadium exit\|In the stadium\|Finished\|Record finish\|data-station=\"exit\"" riversidetri/exit.html
```

Expected: `6`.

- [ ] **Step 5: Write `riversidetri/js/stadium.js`**

```js
/* Stadium entrance and exit: record a time, then tap who it was. One screen; <body data-station> says which. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const station = document.body.dataset.station;
  const AT = station === "entrance" ? "arrival" : "finish";
  const BOUNCE_MS = 300; // a second press this soon is a bounce, not a runner
  let target = null;     // the unnamed time picked to name next; null means the oldest
  let query = "";
  let showAll = false;
  let deleting = null;   // an unnamed time waiting for "Delete" to be confirmed
  let fixing = null;     // { tapId, confirm } for a named time opened in the log
  let moving = null;     // { person, fromTap, fromTime, toTap, toTime }
  let lastPress = 0;

  const store = UI.boot(render);
  if (!store) return;
  store.setStation(station);
  render();

  const tick = () => { $("clock").textContent = Model.formatClock(store.correctedNow(), false); };
  tick();
  setInterval(tick, 250);

  $("record").addEventListener("click", () => {
    const t = store.correctedNow();
    if (t - lastPress < BOUNCE_MS) return;
    lastPress = t;
    store.add({ type: "tap", station: station, time: t });
    UI.announce("Recorded " + Model.formatClock(t, true) + ".");
  });
  $("search").addEventListener("input", (e) => { query = e.target.value; moving = null; render(); });
  document.querySelector("main").addEventListener("click", onClick);

  function currentTarget(v) {
    const unnamed = Model.unnamedTaps(v, station);
    if (target && unnamed.some((t) => t.id === target)) return target;
    return unnamed.length ? unnamed[0].id : null;
  }

  function tapTime(v, id) {
    const t = v.taps[station].find((x) => x.id === id);
    return t ? t.time : null;
  }

  function render() {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("pool"), UI.loading(store)); return; }
    if (!v.people.length) { UI.setHtml($("pool"), UI.emptyRoster()); return; }
    const tgt = currentTarget(v);
    renderQueue(v, tgt);
    renderPool(v, tgt);
    renderLog(v);
  }

  function renderQueue(v, tgt) {
    const unnamed = Model.unnamedTaps(v, station);
    $("queue-count").textContent = unnamed.length ? String(unnamed.length) : "";
    if (!unnamed.length) { UI.setHtml($("queue"), '<li class="empty-line">No times waiting for a name.</li>'); return; }
    const next = unnamed.find((t) => t.id !== tgt);
    UI.setHtml($("queue"), unnamed.map((t) => {
      const clock = Model.formatClock(t.time, true);
      if (deleting === t.id) {
        return '<li class="stamp-item is-target">' + UI.confirm("Delete " + clock + "? Use this for a press that wasn't a runner.",
          { attr: "data-delete-yes", text: "Delete", danger: true }, { attr: "data-delete-no", text: "Keep it" }) + "</li>";
      }
      const isTarget = t.id === tgt;
      const note = isTarget ? "Tap who it was" : next && t.id === next.id ? "Next" : "Waiting";
      return '<li class="stamp-item' + (isTarget ? " is-target" : "") + '"><button type="button" class="row stamp" data-target="' + t.id +
        '" aria-pressed="' + isTarget + '"><span class="time">' + clock + '</span><span class="aside-col">' + note + "</span></button>" +
        (isTarget ? '<button type="button" class="link-button" data-delete="' + t.id + '">Delete</button>' : "") + "</li>";
    }).join(""));
  }

  function renderPool(v, tgt) {
    const c = Model.nameCandidates(v, station);
    const count = c.main.concat(c.extra).reduce((n, g) => n + g.people.length, 0);
    $("pool-count").textContent = count ? String(count) : "";
    const filter = (groups) => groups
      .map((g) => Object.assign({}, g, { people: g.people.filter((p) => UI.matches(p, query)) }))
      .filter((g) => g.people.length);
    const list = (groups, key) => groups.map((g) => '<p class="group-label">' + UI.esc(UI.flightLabel(g)) + '</p><ul class="list">' +
      g.people.map((p) => UI.personRow(p, key + '="' + p.id + '"' + (tgt ? "" : " disabled"), "")).join("") + "</ul>").join("");
    const main = filter(c.main);
    const extra = filter(c.extra);
    const recorded = query ? filter(Model.groupByFlight(v, v.people.filter((p) => p[AT] !== null))) : [];
    let html = "";
    if (moving) {
      html += UI.confirm(moving.person.name + " already has " + (station === "entrance" ? "an arrival" : "a finish") + " at " +
        Model.formatClock(moving.fromTime, true) + ". Move it to " + Model.formatClock(moving.toTime, true) + "?",
        { attr: "data-move-yes", text: "Move it" }, { attr: "data-move-no", text: "Cancel" });
    }
    if (!tgt) html += '<p class="empty-line">Record a time first, then tap who it was.</p>';
    html += list(main, "data-name");
    if (extra.length) html += '<p class="subsection">Not recorded at the entrance</p>' + list(extra, "data-name");
    if (recorded.length) html += '<p class="subsection">Already recorded here</p>' + list(recorded, "data-recorded");
    if (!main.length && !extra.length && !recorded.length) {
      html += '<p class="empty-line">' + (query ? "No one matches “" + UI.esc(query) + "”."
        : station === "entrance" ? "No one is on the run." : "No one is in the stadium.") + "</p>";
    }
    UI.setHtml($("pool"), html);
  }

  function splitText(t) {
    if (station === "entrance") return t.person.run === null ? "Run waits for the erg time" : "Run " + Model.formatTenths(t.person.run);
    return t.person.stadium === null ? "No arrival recorded" : "Stadium " + Model.formatTenths(t.person.stadium);
  }

  function renderLog(v) {
    const named = Model.namedTaps(v, station);
    $("log-count").textContent = named.length ? String(named.length) : "";
    if (!named.length) {
      UI.setHtml($("log"), '<p class="empty-line">' + (station === "entrance" ? "No arrivals yet." : "No finishes yet.") + "</p>");
      return;
    }
    if (fixing && !named.some((t) => t.id === fixing.tapId)) fixing = null;
    const shown = showAll ? named : named.slice(0, 3);
    let html = '<ul class="list">' + shown.map((t) => {
      const head = '<span class="bib">' + UI.num(t.person) + '</span><span class="main"><span class="name">' + UI.esc(t.person.name) +
        '</span><span class="sub">' + splitText(t) + '</span></span><span class="time">' + Model.formatClock(t.time, true) + "</span>";
      if (!fixing || fixing.tapId !== t.id) return '<li><button type="button" class="row" data-fix="' + t.id + '">' + head + "</button></li>";
      const actions = fixing.confirm
        ? UI.confirm("Delete " + Model.formatClock(t.time, true) + " for " + t.person.name + "? Their " + (station === "entrance" ? "arrival" : "finish") + " will be empty.",
          { attr: "data-void-yes", text: "Delete", danger: true }, { attr: "data-fix-close", text: "Keep it" })
        : '<div class="row-actions"><button type="button" class="button" data-unname><span>Change name</span></button>' +
          '<button type="button" class="button danger" data-void-ask><span>Delete this time</span></button>' +
          '<button type="button" class="link-button" data-fix-close>Cancel</button></div>';
      return '<li><div class="row is-open">' + head + actions + "</div></li>";
    }).join("") + "</ul>";
    if (named.length > 3) html += '<button type="button" class="link-button" data-more>' + (showAll ? "Show the latest 3" : "Show all " + named.length) + "</button>";
    UI.setHtml($("log"), html);
  }

  function clearSearch() { query = ""; $("search").value = ""; }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    const v = store.view();
    if (!v) return;
    const tgt = currentTarget(v);
    if (d.target) { target = d.target; deleting = null; render(); }
    else if (d.delete) { deleting = d.delete; render(); UI.focus("[data-delete-yes]"); }
    else if ("deleteYes" in d) { store.add({ type: "void", target: deleting }); deleting = null; UI.announce("Deleted."); render(); }
    else if ("deleteNo" in d) { deleting = null; render(); }
    else if (d.name && tgt) {
      const p = v.byId[d.name];
      store.add({ type: "name", target: tgt, competitor: p.id });
      UI.announce(p.name + ", " + Model.formatClock(tapTime(v, tgt), true) + ".");
      target = null;
      clearSearch();
      render();
    } else if (d.recorded && tgt) {
      const p = v.byId[d.recorded];
      moving = { person: p, fromTap: p[AT + "TapId"], fromTime: p[AT], toTap: tgt, toTime: tapTime(v, tgt) };
      render();
      UI.focus("[data-move-yes]");
    } else if ("moveYes" in d && moving) {
      store.add({ type: "name", target: moving.fromTap, competitor: "" });
      store.add({ type: "name", target: moving.toTap, competitor: moving.person.id });
      UI.announce("Moved " + moving.person.name + " to " + Model.formatClock(moving.toTime, true) + ".");
      moving = null;
      target = null;
      clearSearch();
      render();
    } else if ("moveNo" in d) { moving = null; render(); }
    else if (d.fix) { fixing = { tapId: d.fix, confirm: false }; render(); }
    else if ("unname" in d && fixing) {
      store.add({ type: "name", target: fixing.tapId, competitor: "" });
      target = fixing.tapId;
      fixing = null;
      UI.announce("That time is back in Needs a name. Tap who it was.");
      render();
    } else if ("voidAsk" in d && fixing) { fixing.confirm = true; render(); UI.focus("[data-void-yes]"); }
    else if ("voidYes" in d && fixing) { store.add({ type: "void", target: fixing.tapId }); fixing = null; UI.announce("Deleted."); render(); }
    else if ("fixClose" in d) { fixing = null; render(); }
    else if ("more" in d) { showAll = !showAll; render(); }
  }
})();
```

- [ ] **Step 6: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && npx playwright test stadium`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add riversidetri/entrance.html riversidetri/exit.html riversidetri/js/stadium.js riversidetri/_tests/e2e/stadium.spec.mjs
git commit -m "Add the stadium stations: record, then tap who it was

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Organiser page

**Files:**
- Create: `riversidetri/organiser.html`, `riversidetri/js/organiser.js`
- Test: `riversidetri/_tests/e2e/organiser.spec.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/e2e/organiser.spec.mjs`

```js
import { test, expect, event, started, PIN } from "./fixtures.mjs";

test("the organiser page asks for the PIN only, then starts a flight", async ({ app, api }) => {
  await app.goto("/organiser.html");
  await expect(app).toHaveURL(/index\.html\?next=organiser$/);
  await expect(app.getByText("Which station are you at?")).toBeHidden();
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open the organiser page" }).click();
  await expect(app).toHaveURL(/organiser\.html$/);
  await app.getByRole("button", { name: "Start 7:15 flight" }).click();
  await expect(app.locator("#flights")).toContainText("Started at");
  await expect.poll(() => api.events.filter((e) => e.type === "start").length).toBe(1);
});

test("a start time can be changed by typing it", async ({ signedIn, api }) => {
  api.events.push(started("7:15", 30));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Change start time" }).click();
  await signedIn.getByLabel("Start time for the 7:15 flight").fill("7:17:05");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#flights")).toContainText("Started at 7:17:05");
  await expect(signedIn.locator("#flights")).toContainText("2 min 5 s after 7:15");
});

test("needs attention lists problems in plain sentences", async ({ signedIn, api }) => {
  api.rows.push({ row: 6, id: "", name: "", number: "9", flight: "8:10", nontrad: "" });
  await signedIn.goto("/organiser.html");
  await expect(signedIn.locator("#issues")).toContainText("Row 6 of Competitors has no name, so it's left out.");
});

test("an erg time can be fixed from the Everyone table", async ({ signedIn, api }) => {
  api.events.push(started("8:10", 50), event("erg", { competitor: "c0000001", value: "22960" }));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Dana Price" }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  for (let i = 0; i < 5; i++) await field.press("Backspace");
  await field.pressSequentially("38061");
  await signedIn.getByRole("button", { name: "Save erg time" }).click();
  await expect(signedIn.locator("#everyone")).toContainText("38:06.1");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && npx playwright test organiser`
Expected: FAIL — `/organiser.html` is a 404.

- [ ] **Step 3: Write `riversidetri/organiser.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Organiser – RBC Tri-Wrathlon timer</title>
<link rel="preload" href="fonts/overpass-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/app.css">
<script defer src="js/config.js"></script>
<script defer src="js/model.js"></script>
<script defer src="js/store.js"></script>
<script defer src="js/ui.js"></script>
<script defer src="js/time-entry.js"></script>
<script defer src="js/organiser.js"></script>
</head>
<body>
<div class="desk">
  <header class="desk-head">
    <div><h1 id="race-name">RBC Tri-Wrathlon</h1></div>
    <div class="meta"><span id="sync" class="sync" role="status"></span><nav class="nav" aria-label="Pages"><a href="organiser.html" aria-current="page">Organiser</a><a href="results.html">Results</a></nav></div>
  </header>
  <div id="notices"></div>
  <main>
    <div class="block-head"><h2>Flights</h2><p>Start each flight when it actually starts rowing. The time is taken when you press.</p></div>
    <div class="flights" id="flights"></div>
    <div class="block-head"><h2>Needs attention</h2></div>
    <div id="issues"></div>
    <div class="block-head"><h2>Everyone</h2><p>Click a name to fix a time.</p></div>
    <div class="table-scroll">
      <table class="data">
        <thead><tr><th class="l">#</th><th class="l">Name</th><th class="l">Flight</th><th class="l">Status</th><th>Erg</th><th>Run</th><th>Stadium</th><th>Total</th></tr></thead>
        <tbody id="everyone"></tbody>
      </table>
    </div>
    <p class="footnote">* denotes non-traditional tri (not eligible for awards)</p>
  </main>
  <div id="live" class="visually-hidden" aria-live="polite"></div>
</div>
</body>
</html>
```

- [ ] **Step 4: Write `riversidetri/js/organiser.js`**

```js
/* Organiser page (laptop): start flights, see what needs attention, fix anyone's times. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let editing = null;      // competitor id whose row is open
  let editDigits = "";     // what's typed in that row's erg field
  let editMsg = null;
  let confirmVoid = null;  // tap id waiting for a second click on "Delete time"
  let editingStart = null; // flight label whose start time is being changed
  let startMsg = null;
  let undoing = null;      // flight label waiting for "Undo start" to be confirmed
  let entry = null;

  $("race-name").textContent = CONFIG.race.name;
  const store = UI.boot(render, { next: "organiser" });
  if (!store) return;
  render();
  const main = document.querySelector("main");
  main.addEventListener("click", onClick);
  main.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "start-input") saveStart(); });

  function render(force) {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("flights"), UI.loading(store)); return; }
    UI.setHtml($("issues"), issuesHtml(v));
    // Leave an open row alone while someone types in it.
    if (!force && document.activeElement && document.activeElement.closest(".is-editing")) return;
    if (editing && !v.byId[editing]) editing = null;
    UI.setHtml($("flights"), v.flights.length ? v.flights.map((f) => flightHtml(f)).join("") : UI.emptyRoster());
    UI.setHtml($("everyone"), everyoneHtml(v));
    const root = document.querySelector(".edit .time-entry");
    entry = root ? TimeEntry.mount(root, { onInput: (d) => { editDigits = d; }, onEnter: saveErg, onEscape: closeEdit }) : null;
  }

  function flightHtml(f) {
    const people = f.count + (f.count === 1 ? " person" : " people");
    let middle;
    let actions;
    let cls = "flight";
    if (editingStart === f.label) {
      cls += " is-editing";
      middle = '<label class="visually-hidden" for="start-input">Start time for the ' + f.label + " flight</label>" +
        '<input class="text-input clock-input" id="start-input" autocomplete="off" value="' + (f.start === null ? "" : Model.formatClock(f.start, false)) + '">' +
        (startMsg ? UI.errorLine(startMsg) : "<span>Like 8:14:37</span>");
      actions = '<button type="button" class="button primary" data-start-save><span>Save</span></button>' +
        '<button type="button" class="button" data-start-cancel><span>Cancel</span></button>';
    } else if (undoing === f.label) {
      middle = "<span>Undo the " + f.label + " start?</span><span>Times for this flight won't count until it's started again.</span>";
      actions = '<button type="button" class="button danger" data-undo-yes><span>Undo start</span></button>' +
        '<button type="button" class="button" data-undo-no><span>Keep it</span></button>';
    } else if (f.start === null) {
      middle = "<span>Not started</span><span>" + Model.dueNote(f, store.correctedNow()) + "</span>";
      actions = '<button type="button" class="button primary" data-start="' + f.label + '">' + UI.icon("flag") + "<span>Start " + f.label + " flight</span></button>";
    } else {
      middle = '<span class="num">Started at ' + Model.formatClock(f.start, false) + "</span><span>" + Model.startNote(f) + "</span>";
      actions = '<button type="button" class="button" data-start-edit="' + f.label + '"><span>Change start time</span></button>' +
        '<button type="button" class="link-button" data-undo="' + f.label + '">Undo start</button>';
    }
    return '<div class="' + cls + '"><div class="stack"><h3>' + f.label + " flight</h3><span>" + people + '</span></div><div class="stack">' +
      middle + '</div><div class="actions">' + actions + "</div></div>";
  }

  function issuesHtml(v) {
    if (!v.issues.length) return '<p class="empty">Nothing needs attention. Times without names, missing erg times and duplicates show up here.</p>';
    return '<ul class="issues">' + v.issues.map((i) => "<li>" + UI.icon("alert", "icon-16") + "<span>" + UI.esc(i.text) + "</span>" +
      (i.competitor ? '<button type="button" class="link-button" data-fix-person="' + i.competitor + '">Fix</button>'
        : i.station ? '<a href="' + i.station + '.html">Open the ' + Model.STATION_NAMES[i.station].toLowerCase() + "</a>" : "") +
      "</li>").join("") + "</ul>";
  }

  function everyoneHtml(v) {
    const t = (x) => (x === null ? '<span class="pending">–</span>' : Model.formatTenths(x));
    const order = (p) => (p.flightMinutes === null ? 9999 : p.flightMinutes);
    const people = v.people.slice().sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    if (!people.length) return '<tr><td class="l" colspan="8">' + UI.emptyRoster() + "</td></tr>";
    return people.map((p) => "<tr" + (editing === p.id ? ' class="is-open"' : "") + '><td class="rank">' + UI.num(p) + '</td><td class="l">' +
      '<button type="button" class="name-button" data-edit="' + p.id + '" aria-expanded="' + (editing === p.id) + '">' + UI.esc(p.name) + (p.nontrad ? "*" : "") +
      '</button></td><td class="l">' + UI.esc(p.flight || "–") + '</td><td class="l">' + p.status + "</td><td>" + t(p.erg) + "</td><td>" + t(p.run) +
      "</td><td>" + t(p.stadium) + '</td><td class="strong">' + t(p.total) + "</td></tr>" + (editing === p.id ? editHtml(p) : "")).join("");
  }

  function editHtml(p) {
    const tapLine = (label, time, tapId) => '<div class="edit-line"><span class="edit-label">' + label + "</span>" + (time === null
      ? '<span class="muted">None recorded</span>'
      : '<span class="num">' + Model.formatClock(time, true) + "</span>" +
        '<button type="button" class="button" data-unname="' + tapId + '"><span>Remove name</span></button>' +
        (confirmVoid === tapId
          ? '<button type="button" class="button danger" data-void="' + tapId + '"><span>Click again to delete</span></button>'
          : '<button type="button" class="button danger" data-void-ask="' + tapId + '"><span>Delete time</span></button>')) + "</div>";
    return '<tr class="edit-row is-editing"><td></td><td colspan="7"><div class="edit">' +
      '<div class="edit-line' + (editMsg ? " has-error" : "") + '"><span class="edit-label">Erg</span>' +
      TimeEntry.html("edit-erg", "Erg time for " + UI.esc(p.name), editDigits) +
      '<button type="button" class="button primary" data-erg-save><span>Save erg time</span></button>' +
      (editMsg ? UI.errorLine(editMsg) : "") + "</div>" +
      tapLine("Arrival", p.arrival, p.arrivalTapId) + tapLine("Finish", p.finish, p.finishTapId) +
      '<div class="edit-line"><button type="button" class="link-button" data-edit-close>Close</button></div></div></td></tr>';
  }

  function openEdit(id) {
    const v = store.view();
    editing = id;
    editMsg = null;
    confirmVoid = null;
    editDigits = id && v.byId[id].erg !== null ? Model.tenthsToDigits(v.byId[id].erg) : "";
    render(true);
    if (entry) entry.focus();
  }

  function closeEdit() {
    const id = editing;
    editing = null;
    render(true);
    if (id) UI.focus('[data-edit="' + id + '"]');
  }

  function saveStart() {
    const f = store.view().flights.find((x) => x.label === editingStart);
    const typed = $("start-input").value;
    const ms = Model.parseTimeOfDay(typed, f.start === null ? store.correctedNow() : f.start);
    if (ms === null) {
      startMsg = "Type the start time like 8:14:37.";
      render(true);
      $("start-input").value = typed;
      UI.focus("#start-input");
      return;
    }
    store.add({ type: "start", value: f.label, time: ms, corrected: true });
    UI.announce("The " + f.label + " flight now starts at " + Model.formatClock(ms, false) + ".");
    editingStart = null;
    startMsg = null;
    render(true);
  }

  function saveErg() {
    const p = store.view().byId[editing];
    const r = Model.ergEntry(editDigits);
    if (r.error) { editMsg = Model.ERG_ERRORS[r.error]; render(true); if (entry) entry.focus(); return; }
    if (r.tenths !== p.erg) store.add({ type: "erg", competitor: p.id, value: r.tenths });
    UI.announce("Saved " + Model.formatTenths(r.tenths) + " for " + p.name + ".");
    editing = null;
    editMsg = null;
    render(true);
  }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    const v = store.view();
    if (!v) return;
    if (d.start) {
      store.add({ type: "start", value: d.start, time: store.correctedNow() });
      UI.announce("Started the " + d.start + " flight.");
      render(true);
    } else if (d.startEdit) { editingStart = d.startEdit; startMsg = null; render(true); UI.focus("#start-input"); }
    else if ("startSave" in d) saveStart();
    else if ("startCancel" in d) { editingStart = null; render(true); }
    else if (d.undo) { undoing = d.undo; render(true); UI.focus("[data-undo-yes]"); }
    else if ("undoYes" in d) {
      const f = v.flights.find((x) => x.label === undoing);
      if (f) f.startEventIds.forEach((id) => store.add({ type: "void", target: id }));
      UI.announce("The " + undoing + " flight is back to not started.");
      undoing = null;
      render(true);
    } else if ("undoNo" in d) { undoing = null; render(true); }
    else if (d.edit) openEdit(editing === d.edit ? null : d.edit);
    else if (d.fixPerson) {
      openEdit(d.fixPerson);
      const row = document.querySelector('[data-edit="' + d.fixPerson + '"]');
      if (row) row.scrollIntoView({ block: "center" });
    } else if ("ergSave" in d) saveErg();
    else if (d.unname) { store.add({ type: "name", target: d.unname, competitor: "" }); UI.announce("That time is back in Needs a name at the station."); render(true); }
    else if (d.voidAsk) { confirmVoid = d.voidAsk; render(true); UI.focus('[data-void="' + d.voidAsk + '"]'); }
    else if (d.void) { store.add({ type: "void", target: d.void }); confirmVoid = null; UI.announce("Deleted."); render(true); }
    else if ("editClose" in d) closeEdit();
  }
})();
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && npx playwright test organiser`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/organiser.html riversidetri/js/organiser.js riversidetri/_tests/e2e/organiser.spec.mjs
git commit -m "Add the organiser page: start flights, attention list, fix times

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Results page

**Files:**
- Create: `riversidetri/results.html`, `riversidetri/js/results.js`
- Test: `riversidetri/_tests/e2e/results.spec.mjs`

- [ ] **Step 1: Write the failing test** — `riversidetri/_tests/e2e/results.spec.mjs`

```js
import { test, expect, event } from "./fixtures.mjs";

// One finisher's events: erg, then arrival and finish this many seconds after the start.
function finisher(id, erg, arriveS, finishS, k, t0) {
  return [
    event("erg", { competitor: id, value: String(erg) }),
    event("tap", { id: "in-" + k, station: "entrance", time: t0 + arriveS * 1000 }),
    event("name", { target: "in-" + k, competitor: id }),
    event("tap", { id: "out-" + k, station: "exit", time: t0 + finishS * 1000 }),
    event("name", { target: "out-" + k, competitor: id }),
  ];
}

test("results rank finishers and list non-traditional ones separately", async ({ signedIn, api }) => {
  const t0 = Date.now() - 3 * 3600e3;
  api.events.push(
    event("start", { value: "7:15", time: t0 }),
    event("start", { value: "8:10", time: t0 }),
    ...finisher("c0000003", 21267, 4486.2, 5911.8, 1, t0),
    ...finisher("c0000001", 22960, 5186, 7134.4, 2, t0),
    ...finisher("c0000004", 18167, 3760, 5707.4, 3, t0),
  );
  await signedIn.goto("/results.html");
  const overall = signedIn.locator("#overall tbody tr");
  await expect(overall).toHaveCount(2);
  await expect(overall.first()).toContainText("Sam Carter");
  await expect(overall.first()).toContainText("1:38:31.8");
  await expect(signedIn.locator("#nontrad")).toContainText("Blair Nolan*");
  await expect(signedIn.locator("#nontrad")).toContainText("1:35:07.4");
  await expect(signedIn.getByText("* denotes non-traditional tri (not eligible for awards)")).toBeVisible();
  await expect(signedIn.locator("#race-meta")).toHaveText("Saturday 5 December, 3 finishers");
});

test("before anyone finishes, it says so", async ({ signedIn }) => {
  await signedIn.goto("/results.html");
  await expect(signedIn.getByText("No one has finished yet.")).toBeVisible();
  await expect(signedIn.locator("#nontrad-block")).toBeHidden();
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd riversidetri/_tests && npx playwright test results`
Expected: FAIL — `/results.html` is a 404.

- [ ] **Step 3: Write `riversidetri/results.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Results – RBC Tri-Wrathlon timer</title>
<link rel="preload" href="fonts/overpass-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/app.css">
<script defer src="js/config.js"></script>
<script defer src="js/model.js"></script>
<script defer src="js/store.js"></script>
<script defer src="js/ui.js"></script>
<script defer src="js/results.js"></script>
</head>
<body>
<div class="desk">
  <header class="desk-head">
    <div><h1 id="race-name">RBC Tri-Wrathlon</h1><p class="muted" id="race-meta"></p></div>
    <div class="meta"><nav class="nav" aria-label="Pages"><a href="organiser.html">Organiser</a><a href="results.html" aria-current="page">Results</a></nav></div>
  </header>
  <main>
    <div class="block-head"><h2>Overall</h2></div>
    <div id="overall"></div>
    <div id="nontrad-block" hidden>
      <div class="block-head"><h2>Non-traditional</h2></div>
      <div id="nontrad"></div>
      <p class="footnote">* denotes non-traditional tri (not eligible for awards)</p>
    </div>
  </main>
</div>
</body>
</html>
```

- [ ] **Step 4: Write `riversidetri/js/results.js`**

```js
/* Results page (laptop): finishers ranked, non-traditional listed separately. Built to be screenshotted for the email. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  $("race-name").textContent = CONFIG.race.name;
  document.title = CONFIG.race.name + " results";
  const store = UI.boot(render, { next: "results" });
  if (!store) return;
  render();

  function table(rows, star) {
    return '<div class="table-scroll"><table class="data fixed"><thead><tr><th class="l">#</th><th class="l">Name</th><th>Erg</th><th>Run</th>' +
      "<th>Stadium</th><th>Total</th></tr></thead><tbody>" +
      rows.map((r) => '<tr><td class="rank">' + r.place + '</td><td class="l">' + UI.esc(r.person.name) + star + "</td><td>" +
        Model.formatTenths(r.person.erg) + "</td><td>" + Model.formatTenths(r.person.run) + "</td><td>" + Model.formatTenths(r.person.stadium) +
        '</td><td class="strong">' + Model.formatTenths(r.person.total) + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  function render() {
    const v = store.view();
    if (!v) { UI.setHtml($("overall"), UI.loading(store)); return; }
    const r = Model.rank(v.people);
    const n = r.overall.length + r.nontrad.length;
    $("race-meta").textContent = CONFIG.race.date + ", " + n + (n === 1 ? " finisher" : " finishers");
    UI.setHtml($("overall"), r.overall.length ? table(r.overall, "") : '<p class="empty">No one has finished yet.</p>');
    $("nontrad-block").hidden = !r.nontrad.length;
    UI.setHtml($("nontrad"), r.nontrad.length ? table(r.nontrad, "*") : "");
  }
})();
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `cd riversidetri/_tests && npx playwright test results`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/results.html riversidetri/js/results.js riversidetri/_tests/e2e/results.spec.mjs
git commit -m "Add the results page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Accessibility checks, screenshots and the design review

**Files:**
- Create: `riversidetri/_tests/e2e/a11y.spec.mjs`, `riversidetri/_tests/e2e/screens.spec.mjs`

- [ ] **Step 1: Write the accessibility test** — `riversidetri/_tests/e2e/a11y.spec.mjs`

```js
import AxeBuilder from "@axe-core/playwright";
import { test, expect, seedRace } from "./fixtures.mjs";

const PAGES = ["index.html?change=1", "erg.html", "entrance.html", "exit.html", "organiser.html", "results.html"];

for (const path of PAGES) {
  test(`${path} has no serious accessibility problems`, async ({ signedIn, api }) => {
    seedRace(api);
    await signedIn.goto("/" + path);
    await expect(signedIn.locator("body")).not.toContainText("Loading the start list");
    const results = await new AxeBuilder({ page: signedIn }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => v.id + ": " + v.help + " (" + v.nodes.length + ")")).toEqual([]);
  });
}
```

- [ ] **Step 2: Run it, fix anything it finds, run again**

Run: `cd riversidetri/_tests && npx playwright test a11y`
Expected: PASS on both projects. If a check fails, fix the markup or the token use it points at (never relax the test), then re-run.

- [ ] **Step 3: Write the screenshot run** — `riversidetri/_tests/e2e/screens.spec.mjs`

```js
import { test, expect, seedRace } from "./fixtures.mjs";

const PAGES = ["index.html?change=1", "erg.html", "entrance.html", "exit.html", "organiser.html", "results.html"];

for (const scheme of ["light", "dark"]) {
  for (const path of PAGES) {
    test(`screenshot ${path} ${scheme}`, async ({ signedIn, api }, info) => {
      seedRace(api);
      await signedIn.emulateMedia({ colorScheme: scheme });
      await signedIn.goto("/" + path);
      await expect(signedIn.locator("body")).not.toContainText("Loading the start list");
      const name = path.replace(/\.html.*$/, "");
      await signedIn.screenshot({ path: `screenshots/${info.project.name}-${name}-${scheme}.png`, fullPage: true });
    });
  }
}
```

- [ ] **Step 4: Take the screenshots**

Run: `cd riversidetri/_tests && npx playwright test screens`
Expected: PASS; 24 PNGs in `riversidetri/_tests/screenshots/` (ignored by git).

- [ ] **Step 5: Review against the mockups and the brief.** Open each screenshot next to the matching mockup in `_design/riversidetri/mockups/`. Check, in this order, at phone width and in dark as well as laptop light: spacing, colour, icons, copy, type, layout, details, visuals, motion (press a record button and a Save in a real browser; with reduced motion on, presses must not scale). Measure that text in boxes is centred (equal space above and below, as the token sheet did). Fix any differences in `app.css` or the page scripts, re-run `npx playwright test` (everything), and retake the screenshots.

- [ ] **Step 6: Run everything**

Run: `cd riversidetri/_tests && npm test && npx playwright test`
Expected: all Node tests and all Playwright tests PASS.

- [ ] **Step 7: Commit**

```bash
git add riversidetri/_tests/e2e/a11y.spec.mjs riversidetri/_tests/e2e/screens.spec.mjs riversidetri
git commit -m "Add accessibility checks and screenshots; fixes from the design review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report to the user any brief rule broken and left in, with the reason. Known ones: Firefox can't trim text boxes yet, so text there sits about 3px high; the screen-reader-only class uses the standard 1px sizes.

---

### Task 17: Deploy, measure, rehearse, publish

**Files:**
- Modify: `riversidetri/js/config.js` (`apiUrl`)
- Create: `riversidetri/_tests/latency.mjs`

- [ ] **Step 1: The user deploys the back end.** Ask the user to follow `riversidetri/_apps-script/README.md` steps 1–7 in the club Google account (or a personal one, if "Anyone" isn't offered) and send the web app URL. Don't do these steps for them: they involve their Google sign-in and the PIN.

- [ ] **Step 2: Put the URL in the config.** In `riversidetri/js/config.js`, set `apiUrl` to the URL the user sent, e.g.:

```js
  apiUrl: "https://script.google.com/macros/s/AKfycb…/exec",
```

- [ ] **Step 3: Write `riversidetri/_tests/latency.mjs`**

```js
// Times the live web app. Run with TW_URL and TW_PIN set in the environment; never commit the PIN.
const url = process.env.TW_URL;
const pin = process.env.TW_PIN;
if (!url || !pin) { console.error("Set TW_URL and TW_PIN first."); process.exit(1); }
const times = [];
for (let i = 0; i < 10; i++) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ pin, action: "state" }),
  });
  const data = await res.json();
  times.push(Date.now() - t0);
  if (!data.ok) { console.error("The web app said:", data.message); process.exit(1); }
}
times.sort((a, b) => a - b);
console.log("state requests (ms): fastest", times[0], "median", times[5], "slowest", times[9]);
```

- [ ] **Step 4: Measure.** With the user's go-ahead to use the PIN in an environment variable for this one command:

Run: `cd riversidetri/_tests && TW_URL="<the URL>" TW_PIN="<the PIN>" node latency.mjs`
Expected: a line of timings. Keep `refreshMs: 5000` if the median is under 2000 ms; otherwise set it to 8000 and tell the user why.

- [ ] **Step 5: Run every test once more**

Run: `cd riversidetri/_tests && npm test && npx playwright test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add riversidetri/js/config.js riversidetri/_tests/latency.mjs
git commit -m "Connect the timer to its web app; add a latency check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Publish, only with the user's yes.** Ask whether to open a pull request for `riversidetri` into `main` (they merge it) or to merge and push `main` directly. GitHub Pages publishes `peterfrederick.com/riversidetri/` a minute or two after `main` updates. Then check the live page loads:

Run: `curl -s https://peterfrederick.com/riversidetri/ | grep -c "Which station are you at?"`
Expected: `1`.

- [ ] **Step 8: Rehearsal (by Wednesday 2 December), with the user.** The user fills in Competitors, then with three phones and the laptop:
  1. Each phone opens the link, picks its station and enters the PIN once.
  2. The laptop starts the 7:15 flight late on purpose and corrects the start time.
  3. The erg phone enters times by digits, including one with four digits and one outside 30–70 minutes.
  4. The entrance phone records a bunch of three quick arrivals, names them, and fixes one with "Change name".
  5. One phone goes into airplane mode, records two times, reloads, comes back online: "All saved".
  6. The exit phone records finishes; the results page ranks them; the organiser takes the screenshot.
  7. In the Sheet: Tri-Wrathlon → Clear timing data.

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| 2 Timing rules, rounding, ranking, formats | 2, 5, 6, 15 |
| 3 Architecture, repo layout | 1, 7, 9 |
| 4 The Sheet, events, replacement by `Created`, Results tab | 4, 5, 7 |
| 5 Web app API, cache, lock, PIN | 7 |
| 6 Refresh, local-first writes, retries, rejected events, clock offset | 8, 9, 13 |
| 7 Screens and their states | 9, 11–15 |
| 8 Validation | 2, 5, 7, 12, 13 |
| 9 Design rules | 9, 16 |
| 10 Testing | every task; 16 |
| 11 Deployment and race day | 7, 17 |

Small changes from the spec, made while planning: the top bar says "Not connected" and the full sentence ("Can't reach the sheet. Your times are safe on this phone…") sits in a notice strip under it, because the sentence doesn't fit beside the station name on a phone; a second press of a record button within 300 ms is ignored as a bounce; the organiser page has "Undo start" for an accidental start; "has finished but has no stadium arrival" is listed in Needs attention.
