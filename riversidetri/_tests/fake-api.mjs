// An in-memory stand-in for the Apps Script web app, for the Playwright tests.
// It checks and stores events the way Code.gs does (checkEvent / writeEvents / doPost).
export const API = "https://fake-api.test/exec";
export const PIN = "0000";

const TYPES = ["start", "erg", "tap", "name", "void"];

export function createFakeApi({ rows }) {
  const api = { rows: rows.map((r, i) => Object.assign({ row: i + 2 }, r)), events: [], down: false, failWrites: false };

  function check(e, known, flights, types) {
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

  api.handle = async (route) => {
    if (api.down) return route.abort("internetdisconnected");
    const reply = (obj) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(obj) });
    let body;
    try { body = JSON.parse(route.request().postData() || ""); } catch { body = null; }
    if (!body || typeof body !== "object") return reply({ ok: false, error: "bad-request", message: "That request couldn't be read." });
    if (String(body.pin || "") !== PIN) return reply({ ok: false, error: "pin", message: "That PIN didn't work. Check it with the race organiser." });
    const serverTime = Date.now();
    const state = () => ({ competitors: api.rows, events: api.events });
    if (body.action === "state") return reply({ ok: true, serverTime, state: state() });
    if (body.action === "write") {
      if (api.failWrites) return reply({ ok: false, error: "server", serverTime, message: "The sheet couldn't do that just now. It will try again." });
      const known = Object.create(null);
      const flights = Object.create(null);
      for (const r of api.rows) {
        if (String(r.id).trim()) known[String(r.id).trim()] = true;
        if (String(r.flight).trim()) flights[String(r.flight).trim()] = true;
      }
      const types = Object.create(null);
      for (const x of api.events) types[x.id] = x.type;
      const received = Date.now();
      const rejected = [];
      for (const e of Array.isArray(body.events) ? body.events : []) {
        if (e && types[e.id]) continue; // already stored: resending is harmless
        const why = check(e, known, flights, types);
        if (why) { rejected.push({ id: e && e.id ? String(e.id) : "", reason: why }); continue; }
        types[e.id] = e.type;
        api.events.push({
          id: e.id, type: e.type, created: e.created, time: typeof e.time === "number" ? e.time : null, received,
          competitor: e.competitor || "", value: e.value === undefined || e.value === null ? "" : String(e.value),
          target: e.target || "", station: e.station || "", device: e.device || "",
        });
      }
      return reply({ ok: true, serverTime, rejected, state: state() });
    }
    return reply({ ok: false, error: "bad-request", message: "The timer asked for something this sheet doesn't do." });
  };
  return api;
}
