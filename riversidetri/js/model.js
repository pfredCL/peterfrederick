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
