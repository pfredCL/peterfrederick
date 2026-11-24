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
  // A number, or null when the value is missing or isn't one (so "abc" never turns into NaN).
  const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return isFinite(n) ? n : null; };
  const joinAnd = (list) => list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
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

  const isYes = (v) => /^(y|yes|true|x|1|✓)$/i.test(text(v).trim());

  // Rows from the Competitors tab, as display text ({ row, name, number, flight, nontrad, id }),
  // -> the competitors the timer can use, plus plain-sentence issues for the rows it can't.
  function normaliseRoster(rows) {
    const competitors = [];
    const issues = [];
    const rowsByNumber = Object.create(null);
    (rows || []).forEach((r) => {
      const name = text(r.name).trim();
      const numberText = text(r.number).trim();
      const flightText = text(r.flight).trim();
      if (!name && !numberText && !flightText) return;
      if (!name) {
        issues.push(issue("roster", "Row " + r.row + " of Competitors has no name, so it's left out. Add a name or clear the row."));
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
          (flightText ? '"' + flightText + "\" as its flight. Type it as a time, like 8:10." : "no flight. Type one, like 8:10.")));
      }
      if (number !== null) (rowsByNumber[number] = rowsByNumber[number] || []).push(r.row);
      competitors.push({
        id: text(r.id).trim(), row: r.row, name: name, number: number,
        flight: flight ? flight.label : "", flightMinutes: flight ? flight.minutes : null, nontrad: isYes(r.nontrad),
      });
    });
    Object.keys(rowsByNumber).forEach((n) => {
      if (rowsByNumber[n].length > 1) {
        issues.push(issue("roster", "Number " + n + " is used more than once in Competitors (rows " + joinAnd(rowsByNumber[n]) + "). Give each person their own number."));
      }
    });
    return { competitors: competitors, issues: issues };
  }

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
    const voided = Object.create(null);
    list.forEach((e) => { if (e.type === "void" && e.target) voided[e.target] = true; });
    const out = { starts: Object.create(null), startIds: Object.create(null), ergs: Object.create(null), taps: [], names: Object.create(null) };
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

  // ---- The race ----

  // Competitors (from normaliseRoster) + events -> everything the screens show.
  function compute(competitors, events, now) {
    const r = resolve(events);
    const byId = Object.create(null);
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

    const flightMap = Object.create(null);
    competitors.forEach((c) => {
      if (!c.flight) return;
      if (!flightMap[c.flight]) flightMap[c.flight] = { label: c.flight, minutes: c.flightMinutes, count: 0, start: null, startEventId: null, startEventIds: [] };
      flightMap[c.flight].count++;
    });
    const flights = Object.keys(flightMap).map((k) => flightMap[k]).sort((a, b) => a.minutes - b.minutes);
    flights.forEach((f) => {
      const s = r.starts[f.label];
      if (s && has(num(s.time))) { f.start = num(s.time); f.startEventId = s.id; f.startEventIds = r.startIds[f.label]; }
    });

    Object.keys(r.ergs).forEach((cid) => {
      const e = r.ergs[cid];
      const erg = num(e.value);
      if (byId[cid]) { byId[cid].erg = erg; byId[cid].ergCreated = erg === null ? null : e.created; }
      else if (erg !== null) issues.push(issue("orphan", "An erg time of " + formatTenths(erg) + " belongs to someone no longer in Competitors, so it's left out. Add them back to Competitors if that was a mistake."));
    });

    const taps = Object.create(null);
    STATIONS.forEach((st) => { taps[st] = []; });
    r.taps.forEach((t) => {
      if (!taps[t.station] || num(t.time) === null) return;
      const n = r.names[t.id];
      const cid = n && n.competitor && byId[n.competitor] ? n.competitor : "";
      if (n && n.competitor && !cid) {
        issues.push(issue("orphan", "A " + STATION_NAMES[t.station].toLowerCase() + " time, " + formatClock(num(t.time), true) +
          ", was named for someone no longer in Competitors. Name it again at the " + STATION_NAMES[t.station].toLowerCase() + ".", { station: t.station }));
      }
      taps[t.station].push({ id: t.id, station: t.station, time: num(t.time), competitor: cid });
    });

    STATIONS.forEach((st) => {
      const key = st === "entrance" ? "arrival" : "finish";
      const seen = Object.create(null);
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
          " times (" + list.map((t) => formatClock(t.time, true)).join(", ") + "). The earliest counts until you change the name on the wrong one.", { competitor: cid, station: st }));
      });
      const unnamed = taps[st].filter((t) => !t.competitor && now - t.time > UNNAMED_AFTER_MS);
      if (unnamed.length) {
        issues.push(issue("unnamed", STATION_NAMES[st] + " has " + (unnamed.length === 1 ? "a time" : unnamed.length + " times") +
          " without a name, the oldest from " + formatClock(unnamed[0].time, true) + ". Ask the " + STATION_NAMES[st].toLowerCase() +
          " volunteer to tap who it was.", { station: st }));
      }
    });

    const startOf = Object.create(null);
    flights.forEach((f) => { startOf[f.label] = f.start; });
    people.forEach((p) => {
      p.start = has(startOf[p.flight]) ? startOf[p.flight] : null;
      // Rounding rule: arrival and finish become tenths after the start first, so the row adds up exactly.
      const A = has(p.start) && has(p.arrival) ? Math.round((p.arrival - p.start) / 100) : null;
      const F = has(p.start) && has(p.finish) ? Math.round((p.finish - p.start) / 100) : null;
      if (has(A) && has(p.erg)) p.run = A - p.erg;
      if (has(p.arrival) && has(p.finish)) p.stadium = has(A) && has(F) ? F - A : Math.round((p.finish - p.arrival) / 100);
      if (has(p.run) && p.run > 0 && has(p.stadium) && p.stadium > 0 && has(F)) p.total = F;
      p.status = has(p.finish) ? "Finished" : has(p.arrival) ? "In the stadium" : !has(p.start) ? "Not started" : has(p.erg) ? "On the run" : "On the erg";

      const who = { competitor: p.id };
      if (p.flight && !has(p.start) && (has(p.arrival) || has(p.finish))) {
        issues.push(issue("noStart", p.name + " has a stadium time but the " + p.flight + " flight hasn't been started. Start it, or set its start time, under Flights.", who));
      }
      if (has(p.arrival) && !has(p.erg)) issues.push(issue("ergMissing", p.name + " has arrived at the stadium but has no erg time. Add it on the erg screen or in Everyone below.", who));
      if (has(p.finish) && !has(p.arrival)) issues.push(issue("arrivalMissing", p.name + " has finished but has no stadium arrival. Name their arrival at the stadium entrance.", who));
      if (has(p.run) && p.run <= 0) {
        issues.push(issue("run", p.name + "'s arrival is before the end of their erg. Check the erg time, the arrival and the flight's start time.", who));
      } else if (has(p.run) && (p.run < RUN_MIN || p.run > RUN_MAX)) {
        issues.push(issue("run", p.name + "'s run of " + formatTenths(p.run) + " is " + (p.run < RUN_MIN ? "under 20 minutes" : "over 2 hours") +
          ". Check the erg time and the arrival.", who));
      }
      if (has(p.stadium) && p.stadium <= 0) {
        issues.push(issue("stadium", p.name + "'s finish is before their arrival. The names on those two stadium times may be swapped, so check them.", who));
      } else if (has(p.stadium) && (p.stadium < STADIUM_MIN || p.stadium > STADIUM_MAX)) {
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

  return {
    ERG_ERRORS, STATION_NAMES,
    formatTenths, formatClock, parseFlight, atMinutes, parseTimeOfDay, durationText, startNote, dueNote,
    ergEntry, tenthsToDigits, ergOutsideMessage,
    normaliseRoster, resolve, compute, buildView, rank,
    groupByFlight, waitingForErg, ergEntered, nameCandidates, unnamedTaps, namedTaps, bestOffset,
  };

})();
if (typeof module !== "undefined" && module.exports) module.exports = Model;
