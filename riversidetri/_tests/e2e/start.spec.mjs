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
