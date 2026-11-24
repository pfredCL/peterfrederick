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
