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
