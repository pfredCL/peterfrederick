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
  const state = await post({ pin: PIN, action: "state" });
  expect(state.ok).toBe(true);
  expect(state.state.competitors).toHaveLength(4);
  const sent = await post({ pin: PIN, action: "write", events: [{ id: "x1", type: "name", created: 1, target: "nope", competitor: "" }] });
  expect(sent.rejected).toEqual([{ id: "x1", reason: "The time it names isn't in the sheet." }]);
});
