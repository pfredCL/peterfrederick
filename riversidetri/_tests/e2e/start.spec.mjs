import { test, expect, PIN } from "./fixtures.mjs";

test("a wrong PIN explains; the right one opens the chosen station and is remembered", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByText("Stadium entrance", { exact: true }).click();
  await app.getByLabel("PIN").fill("9999");
  await app.getByRole("button", { name: "Open stadium entrance" }).click();
  await expect(app.getByText("That PIN didn't work. Check it with the race organiser.")).toBeVisible();
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open stadium entrance" }).click();
  await expect(app).toHaveURL(/entrance\.html$/);
  await app.goto("/index.html");
  await expect(app).toHaveURL(/entrance\.html$/);
});

test("it asks for a station before anything else", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open station" }).click();
  await expect(app.getByText("Choose your station first.")).toBeVisible();
});

test("change=1 shows the choices again, with the current station picked", async ({ signedIn }) => {
  await signedIn.addInitScript(() => localStorage.setItem("tw:station", JSON.stringify("exit")));
  await signedIn.goto("/index.html?change=1");
  await expect(signedIn.getByRole("radio", { name: /Stadium exit/ })).toBeChecked();
  await expect(signedIn.getByRole("button", { name: "Open stadium exit" })).toBeVisible();
});

test("?next=organiser hides the station question and labels the button", async ({ app }) => {
  await app.goto("/index.html?next=organiser");
  await expect(app.getByText("Which station are you at?")).toBeHidden();
  await expect(app.getByRole("button", { name: "Open the organiser page" })).toBeVisible();
});

test("?pin=changed asks for the new PIN", async ({ app }) => {
  await app.goto("/index.html?pin=changed");
  await expect(app.getByText("The PIN has changed. Enter the new one.")).toBeVisible();
});

test("a wrong PIN keeps focus on the PIN field, marked invalid, inside an alert", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByText("Stadium entrance", { exact: true }).click();
  await app.getByLabel("PIN").fill("9999");
  await app.getByRole("button", { name: "Open stadium entrance" }).click();
  const msg = app.getByText("That PIN didn't work. Check it with the race organiser.");
  await expect(msg).toBeVisible();
  await expect(app.locator("#pin")).toBeFocused();
  await expect(app.locator("#pin")).toHaveAttribute("aria-invalid", "true");
  await expect(app.locator('[role="alert"] #pin-error')).toBeVisible();
});

test("submitting without a station focuses the first station", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByLabel("PIN").fill(PIN);
  await app.getByRole("button", { name: "Open station" }).click();
  await expect(app.getByRole("radio").first()).toBeFocused();
});

test("?next=constructor is ignored like no next", async ({ app }) => {
  await app.goto("/index.html?next=constructor");
  await expect(app.getByText("Which station are you at?")).toBeVisible();
});

test("the title names the race year, like the organiser and results pages", async ({ app }) => {
  await app.goto("/index.html");
  await expect(app.getByRole("heading", { level: 1 })).toHaveText("RBC Tri-Wrathlon 2026");
});

test("a keyboard press doesn't move a button; a pointer press shows it is pressed", async ({ app }) => {
  await app.goto("/index.html");
  const open = app.getByRole("button", { name: "Open station" });
  await open.focus();
  await app.keyboard.down("Space");
  await app.waitForTimeout(150);
  expect(await open.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await app.keyboard.up("Space");
  // A tapped station choice darkens while pressed, instead of the browser's own tap flash.
  const choice = app.locator(".choice").first();
  const box = await choice.boundingBox();
  const rest = await choice.evaluate((el) => getComputedStyle(el).backgroundColor);
  await app.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await app.mouse.down();
  const pressed = await choice.evaluate((el) => getComputedStyle(el).backgroundColor);
  await app.mouse.up();
  expect(pressed).not.toBe(rest);
  expect(await app.evaluate(() => getComputedStyle(document.documentElement).webkitTapHighlightColor)).toBe("rgba(0, 0, 0, 0)");
});

test("the page is plain white, with the club crest beside the title", async ({ app }) => {
  await app.goto("/index.html");
  expect(await app.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
  const crest = app.locator(".topbar img.crest");
  await expect(crest).toBeVisible();
  await expect(crest).toHaveAttribute("alt", ""); // decorative: the title already names the race
  expect(await crest.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  expect((await crest.boundingBox()).height).toBe(32);
});

test("dark mode uses the white crest", async ({ app }) => {
  await app.emulateMedia({ colorScheme: "dark" });
  await app.goto("/index.html");
  const crest = app.locator(".topbar img.crest");
  await expect.poll(() => crest.evaluate((img) => img.currentSrc)).toMatch(/crest-white\.png$/);
});

test("station choices are just their names, and the PIN has no hint", async ({ app }) => {
  await app.goto("/index.html");
  await expect(app.locator(".choice")).toHaveText(["Erg", "Stadium entrance", "Stadium exit"]);
  await expect(app.locator("#pin-hint")).toHaveCount(0);
  await expect(app.locator("#pin")).toHaveAttribute("aria-describedby", "pin-error");
});

test("a chosen station is tinted, with no bar down its left edge", async ({ app }) => {
  await app.goto("/index.html");
  await app.getByText("Stadium entrance", { exact: true }).click();
  const chosen = app.locator(".choice:has(input:checked)");
  expect(await chosen.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  expect(await chosen.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(232, 237, 247)");
});
