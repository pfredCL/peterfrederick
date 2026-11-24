import { test, expect, event, started } from "./fixtures.mjs";

test.beforeEach(async ({ api }) => { api.events.push(started("8:10", 40)); });

test("tap a name, type the digits, save: the time moves to Entered", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await expect(field).toBeFocused();
  await field.pressSequentially("3816");
  await expect(signedIn.locator(".time-display")).toHaveText("38:16.0");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#entered")).toContainText("Dana Price");
  await expect(signedIn.locator("#entered")).toContainText("38:16.0");
  await expect(signedIn.locator("#waiting")).not.toContainText("Dana Price");
  await expect(signedIn.locator("#sync")).toHaveText("All saved");
});

test("too few digits keeps Save off, and Enter explains what to type", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await field.pressSequentially("381");
  await expect(signedIn.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await field.press("Enter");
  await expect(signedIn.getByText("That time is missing digits.", { exact: false })).toBeVisible();
});

test("a time outside 30 to 70 minutes asks first", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  await signedIn.getByLabel("Erg time for Dana Price").pressSequentially("25120");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("That's 25:12.0, outside the usual 30 to 70 minutes. Save it anyway?")).toBeVisible();
  await signedIn.getByRole("button", { name: "Save anyway" }).click();
  await expect(signedIn.locator("#entered")).toContainText("25:12.0");
});

test("correcting an entered time asks before replacing it", async ({ signedIn, api }) => {
  api.events.push(event("erg", { competitor: "c0000001", value: "22960" }));
  await signedIn.goto("/erg.html");
  await signedIn.locator("#entered").getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  for (let i = 0; i < 5; i++) await field.press("Backspace");
  await field.pressSequentially("38061");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("Replace 38:16.0 with 38:06.1?")).toBeVisible();
  await signedIn.getByRole("button", { name: "Replace" }).click();
  await expect(signedIn.locator("#entered")).toContainText("38:06.1");
});

test("search finds people by number", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByLabel("Find a rower").fill("22");
  await expect(signedIn.locator("#waiting")).toContainText("Jamie Lowe");
  await expect(signedIn.locator("#waiting")).not.toContainText("Dana Price");
});

test("editing the time while a question shows asks again with the new time", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await field.pressSequentially("25120");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("That's 25:12.0, outside", { exact: false })).toBeVisible();
  await field.focus();
  await expect.poll(() => field.evaluate((e) => e.selectionStart)).toBe(7);
  await field.press("Backspace");
  await field.press("5");
  await expect(signedIn.getByText("outside the usual", { exact: false })).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(signedIn.locator(".time-display")).toHaveText("25:12.5");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.getByText("That's 25:12.5, outside the usual 30 to 70 minutes. Save it anyway?")).toBeVisible();
});

test("a rower removed while their row is open closes the row and says so", async ({ signedIn, api }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  await signedIn.getByLabel("Erg time for Dana Price").pressSequentially("3816");
  api.rows = api.rows.filter((r) => r.id !== "c0000001");
  await signedIn.waitForTimeout(1500);
  const msg = "That person is no longer on the start list, so the time wasn't saved.";
  await expect(signedIn.getByLabel("Erg time for Dana Price")).toHaveCount(0);
  await expect(signedIn.locator("#waiting")).toContainText(msg);
  await expect(signedIn.locator("#waiting")).not.toContainText("Dana Price");
});

test("errors are announced and the field points at its hint or error", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const field = signedIn.getByLabel("Erg time for Dana Price");
  await expect(field).toHaveAttribute("aria-describedby", "open-msg");
  await field.pressSequentially("381");
  await field.press("Enter");
  await expect(signedIn.getByRole("alert")).toContainText("missing digits");
  await expect(signedIn.locator("#open-msg")).toHaveAttribute("role", "alert");
});

test("searching keeps an open row whose person still matches", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  await signedIn.getByLabel("Find a rower").fill("Dana");
  await expect(signedIn.getByLabel("Erg time for Dana Price")).toBeVisible();
  await signedIn.getByLabel("Find a rower").fill("Jamie");
  await expect(signedIn.getByLabel("Erg time for Dana Price")).toHaveCount(0);
});

test("after saving, focus goes to the search box; Cancel names the rower", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  await expect(signedIn.getByRole("button", { name: "Cancel the time for Dana Price" })).toBeVisible();
  await signedIn.getByLabel("Erg time for Dana Price").pressSequentially("3816");
  await signedIn.getByRole("button", { name: "Save", exact: true }).click();
  await expect(signedIn.locator("#search")).toBeFocused();
});

test("a one-person flight says 'All 1 time ... is in.'", async ({ signedIn, api }) => {
  api.events.push(event("erg", { competitor: "c0000003", value: "21267" }), event("erg", { competitor: "c0000004", value: "18167" }));
  await signedIn.goto("/erg.html");
  await expect(signedIn.locator("#erg-status")).toContainText("All 2 times from the 7:15 flight are in.");
  api.rows = api.rows.filter((r) => r.id !== "c0000004");
  api.events = api.events.filter((e) => e.competitor !== "c0000004");
  await expect(signedIn.locator("#erg-status")).toHaveText("All 1 time from the 7:15 flight is in.");
});

test("the open row is tinted, with no bar down its left edge", async ({ signedIn }) => {
  await signedIn.goto("/erg.html");
  await signedIn.getByRole("button", { name: /Dana Price/ }).click();
  const open = signedIn.locator(".row.is-open");
  await expect(open).toBeVisible();
  expect(await open.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
});
