import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Model from "../js/model.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the Apps Script copy of model.js matches the site's", () => {
  assert.equal(read("../_apps-script/model.js"), read("../js/model.js"),
    "Copy riversidetri/js/model.js over riversidetri/_apps-script/model.js");
});

test("Code.gs only calls Model functions that exist", () => {
  const used = [...read("../_apps-script/Code.gs").matchAll(/Model\.(\w+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  used.forEach((name) => assert.ok(name in Model, "Model." + name + " is missing"));
});
