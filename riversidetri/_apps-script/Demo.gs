/* Demo data: 24 made-up people part way through this year's race, to see how the timer looks and feels.
   In the editor, run populate to add them and clear to take them out again. Setup: README.md in this folder.

   Everything populate adds has an ID starting "demo-". clear takes that out, plus anything the phones added
   about the made-up people (erg times, stadium times named for them, changes to those). Real people and their
   times stay. Run clear before the rehearsal. */

const DEMO_PREFIX = "demo-";

// Name, flight (1 or 2), non-traditional, then erg, run and stadium times. A blank time hasn't happened yet.
// The first flight started 100 to 105 minutes before populate ran, the second 55 minutes after the first.
const DEMO_PEOPLE = [
  // First flight, finished
  ["Charlie Carter", 1, "", "31:12.4", "29:40", "22:05"],
  ["Blair Nolan", 1, "Yes", "30:34.6", "33:10", "26:28"],
  ["Jordan Pike", 1, "", "31:55.0", "31:06", "24:12"],
  ["Riley Okafor", 1, "", "32:38.7", "32:12", "25:10"],
  ["Morgan Ellis", 1, "", "33:31.3", "34:05", "24:50"],
  ["Frankie Lindqvist", 1, "Yes", "34:48.2", "35:30", "26:52"],
  // First flight, in the stadium
  ["Devon Marsh", 1, "", "35:40.8", "43:00", ""],
  ["Quinn Halloran", 1, "", "36:55.0", "45:00", ""],
  ["Harper Voss", 1, "", "38:22.9", "48:10", ""],
  ["Rowan Adeyemi", 1, "", "39:58.1", "50:50", ""],
  // First flight, on the run
  ["Emerson Tate", 1, "", "41:05.0", "", ""],
  ["Finley Ward", 1, "", "43:08.4", "", ""],
  ["Hayden Cho", 1, "", "45:01.6", "", ""],
  // Second flight, on the run
  ["Jamie Novak", 2, "", "30:56.2", "", ""],
  ["Kendall Price", 2, "", "31:43.5", "", ""],
  ["Logan Reyes", 2, "", "33:10.0", "", ""],
  ["Marley Fischer", 2, "", "34:07.7", "", ""],
  ["Noel Brennan", 2, "Yes", "35:22.4", "", ""],
  ["Parker Iverson", 2, "", "37:16.9", "", ""],
  ["Reese Moreau", 2, "", "40:05.3", "", ""],
  // Second flight, still on the erg
  ["Sasha Petrov", 2, "", "", "", ""],
  ["Taylor Quint", 2, "", "", "", ""],
  ["Drew Kowalski", 2, "", "", "", ""],
  ["Dakota Moreno", 2, "", "", "", ""],
];

function populate() {
  const year = String(new Date().getFullYear());
  const now = Date.now();
  const fiveMin = 5 * 60000;
  const first = Math.floor((now - 100 * 60000) / fiveMin) * fiveMin;
  const starts = [first, first + 55 * 60000];
  // Flights are typed as 24-hour times, like "13:25", so an afternoon flight can't be read as the morning.
  const typed = starts.map((ms) => { const d = new Date(ms); return d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2); });

  const people = [];
  const events = [];
  const add = (id, type, created, fields) => events.push(Object.assign(
    { id: DEMO_PREFIX + id, type: type, created: created, time: "", competitor: "", value: "", target: "", station: "" }, fields));
  starts.forEach((ms, i) => add("start-" + (i + 1), "start", ms, { time: ms, value: Model.parseFlight(typed[i]).label }));
  DEMO_PEOPLE.forEach((p, i) => {
    const n = ("0" + (i + 1)).slice(-2);
    const id = DEMO_PREFIX + n;
    const start = starts[p[1] - 1];
    people.push([year, p[0], String(901 + i), typed[p[1] - 1], p[2], id]);
    const erg = demoTenths_(p[3]);
    if (erg === null) return;
    add("erg-" + n, "erg", start + erg * 100 + 90000, { competitor: id, value: String(erg) }); // typed in 90 s after the erg
    const run = demoTenths_(p[4]);
    if (run === null) return;
    const arrival = start + (erg + run) * 100;
    add("in-" + n, "tap", arrival, { time: arrival, station: "entrance" });
    add("in-name-" + n, "name", arrival + 15000, { target: DEMO_PREFIX + "in-" + n, competitor: id });
    const stadium = demoTenths_(p[5]);
    if (stadium === null) return;
    const finish = arrival + stadium * 100;
    add("out-" + n, "tap", finish, { time: finish, station: "exit" });
    add("out-name-" + n, "name", finish + 15000, { target: DEMO_PREFIX + "out-" + n, competitor: id });
  });
  // One time at each stadium station that nobody has named yet.
  add("in-unnamed", "tap", now - 50000, { time: now - 50000, station: "entrance" });
  add("out-unnamed", "tap", now - 20000, { time: now - 20000, station: "exit" });
  events.sort((a, b) => a.created - b.created);
  const rows = events.map((e) => [year, e.id, e.type, e.created, e.time, e.created + 1000, e.competitor, e.value, e.target, e.station, "demo"]);

  let removed;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    removed = removeDemo_();
    const comp = tab(TABS.competitors);
    const c = comp.getLastRow() + 1;
    ensureRows(comp, c + people.length - 1);
    comp.getRange(c, 1, people.length, COMPETITOR_HEADERS.length).setNumberFormat("@").setValues(people);
    const ev = tab(TABS.events);
    const e = ev.getLastRow() + 1;
    ensureRows(ev, e + rows.length - 1);
    ev.getRange(e, 1, rows.length, 3).setNumberFormat("@");
    ev.getRange(e, 7, rows.length, 5).setNumberFormat("@");
    ev.getRange(e, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
    invalidate();
  } finally {
    lock.releaseLock();
  }
  removed.years.concat(removed.years.indexOf(year) < 0 ? [year] : []).forEach((y) => rebuildResults(y, false));
  console.log("Added " + people.length + " made-up people to the " + year + " race, part way through. Run clear to take them out.");
}

function clear() {
  let removed;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    removed = removeDemo_();
  } finally {
    lock.releaseLock();
  }
  removed.years.forEach((y) => rebuildResults(y, false));
  console.log(removed.people || removed.events
    ? "Took out " + removed.people + " made-up people and " + removed.events + " events about them."
    : "There was no demo data to take out.");
}

// "31:12.4" -> 18724 tenths of a second; "" -> null.
function demoTenths_(text) {
  if (!text) return null;
  const parts = text.split(":");
  return Math.round((Number(parts[0]) * 60 + Number(parts[1])) * 10);
}

// Deletes the made-up people and every event about them. The caller holds the lock.
// Returns how many of each went, and the years they were in.
function removeDemo_() {
  const isDemo = (v) => String(v).trim().indexOf(DEMO_PREFIX) === 0;
  const years = Object.create(null);
  let people = 0;
  let events = 0;

  const comp = tab(TABS.competitors);
  const last = comp.getLastRow();
  const rows = last < 2 ? [] : comp.getRange(2, 1, last - 1, COMPETITOR_HEADERS.length).getDisplayValues();
  // From the bottom up, a block of neighbouring rows at a time, so the rows above keep their numbers.
  let i = rows.length - 1;
  while (i >= 0) {
    if (!isDemo(rows[i][5])) { i--; continue; }
    let top = i;
    while (top > 0 && isDemo(rows[top - 1][5])) top--;
    const count = i - top + 1;
    for (let k = top; k <= i; k++) years[String(rows[k][0]).trim()] = true;
    // Sheets won't delete every row under the header, so keep a spare one.
    if (comp.getMaxRows() - count < 2) comp.insertRowsAfter(comp.getMaxRows(), 1);
    comp.deleteRows(top + 2, count);
    people += count;
    i = top - 1;
  }

  const ev = tab(TABS.events);
  const lastEv = ev.getLastRow();
  const all = lastEv < 2 ? [] : ev.getRange(2, 1, lastEv - 1, EVENT_HEADERS.length).getValues();
  // An event goes if it's demo data, is about a made-up person, or changes an event that goes.
  // A stadium time goes with a name that goes. Repeat until nothing more goes.
  const gone = Object.create(null);
  let grew = true;
  while (grew) {
    grew = false;
    all.forEach((r) => {
      const id = String(r[1]);
      const target = String(r[8]);
      if (!(isDemo(id) || isDemo(r[6]) || (target && gone[target]))) return;
      if (!gone[id]) { gone[id] = true; grew = true; }
      if (String(r[2]) === "name" && target && !gone[target]) { gone[target] = true; grew = true; }
    });
  }
  const kept = all.filter((r) => !gone[String(r[1])] && r.some((c) => c !== ""));
  all.forEach((r) => { if (gone[String(r[1])]) { events++; years[String(r[0]).trim()] = true; } });
  if (events) {
    ev.getRange(2, 1, lastEv - 1, EVENT_HEADERS.length).clearContent();
    if (kept.length) {
      ev.getRange(2, 1, kept.length, 3).setNumberFormat("@");
      ev.getRange(2, 7, kept.length, 5).setNumberFormat("@");
      ev.getRange(2, 1, kept.length, EVENT_HEADERS.length).setValues(kept);
    }
  }
  if (people || events) invalidate();
  return { people: people, events: events, years: Object.keys(years).filter((y) => YEAR_PATTERN.test(y)) };
}
