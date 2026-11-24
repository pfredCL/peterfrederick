import { test, expect } from "./fixtures.mjs";
import { API, PIN } from "../fake-api.mjs";

test("the test server serves the app and the test config points at the fake web app", async ({ app }) => {
  const config = await app.goto("/js/config.js");
  expect(await config.text()).toContain("fake-api.test");
  const css = await app.request.get("/css/app.css");
  expect(await css.text()).toContain("@font-face");
});

test("the fake web app answers like the real one", async ({ app }) => {
  await app.goto("/css/app.css");
  const post = (body) => app.evaluate(async ({ url, body }) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return r.json();
  }, { url: API, body });

  expect((await post({ pin: "9999", action: "state" })).error).toBe("pin");
  expect(await post({ pin: PIN, action: "state" })).toMatchObject({ ok: false, error: "bad-request", message: "This page is out of date. Reload it." });
  const state = await post({ pin: PIN, year: 2026, action: "state" });
  expect(state.ok).toBe(true);
  expect(state.state.competitors).toHaveLength(4);
  const sent = await post({ pin: PIN, year: 2026, action: "write", events: [{ id: "x1", type: "name", created: 1, target: "nope", competitor: "" }] });
  expect(sent.rejected).toEqual([{ id: "x1", reason: "The time it names isn't in the sheet." }]);
});

test("every page has the crest as its tab icon and home-screen icon", async ({ app }) => {
  await app.goto("/css/app.css");
  for (const page of ["index", "erg", "entrance", "exit", "organiser", "results"]) {
    const html = await (await app.request.get("/" + page + ".html")).text();
    expect(html, page).toContain('<link rel="icon" href="img/icon-32.png" sizes="32x32" type="image/png">');
    expect(html, page).toContain('<link rel="apple-touch-icon" href="img/apple-touch-icon.png">');
  }
  const size = (src) => app.evaluate((src) => new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok([im.naturalWidth, im.naturalHeight]);
    im.onerror = fail;
    im.src = src;
  }), src);
  expect(await size("/img/icon-32.png")).toEqual([32, 32]);
  expect(await size("/img/apple-touch-icon.png")).toEqual([180, 180]);
});
