// Copies the two Overpass weights the app uses, and the font licence, from Fontsource into riversidetri/fonts.
import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("./node_modules/@fontsource/overpass/", import.meta.url);
const to = new URL("../fonts/", import.meta.url);
mkdirSync(to, { recursive: true });
for (const weight of [400, 600]) {
  const name = `overpass-latin-${weight}-normal.woff2`;
  copyFileSync(new URL("files/" + name, from), new URL(name, to));
  console.log("copied", name);
}
copyFileSync(new URL("LICENSE", from), new URL("LICENSE.txt", to));
console.log("copied LICENSE.txt");
