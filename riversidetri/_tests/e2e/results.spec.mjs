import { test, expect, event } from "./fixtures.mjs";

// One finisher's events: erg, then arrival and finish this many seconds after the start.
function finisher(id, erg, arriveS, finishS, k, t0) {
  return [
    event("erg", { competitor: id, value: String(erg) }),
    event("tap", { id: "in-" + k, station: "entrance", time: t0 + arriveS * 1000 }),
    event("name", { target: "in-" + k, competitor: id }),
    event("tap", { id: "out-" + k, station: "exit", time: t0 + finishS * 1000 }),
    event("name", { target: "out-" + k, competitor: id }),
  ];
}

test("results rank finishers and list non-traditional ones separately", async ({ signedIn, api }) => {
  const t0 = Date.now() - 3 * 3600e3;
  api.events.push(
    event("start", { value: "7:15", time: t0 }),
    event("start", { value: "8:10", time: t0 }),
    ...finisher("c0000003", 21267, 4486.2, 5911.8, 1, t0),
    ...finisher("c0000001", 22960, 5186, 7134.4, 2, t0),
    ...finisher("c0000004", 18167, 3760, 5707.4, 3, t0),
  );
  await signedIn.goto("/results.html");
  const overall = signedIn.locator("#overall tbody tr");
  await expect(overall).toHaveCount(2);
  await expect(overall.first()).toContainText("Sam Carter");
  await expect(overall.first()).toContainText("1:38:31.8");
  await expect(signedIn.locator("#nontrad")).toContainText("Blair Nolan*");
  await expect(signedIn.locator("#nontrad")).toContainText("1:35:07.4");
  await expect(signedIn.getByText("* denotes non-traditional tri (not eligible for awards)")).toBeVisible();
  await expect(signedIn.locator("#race-meta")).toHaveText("Saturday 5 December, 3 finishers");
});

test("before anyone finishes, it says so", async ({ signedIn }) => {
  await signedIn.goto("/results.html");
  await expect(signedIn.getByText("No one has finished yet.")).toBeVisible();
  await expect(signedIn.locator("#race-meta")).toHaveText("Saturday 5 December"); // no "0 finishers"
  await expect(signedIn.locator("#nontrad-block")).toBeHidden();
});

test("the results are narrow enough to screenshot for the email, with the crest beside the title", async ({ signedIn }) => {
  await signedIn.goto("/results.html");
  const width = await signedIn.locator(".desk-head").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBe(624);
  const crest = signedIn.locator(".desk-head img.crest");
  await expect(crest).toBeVisible();
  expect((await crest.boundingBox()).height).toBe(56);
});

test("on a phone the results tables scroll sideways rather than squeezing names over times", async ({ signedIn, api }) => {
  const t0 = Date.now() - 3 * 3600e3;
  api.events.push(event("start", { value: "7:15", time: t0 }), ...finisher("c0000003", 21267, 4486.2, 5911.8, 1, t0));
  await signedIn.setViewportSize({ width: 375, height: 812 });
  await signedIn.goto("/results.html");
  const name = signedIn.locator("#overall tbody td.l").first();
  await expect(name).toHaveText("Sam Carter");
  // The name fits in its own column, as wide as on a laptop, and the table scrolls inside its box, not the page.
  expect(await name.evaluate((td) => td.scrollWidth <= td.clientWidth)).toBe(true);
  expect(await signedIn.locator("#overall table").evaluate((t) => t.offsetWidth)).toBe(624);
  expect(await signedIn.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
