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
