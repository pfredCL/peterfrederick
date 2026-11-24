import AxeBuilder from "@axe-core/playwright";
import { test, expect, seedRace } from "./fixtures.mjs";

const PAGES = ["index.html?change=1", "erg.html", "entrance.html", "exit.html", "organiser.html", "results.html"];

for (const path of PAGES) {
  test(`${path} has no serious accessibility problems`, async ({ signedIn, api }) => {
    seedRace(api);
    await signedIn.goto("/" + path);
    await expect(signedIn.locator("body")).not.toContainText("Loading the start list");
    const results = await new AxeBuilder({ page: signedIn }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => v.id + ": " + v.help + " (" + v.nodes.length + ")")).toEqual([]);
  });
}
