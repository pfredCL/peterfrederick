import { test, expect, event, started } from "./fixtures.mjs";

test.beforeEach(async ({ api }) => {
  api.events.push(
    started("7:15", 80),
    event("erg", { competitor: "c0000003", value: "21267" }),
    event("erg", { competitor: "c0000004", value: "18167" }),
  );
});

test("record, then tap who it was: the oldest time is named first", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await expect(signedIn.getByText("Record a time first, then tap who it was.")).toBeVisible();
  await expect(signedIn.getByRole("button", { name: /Sam Carter/ })).toBeDisabled();
  const record = signedIn.getByRole("button", { name: "Record arrival" });
  await record.click();
  await signedIn.waitForTimeout(350); // a second press inside 300 ms counts as a bounce
  await record.click();
  const queue = signedIn.locator("#queue");
  await expect(queue.locator(".stamp-item")).toHaveCount(2);
  await expect(queue.locator(".stamp-item").first()).toContainText("Tap who it was");
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await expect(queue.locator(".stamp-item")).toHaveCount(1);
  await expect(signedIn.locator("#log")).toContainText("Sam Carter");
  await signedIn.getByRole("button", { name: /Blair Nolan/ }).click();
  await expect(signedIn.getByText("No times waiting for a name.")).toBeVisible();
  await expect(signedIn.locator("#log")).toContainText("Blair Nolan");
});

test("a press 100 ms after another is ignored and says so", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  const record = signedIn.getByRole("button", { name: "Record arrival" });
  await expect(record).toBeVisible();
  // Two Playwright clicks can land more than 300 ms apart on a slow run, so press twice
  // inside the page, 100 ms apart, where the timing is exact.
  await record.evaluate((b) => new Promise((done) => { b.click(); setTimeout(() => { b.click(); done(); }, 100); }));
  await expect(signedIn.locator("#live")).toHaveText("That was a double press, so only one time was recorded.");
  await expect(signedIn.locator("#queue .stamp-item")).toHaveCount(1);
});

test("before any flight starts, the pool says so", async ({ signedIn, api }) => {
  api.events.length = 0;
  await signedIn.goto("/entrance.html");
  await expect(signedIn.locator("#pool")).toContainText("No flight has started yet. Times you record will wait for names.");
});

test("after naming the last time, focus goes to the Record button", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await expect(signedIn.getByText("No times waiting for a name.")).toBeVisible();
  await expect(signedIn.locator("#record")).toBeFocused();
});

test("searching for someone already recorded offers to move their time", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  const record = signedIn.getByRole("button", { name: "Record arrival" });
  await record.click();
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await signedIn.waitForTimeout(350);
  await record.click();
  await signedIn.locator("#search").fill("Sam");
  await signedIn.locator("#pool [data-recorded]").click();
  await expect(signedIn.locator("#pool .confirm")).toContainText(/Sam Carter already has an arrival at .+\. Move it to .+\?/);
  await expect(signedIn.getByRole("button", { name: "Move it" })).toBeFocused();
});

test("a stray press can be deleted, and a named time can go back to needing a name", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await signedIn.getByRole("button", { name: "Delete", exact: true }).click();
  await signedIn.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(signedIn.getByText("No times waiting for a name.")).toBeVisible();
  await signedIn.waitForTimeout(350); // the deletes take under 300 ms, so this press would count as a bounce
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await signedIn.getByRole("button", { name: /Sam Carter/ }).click();
  await signedIn.locator("#log").getByRole("button", { name: /Sam Carter/ }).click();
  await signedIn.getByRole("button", { name: "Change name" }).click();
  await expect(signedIn.locator("#queue .stamp-item")).toHaveCount(1);
  await expect(signedIn.locator("#pool")).toContainText("Sam Carter");
});

test("the exit lists who is in the stadium, then anyone missed at the entrance", async ({ signedIn, api }) => {
  api.events.push(
    event("tap", { id: "in-1", station: "entrance", time: Date.now() - 30 * 60_000 }),
    event("name", { target: "in-1", competitor: "c0000003" }),
  );
  await signedIn.goto("/exit.html");
  await expect(signedIn.getByRole("heading", { name: "In the stadium" })).toBeVisible();
  await expect(signedIn.locator("#pool")).toContainText("Sam Carter");
  await expect(signedIn.locator("#pool-count")).toHaveText("1"); // only Sam is in the stadium
  await expect(signedIn.getByText("Not recorded at the entrance")).toBeVisible();
  await expect(signedIn.locator("#pool")).toContainText("Blair Nolan");
});

test("with no signal, taps wait on the phone, survive a reload and send when it's back", async ({ signedIn, api }) => {
  await signedIn.goto("/entrance.html");
  await expect(signedIn.locator("#sync")).toHaveText("All saved");
  api.down = true;
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  await expect(signedIn.locator("#sync")).toHaveText("1 waiting to send");
  await signedIn.reload();
  await expect(signedIn.locator("#sync")).toHaveText("1 waiting to send");
  api.down = false;
  await expect(signedIn.locator("#sync")).toHaveText("All saved", { timeout: 15_000 });
  expect(api.events.filter((e) => e.type === "tap")).toHaveLength(1);
});

test("a pointer that never comes up can't freeze the lists", async ({ signedIn, api }) => {
  await signedIn.goto("/entrance.html");
  const name = signedIn.locator("#pool [data-name]").first();
  await name.dispatchEvent("pointerdown", { bubbles: true, pointerId: 7 });
  const when = Date.now() - 1000;
  api.events.push(event("tap", { id: "stuck-1", station: "entrance", time: when }));
  await expect(signedIn.locator("#queue")).toContainText("Tap who it was", { timeout: 3000 });
  await expect(signedIn.locator("#queue .stamp-item")).toHaveCount(1);
});

test("a name row darkens while pressed", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  const row = signedIn.getByRole("button", { name: /Sam Carter/ });
  const rest = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  const box = await row.boundingBox();
  await signedIn.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await signedIn.mouse.down();
  const pressed = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(pressed).not.toBe(rest);
  await signedIn.mouse.up();
});

test("the time waiting for a name is tinted, with no bar down its left edge", async ({ signedIn }) => {
  await signedIn.goto("/entrance.html");
  await signedIn.getByRole("button", { name: "Record arrival" }).click();
  const target = signedIn.locator(".stamp-item.is-target");
  await expect(target).toBeVisible();
  expect(await target.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
});
