import { test, expect } from "./fixtures.mjs";

test("the test server serves the app and the test config points at the fake web app", async ({ app }) => {
  const config = await app.goto("/js/config.js");
  expect(await config.text()).toContain("fake-api.test");
  const css = await app.request.get("/css/app.css");
  expect(await css.text()).toContain("@font-face");
});
