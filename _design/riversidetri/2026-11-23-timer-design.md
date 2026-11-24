# Tri-Wrathlon timer: design spec

Status: approved design, ready for an implementation plan. Written 23 November 2026.
Race day: **Saturday 5 December 2026**, flights at 7:15 and 8:10.
Branch: `riversidetri` in `pfredCL/peterfrederick`. Published at `peterfrederick.com/riversidetri/`.

Companion files in this folder: `tokens.css` (design tokens, approved), `tokens.html` (token sheet),
`mockups/` (approved static mockups, built by `mockups/build.py`).

---

## 1. What it is

A replacement for the Bubble app that timed the RBC Tri-Wrathlon: a 10k erg in the boathouse, a 10k run
around the Charles, then Harvard Stadium.

| Who | Device | Does |
|---|---|---|
| Erg volunteer | own phone, in the boathouse | types each rower's time from the monitor |
| Stadium entrance volunteer | own phone | taps when each runner arrives, then names the tap |
| Stadium exit volunteer | own phone | taps when each runner finishes, then names the tap |
| Organiser | laptop at the boat club | starts each flight, fixes mistakes, screenshots the results for the email |

Used once a year, for about four hours. No spectators. Competitors are known by name; numbers written on
hands are a backup.

## 2. Timing rules

- **T₀** is the moment the organiser presses "Start flight" for that competitor's flight (flights rarely
  start on time, so the schedule is never used for timing).
- **Erg** is the time typed from the monitor.
- **Arrival** is the entrance tap named for that competitor; **finish** is the exit tap named for them.
  If one competitor ends up named on two taps at the same station, the earlier tap counts until someone
  fixes it, and it is listed in Needs attention.
- **Run** = arrival − (T₀ + erg). The transition from erg to run counts as run time.
- **Stadium** = finish − arrival.
- **Total** = erg + run + stadium = finish − T₀.

Rounding, so every row adds up exactly: convert arrival and finish to tenths after T₀ first,
`A = round((arrival − T₀) / 100 ms)` and `F = round((finish − T₀) / 100 ms)`. Then run = `A − erg`,
stadium = `F − A`, total = `F`. (Several 2025 rows were 0.1–0.2 s out because each split was rounded on
its own.)

Results: traditional competitors ranked by total, fastest first; non-traditional competitors ranked
separately underneath, names marked `*`, with the line
"* denotes non-traditional tri (not eligible for awards)". Equal totals (to the tenth) share a place.
Non-traditional is only a label; it changes nothing about timing.

Times are shown as `m:ss.t` under an hour and `h:mm:ss.t` from an hour, always in tabular figures.

## 3. Architecture

```
phones + laptop  ──HTTPS──>  GitHub Pages: peterfrederick.com/riversidetri/   (static HTML, CSS, JS)
       │
       └──HTTPS POST──>  Google Apps Script web app  ──>  Google Sheet (owned by the club Google account)
```

- **Front end:** plain HTML, CSS and JavaScript, no build step. Deploying is pushing the `riversidetri/`
  folder to `main`.
- **Back end:** one Apps Script web app bound to the Sheet, executing as the club account, open to
  "Anyone" (the PIN is the gate).
- **One source of truth for the maths:** `model.js` is plain JavaScript with no dependencies. The browser
  loads it, the Apps Script project includes a copy of it, and the Node tests import it. A test fails if
  the Apps Script copy differs from `riversidetri/js/model.js`.
- `riversidetri/css/tokens.css` becomes the live copy of the tokens; the one in this folder is the
  approved original.

### Repository layout

```
riversidetri/
  index.html            start: choose station, enter PIN
  erg.html
  entrance.html         \ both run js/stadium.js
  exit.html             /
  organiser.html
  results.html
  css/tokens.css        copied from _design/riversidetri/tokens.css
  css/app.css           components, built from tokens only
  fonts/                Overpass 400 and 600, latin subset, woff2 (from Fontsource)
  js/config.js          the web app URL (not secret), the race name, year and date
  js/model.js           pure: parse, compute splits, rank, validate, format
  js/store.js           local state, write queue, sync loop, clock offset
  js/time-entry.js      the 00:00.0 field
  js/ui.js              small DOM helpers and the Lucide icons in use
  js/erg.js, js/stadium.js, js/organiser.js, js/results.js, js/start.js
  _apps-script/         Code.gs and a copy of model.js; pasted into the Apps Script editor
  _tests/               Node and Playwright tests, package.json (underscore: not published)
```

Folders starting with `_` are not published by GitHub Pages' Jekyll build, so `_apps-script/` and `_tests/`
stay in the repo without being served.

## 4. The Sheet

Three tabs, each one table that grows year after year: the Sheet is the race's history, not a copy made
fresh each year. Every tab starts with a **Year** column. The site works on one year at a time, the
`year` in `js/config.js`, and only reads and writes that year's rows.

`setup()` (run from the Apps Script editor; safe to run again) creates any tab that is missing, writes the
headers, inserts the Year column at the left of a tab made before it existed (keeping its rows), protects
the script-only tabs and adds a "Tri-Wrathlon" menu:

- **Rebuild results** rewrites the Results rows of every year that has events.
- **Clear timing data** asks which year (typed, so it can't be picked by accident), deletes that year's
  Events rows, rebuilds that year's Results and refuses any event made before that moment for that year.
  It does nothing for a year with no events, so a year typed into Results by hand can't be wiped.

**Competitors** — the organiser fills this in before race day and adds late entries here. One row per
person per year: someone who races two years has two rows.

| Year | Name | Number | Flight | Non-traditional | ID |
|---|---|---|---|---|---|
| filled in if blank | required | optional, unique whole number | `7:15` or `8:10` (any `h:mm`) | `Yes` or blank | filled in by the script |

- A named row with a blank Year gets the site's year the next time a phone asks for the state.
- Blank rows are ignored. Rows can be sorted or edited freely.
- `ID` is a short random key the script writes into any row that lacks one, so events stay attached to the
  right person even if a name is corrected or rows are re-sorted. Deleting a row orphans its events, which
  then show up in "Needs attention".
- The flights are whatever distinct values appear in that year's Flight column, ordered by time.

**Events** — written only by the script; append-only; protected. Each row carries the year it was
written for.

| Year | Event ID | Type | Created | Time | Received | Competitor | Value | Target | Station | Device |
|---|---|---|---|---|---|---|---|---|---|---|

`Created` is when the event was made on the device (clock-corrected, section 6). `Time` is the moment the
event is about: the tap, or the flight start. `Received` is when the server stored it.

| Type | Meaning | Uses |
|---|---|---|
| `start` | a flight started | Value = flight, Time = start moment |
| `erg` | an erg time | Competitor, Value = tenths of a second |
| `tap` | a stadium tap | Station = `entrance` or `exit`, Time = tap moment |
| `name` | names a tap | Target = tap's Event ID, Competitor (blank = remove the name) |
| `void` | cancels an event | Target = the cancelled Event ID |

Nothing is ever edited or deleted. A later `erg` for the same competitor replaces the earlier one; a later
`start` for the same flight replaces the earlier one; a later `name` for the same tap replaces the earlier
one. "Later" means a later `Created`, with `Received` breaking ties, so a phone that was offline and sends
an old entry late can't overwrite a newer correction. `void` removes an event from every calculation.
Event IDs are made on the device (UUIDs), so resending the same event is harmless.

**Results** — one row per competitor per year, newest year first, so it filters and sorts like any table:

| Year | Place | Name | Number | Flight | Erg | Run | Stadium | Total | Non-traditional | Status |
|---|---|---|---|---|---|---|---|---|---|---|

Within a year: finishers in place order, then non-traditional finishers in their own place order (name
marked `*`), then anyone not finished (no place). After every write the script rewrites that year's rows
and leaves every other year's rows alone, so past years can be typed in by hand later. It means the Sheet
alone still shows the results if the site ever fails.

**Script properties** — `PIN`, and `CLEARED_AT_<year>` set by "Clear timing data". The PIN is never
stored in the repo or the front-end code.

## 5. The web app API

One URL, `POST` only, body sent as `text/plain` JSON so browsers make no CORS preflight request. The PIN
travels in the body, never in the URL.

```
request   { "pin": "…", "year": 2026, "action": "state" }
request   { "pin": "…", "year": 2026, "action": "write", "events": [ { "id", "type", "created", "time", "competitor", "value", "target", "station", "device" } ] }
response  { "ok": true, "serverTime": 1764940000000, "state": { "competitors": [...], "events": [...] } }
response  { "ok": false, "error": "pin" | "bad-request" | "server", "message": "…", "rejected": [ { "id", "reason" } ] }
```

- `write` takes the script lock, skips any event ID already stored, appends the rest, rewrites the Results
  tab, clears the cache and returns fresh state.
- Every request carries the site's `year`, a four-digit number; without one the answer is `bad-request`
  with "This page is out of date. Reload it." `state` returns only that year's competitors and events;
  `write` stamps each new event with it.
- The server checks shape only: known type, competitor ID known for that year, tap ID known for that year,
  numbers where numbers belong. An event ID stored in any year counts as already stored.
  The front end does the real validation (section 8).
- `state` is cached per year with Apps Script's CacheService for up to 60 seconds. Any write clears it, and an
  `onEdit` trigger clears it whenever someone edits the Sheet by hand, so edits to Competitors show up on
  the next refresh.
- The same PIN opens the stations, the organiser page and the results page.

## 6. Sync, refresh, offline and clocks

- **Refresh:** each open page asks for state every **5 seconds** while it's visible, straight away when it
  comes back into view, and after each write. A name added to the Sheet reaches the phones within about
  5 seconds plus the request time. Apps Script requests typically take around a second, so polling much
  faster than every few seconds mostly adds load without making changes noticeably quicker. To be measured
  once it's deployed, and tuned if needed.
- **Writes are local first.** Every tap or save goes into a queue in `localStorage` and shows on screen
  immediately (well within the 400 ms target), then is sent in order. Failed sends retry after 2, 5, 10,
  then every 30 seconds, and immediately when the phone comes back online. Reloading the page keeps the
  queue.
- **Rejected events** (say, a name for someone since deleted from the Sheet) leave the queue and show on
  that phone in a plain sentence with what to do, so the queue never sticks.
- **Sync status** in the top bar: "All saved", "3 waiting to send" (with the clock icon), or after a minute
  of failures, "Can't reach the sheet. Your times are safe on this phone."
- **Double submits** can't happen: each action creates one event with one ID, and the button that made it
  is disabled until the screen has updated.
- **Phone clocks:** each response carries the server's time. The phone works out its offset from it
  (`serverTime − midpoint of send and receive`), keeping the sample with the shortest round trip from the
  last few, and stamps every tap with `Date.now() + offset`. A tap made before the first successful sync
  stores the raw phone time and has the offset applied when it is sent. This keeps a phone that is a few
  seconds wrong from skewing run and stadium times.

## 7. Screens

All screens follow the approved mockups and tokens. Phone screens are one screen each: there are no
pop-ups or second pages for input.

### Start (`index.html`)
Choose the station (erg, stadium entrance, stadium exit), enter the PIN, open the station. The phone
remembers both; the next visit goes straight to the station. Links to the organiser page and results.
Wrong PIN: "That PIN didn't work. Check it with the race organiser."

### Erg (`erg.html`)
- Search (name or number), then **Waiting for a time**: everyone without an erg time, grouped by flight,
  started flights first, each group in first-name order.
- Tapping a name opens that row in place with the 00:00.0 time field (focused, number pad) and Save.
  Opening another row closes the first.
- The time field: digits only; ghost zeros; the colon and decimal point are printed; four digits mean whole
  seconds (`3816` → 38:16.0); a sixth digit switches to h:mm:ss.t; fewer than four digits, or minutes or
  seconds over 59, is an error with a plain sentence.
- Outside 30–70 minutes asks once, in the row: "That's 25:12.0, outside the usual 30 to 70 minutes. Save
  it anyway?" with "Save anyway" and "Change it".
- **Entered**: the latest three, newest first, and "Show all". Tapping one opens it to correct; saving a new
  time replaces the old one after "Replace 38:16.0 with 38:06.1?".

### Stadium entrance and exit (`entrance.html`, `exit.html`)
- **Record arrival** / **Record finish** docked at the bottom with a live clock. Each press adds a time to
  **Needs a name**. It never animates beyond the press itself.
- The oldest unnamed time is the target ("Tap who it was"). Tapping another unnamed time makes it the target.
- Below: search, then the people it could be, grouped by flight.
  - Entrance: everyone whose flight has started and who has no arrival yet.
  - Exit: everyone with an arrival and no finish, then anyone in a started flight with no arrival, under
    "Not recorded at the entrance".
- Tapping a name names the target time; the next unnamed time becomes the target.
- With no time waiting, the names are inactive and the list starts with "Record a time first, then tap
  who it was."
- **Arrived** / **Finished**: the latest three, newest first, with "Show all". Tapping one opens it with
  "Change name" and "Delete this time" (asks first).

### Organiser (`organiser.html`, laptop)
- **Flights**: each flight with its head count. Before starting: "Start 8:10 flight" (primary). After:
  "Started at 7:17:05, 2 min 5 s after 7:15" and "Change start time" (opens an h:mm:ss field in place).
- **Needs attention**, in plain sentences, each with the action that fixes it:
  times without names for over 2 minutes; a competitor named on two taps at one station; erg time missing
  for someone who has arrived; implausible splits (section 8); Competitors rows with a missing name, a
  repeated number or an unreadable flight; events for a deleted competitor. Empty state: "Nothing needs
  attention."
- **Everyone**: number, name, flight, status (Not started, On the erg, On the run, In the stadium,
  Finished), erg, run, stadium, total. Clicking a row opens it in place to correct the erg time, change or
  remove the arrival or finish name, or delete a time.
- No "add person": competitors are added in the Sheet.

### Results (`results.html`, laptop, built to be screenshotted)
"RBC Tri-Wrathlon 2026", "Saturday 5 December", the finisher count, the **Overall** table, then
**Non-traditional** with the footnote. During the race it shows finishers so far.

### States on every screen

| State | What shows |
|---|---|
| Loading (first fetch) | the page frame with "Loading the start list…" in place of the lists |
| Empty start list | "The start list is empty. Add competitors to the Competitors tab in the Sheet." |
| Can't reach the sheet | top bar status as in section 6; the page keeps working from the last state |
| Disabled | inactive names when no time is waiting; Save until four digits are typed |
| Keyboard focus | 2px accent outline, 2px offset, on everything focusable |
| Pressed | scale 0.97 over 100 ms (none with reduced motion) |

## 8. Validation

On the device, before anything is queued:

- Erg: at least four digits; minutes and seconds 0–59; outside 30–70 minutes needs "Save anyway".
- A tap can only be named for someone in that station's list.
- Run must be positive. Run under 20 minutes or over 2 hours, and stadium under 10 minutes or over
  90 minutes, are saved but listed in Needs attention.
- Naming someone who already has a time at that station asks: "Dana Price already has an arrival at
  8:52:54.1. Move it to this time?"

On the server: event shape only (section 5).

## 9. Design rules (from the brief)

- Components use tokens only. One accent (the crest's blue) on white and neutral greys, light and dark (dark
  follows the phone). Overpass at 400 and 600 only, tabular figures for every number. Nothing under 12px.
- Text in boxes is trimmed (`text-box: trim-both cap alphabetic`) so it centres; native inputs use
  `--input-nudge`. Firefox doesn't support the trim yet and shows text about 3px high: accepted.
- Lucide icons at a 2px stroke, 16/20/24px. No emoji, illustrations, gradients, glass, pill badges,
  uppercase letter-spaced labels or weights of 700 and up.
- Motion: presses 100 ms at 0.97; other transitions 160 ms; overlays from 0.95 with a fade; hover styles only
  for a fine pointer; reduced motion keeps fades and drops movement; keyboard actions never animate.
- Errors are one plain sentence saying what happened and what to do.

### Decisions, 24 November 2026 (after the design review)

These replace the "warm neutrals" and "printed-results paper" above. Chosen from the review mock-up
(`mockups/design-review/`), which shows each option next to how it was before.

- **Online race results, not printed paper.** Light: page `#FFFFFF`, ink `#15171B`, rules `#E3E5E9`, and the
  accent is the crest's blue `#284DA6`. Dark: a neutral `#111318` with accent `#8FAEEB`. All values are in
  `riversidetri/css/tokens.css`, which is now the source of truth (the copy in this folder is the November one).
- **The club crest sits beside the title** on every page: 32px tall on phones, 56px on laptops; the white
  version in dark mode. It is decorative (the title says the name), so it has empty alt text.
- **Less helper text.** Gone: the three station descriptions and the PIN hint on the start page; the two
  section hints on the organiser page ("Start each flight when…", "Click a name to fix a time."); the
  "Right on 7:15" note when a flight starts on time (a late or early start still says how far off it was);
  the second sentence of the empty Needs attention ("Nothing needs attention." stays). Kept: "Tap who it was",
  "Record a time first, then tap who it was." and the hint under the erg time field.
- **No accent bar down the left edge** of the open erg row, the chosen station or the time waiting for a
  name. They keep the tint.
- **Leg in progress instead of dashes** in the Everyone table: a time not run yet is blank, except the leg
  each person is on, which shows whole minutes on it so far ("22 min"): on the erg since the flight's start,
  on the run since the end of their erg, in the stadium since their arrival.
- **Times stay in Overpass.** Overpass Mono, Barlow Semi Condensed, Big Shoulders Text, B612 Mono and Saira
  Semi Condensed were shown and not chosen.
- **The results page is narrower:** 42rem including its padding, so the tables are 624px wide and the
  emailed screenshot has no gap between names and times.
- **The stadium exit's count is the people in the stadium only**, not those listed under "Not recorded at the
  entrance".

## 10. Testing

- **Model (Node, `node --test`):** time parsing and formatting, the rounding rule, run/stadium/total, ranking
  and ties, replacement by `Created` (including a late offline event), voids, duplicate names, validation,
  and that the Apps Script copy of `model.js` matches. Fixture: the 2025 splits under made-up names, checking that
  every computed total equals the sum of its splits.
- **Pages (Playwright, against a fake web app):** each station's flow end to end, offline queueing and
  resend, wrong PIN, empty start list, and axe-core accessibility checks on every page.
- **Screenshots** of every page at 375px and 1280px, light and dark, reviewed against the mockups.
- **Rehearsal:** a full dry run on real phones with the real Sheet a few days before the race, then
  "Tri-Wrathlon → Clear timing data" from the Sheet menu.

## 11. Deployment and race day

1. In the club Google account, create the Sheet, open Extensions → Apps Script, paste `Code.gs` and
   `model.js`, set the `PIN` script property, run `setup()` once and approve Google's permission screen.
2. Deploy → New deployment → Web app: execute as me, access "Anyone". Send the web app URL; it goes into
   `js/config.js`.
3. Merge `riversidetri` into `main`; GitHub Pages publishes `peterfrederick.com/riversidetri/`.
4. Fill in Competitors. Rehearse. Clear timing data for the year.
   Each later year: add that year's Competitors rows, change `year` and `date` in `js/config.js`, rehearse.
5. Race day: volunteers open the link, pick their station, enter the PIN. If the site fails, the Sheet's
   Events and Results tabs still hold everything recorded.

## 12. Risks

- **Workspace sharing policy.** The Sheet belongs to a Google Workspace account. If the club's admin
  settings don't allow "Anyone" access to web apps, deployment step 2 won't offer it. Check this first;
  the fallback is a personal Google account owning the Sheet.
- **Apps Script speed.** Not measured yet in this account; cold starts can take a few seconds. Local-first
  writes keep the stations responsive regardless.
- **Phone clocks** are corrected as in section 6; a phone whose clock jumps mid-race would still be off.
- **Time.** Twelve days from this spec to race day, so the rehearsal needs to happen by about 2 December.

## 13. Out of scope

Adding or editing competitors in the app, a public or spectator view, sending the results email, printing
numbers, showing past years on the site (they are in the Sheet), typing in the years before 2026 (later,
by hand into Results), and a
single-tap "name and record" shortcut.
