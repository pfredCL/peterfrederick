import { test, expect, seedRace } from "./fixtures.mjs";

const PAGES = ["index.html?change=1", "erg.html", "entrance.html", "exit.html", "organiser.html", "results.html"];

for (const scheme of ["light", "dark"]) {
  for (const path of PAGES) {
    test(`screenshot ${path} ${scheme}`, async ({ signedIn, api }, info) => {
      seedRace(api);
      await signedIn.emulateMedia({ colorScheme: scheme });
      await signedIn.goto("/" + path);
      await expect(signedIn.locator("body")).not.toContainText("Loading the start list");
      const name = path.replace(/\.html.*$/, "");
      await signedIn.screenshot({ path: `screenshots/${info.project.name}-${name}-${scheme}.png`, fullPage: true });
    });
  }
}
