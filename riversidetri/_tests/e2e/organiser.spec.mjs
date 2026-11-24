import { test, expect, event, started, PIN } from "./fixtures.mjs";

test("the organiser page asks for the PIN only, then starts a flight", async ({ app, api }) => {
  await app.goto("/organiser.html");
  await expect(app).toHaveURL(/index\.html\?next=organiser$/);
  await expect(app.getByText("Which station are you at?")).toBeHidden();
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open the organiser page" }).click();
  await expect(app).toHaveURL(/organiser\.html$/);
  await app.getByRole("button", { name: "Start 7:15 flight" }).click();
  await expect(app.locator("#flights")).toContainText("Started at");
  await expect.poll(() => api.events.filter((e) => e.type === "start").length).toBe(1);
});

test("a start time can be changed by typing it", async ({ signedIn, api }) => {
  api.events.push(started("7:15", 30));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Change start time" }).click();
  await signedIn.getByLabel("Start time for the 7:15 flight").fill("7:17:05");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#flights")).toContainText("Started at 7:17:05");
  await expect(signedIn.locator("#flights")).toContainText("2 min 5 s after 7:15");
});

test("needs attention lists problems in plain sentences", async ({ signedIn, api }) => {
  api.rows.push({ row: 6, id: "", name: "", number: "9", flight: "8:10", nontrad: "" });
  await signedIn.goto("/organiser.html");
  await expect(signedIn.locator("#issues")).toContainText("Row 6 of Competitors has no name, so it's left out.");
});

test("an erg time can be fixed from the Everyone table", async ({ signedIn, api }) => {
  api.events.push(started("8:10", 50), event("erg", { competitor: "c0000001", value: "22960" }));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Dana Price" }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  for (let i = 0; i < 5; i++) await field.press("Backspace");
  await field.pressSequentially("38061");
  await signedIn.getByRole("button", { name: "Save erg time" }).click();
  await expect(signedIn.locator("#everyone")).toContainText("38:06.1");
});
