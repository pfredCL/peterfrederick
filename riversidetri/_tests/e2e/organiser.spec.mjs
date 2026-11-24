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
  // Early in the morning 7:17 is later than now, which asks first.
  const useIt = signedIn.getByRole("button", { name: "Use it" });
  if (await useIt.isVisible()) await useIt.click();
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

test("a big start-time change asks first", async ({ signedIn, api }) => {
  api.events.push(started("7:15", 30));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Change start time" }).click();
  await signedIn.getByLabel("Start time for the 7:15 flight").fill("7:45:00");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#flights")).toContainText("That's 30 min after 7:15. Use it anyway?");
  await signedIn.getByRole("button", { name: "Change it" }).click();
  await expect(signedIn.getByLabel("Start time for the 7:15 flight")).toHaveValue("7:45:00");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await signedIn.getByRole("button", { name: "Use it" }).click();
  await expect(signedIn.locator("#flights")).toContainText("Started at 7:45:00");
});

test("focus goes to the next sensible control after actions", async ({ signedIn, api }) => {
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Start 7:15 flight" }).click();
  await expect(signedIn.getByRole("button", { name: "Change start time" })).toBeFocused();
  await signedIn.getByRole("button", { name: "Undo start" }).click();
  await signedIn.getByRole("button", { name: "Keep it" }).click();
  await expect(signedIn.getByRole("button", { name: "Undo start" })).toBeFocused();
  await signedIn.getByRole("button", { name: "Undo start" }).click();
  await signedIn.getByRole("button", { name: "Undo start" }).click();
  await expect(signedIn.getByRole("button", { name: "Start 7:15 flight" })).toBeFocused();
});

test("Escape cancels the start field and the undo question", async ({ signedIn, api }) => {
  api.events.push(started("7:15", 30));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Change start time" }).click();
  await signedIn.getByLabel("Start time for the 7:15 flight").press("Escape");
  await expect(signedIn.getByRole("button", { name: "Change start time" })).toBeFocused();
  await signedIn.getByRole("button", { name: "Undo start" }).click();
  await signedIn.keyboard.press("Escape");
  await expect(signedIn.getByRole("button", { name: "Undo start" })).toBeFocused();
  expect(api.events.filter((e) => e.type === "void").length).toBe(0);
});

test("edit-row buttons say which time they act on, and focus stays in the row", async ({ signedIn, api }) => {
  api.events.push(started("8:10", 50), event("tap", { id: "t-in", station: "entrance", time: Date.now() - 600_000 }),
    event("name", { target: "t-in", competitor: "c0000001" }));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Dana Price" }).click();
  await expect(signedIn.getByRole("button", { name: /^Remove the name from the arrival at \d+:\d\d:\d\d\.\d$/ })).toBeVisible();
  await signedIn.getByRole("button", { name: /^Delete the arrival time / }).click();
  const again = signedIn.getByRole("button", { name: /^Click again to delete the arrival time / });
  await expect(again).toBeFocused();
  await again.click();
  await expect(signedIn.getByRole("button", { name: "Close" })).toBeFocused();
  await signedIn.getByLabel("Erg time for Dana Price").pressSequentially("38061");
  await signedIn.getByRole("button", { name: "Save erg time" }).click();
  await expect(signedIn.getByRole("button", { name: "Dana Price" })).toBeFocused();
});

test("typed start text survives a re-render, and flights stay fresh while an erg row is open", async ({ signedIn, api }) => {
  api.events.push(started("7:15", 30));
  await signedIn.goto("/organiser.html");
  await signedIn.getByRole("button", { name: "Change start time" }).click();
  await signedIn.getByLabel("Start time for the 7:15 flight").fill("7:16:30");
  await signedIn.locator("#race-name").click();
  api.events.push(started("8:10", 5));
  await expect(signedIn.locator('[data-flight="8:10"]')).toContainText("Started at");
  await expect(signedIn.getByLabel("Start time for the 7:15 flight")).toHaveValue("7:16:30");
  await signedIn.getByRole("button", { name: "Cancel" }).click();
  await signedIn.getByRole("button", { name: "Dana Price" }).click();
  await signedIn.getByLabel("Erg time for Dana Price").focus();
  api.events.push(started("7:15", 1));
  await expect(signedIn.locator('[data-flight="7:15"]')).toContainText("Started at");
});

test("Fix on a stadium time with no start goes to the flight's button", async ({ signedIn, api }) => {
  api.events.push(event("tap", { id: "t-s", station: "entrance", time: Date.now() - 60_000 }),
    event("name", { target: "t-s", competitor: "c0000001" }));
  await signedIn.goto("/organiser.html");
  await signedIn.locator("#issues").getByRole("button", { name: "Fix" }).first().click();
  await expect(signedIn.getByRole("button", { name: "Start 8:10 flight" })).toBeFocused();
});

test("Everyone shows how long each person has been on their leg, and nothing for legs not run", async ({ signedIn, api }) => {
  const ago = (min) => Date.now() - min * 60_000;
  api.events.push(
    started("7:15", 50),
    started("8:10", 45),
    event("erg", { competitor: "c0000004", value: "18167" }), // Blair: 30:16.7 on the erg, so 19 min on the run
    event("erg", { competitor: "c0000001", value: "18000" }), // Dana: 30:00.0 on the erg
    event("tap", { id: "in-1", station: "entrance", time: ago(3) }),
    event("name", { target: "in-1", competitor: "c0000001" }), // Dana: 3 min in the stadium
  );
  await signedIn.goto("/organiser.html");
  const cells = (name) => signedIn.locator("#everyone tr", { hasText: name }).locator("td");
  // Columns: #, name, flight, status, erg, run, stadium, total
  await expect(cells("Sam Carter").nth(4)).toHaveText("50 min");
  await expect(cells("Blair Nolan").nth(5)).toHaveText("19 min");
  await expect(cells("Dana Price").nth(6)).toHaveText("3 min");
  await expect(cells("Jamie Lowe").nth(4)).toHaveText("45 min");
  for (const name of ["Sam Carter", "Blair Nolan", "Dana Price", "Jamie Lowe"]) {
    await expect(cells(name).nth(7)).toHaveText(""); // no total yet, and no dash
  }
  await expect(cells("Sam Carter").nth(5)).toHaveText("");
  await expect(signedIn.locator("#everyone")).not.toContainText("–");
});

test("the organiser page keeps only the words that help", async ({ signedIn, api }) => {
  const d = new Date();
  d.setHours(7, 15, 0, 0);
  api.events.push(event("start", { value: "7:15", time: d.getTime(), created: d.getTime() }));
  await signedIn.goto("/organiser.html");
  await expect(signedIn.locator("#flights")).toContainText("Started at 7:15:00");
  await expect(signedIn.locator("#flights")).not.toContainText("Right on"); // said only when a start is off
  // On its own, "Started at" keeps the main text style, not the small grey one of the note under it.
  const startedAt = signedIn.locator("#flights .num");
  expect(await startedAt.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
  expect(await startedAt.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(21, 23, 27)");
  await expect(signedIn.locator("main")).not.toContainText("Start each flight when it actually starts rowing");
  await expect(signedIn.locator("main")).not.toContainText("Click a name to fix a time.");
  await expect(signedIn.locator("#issues")).toHaveText("Nothing needs attention.");
});
