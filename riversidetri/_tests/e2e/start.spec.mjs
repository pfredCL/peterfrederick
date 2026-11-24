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
