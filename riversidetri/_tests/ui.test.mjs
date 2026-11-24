import test from "node:test";
import assert from "node:assert/strict";
import UI from "../js/ui.js";
import TimeEntry from "../js/time-entry.js";

test("esc makes text safe to put in HTML", () => {
  assert.equal(UI.esc('<b>"Dana" & co</b>'), "&lt;b&gt;&quot;Dana&quot; &amp; co&lt;/b&gt;");
  assert.equal(UI.esc(null), "");
});

test("search matches part of a name, or the start of a number", () => {
  const dana = { name: "Dana Price", number: 8 };
  const jamie = { name: "Jamie Lowe", number: 22 };
  assert.ok(UI.matches(dana, "pri"));
  assert.ok(!UI.matches(jamie, "pri"));
  assert.ok(UI.matches(jamie, "2"));
  assert.ok(UI.matches(jamie, "22"));
  assert.ok(!UI.matches(dana, "2"));
  assert.ok(UI.matches(dana, "  "));
});

test("flight labels say when a flight hasn't started", () => {
  assert.equal(UI.flightLabel({ flight: "7:15", started: true }), "7:15 flight");
  assert.equal(UI.flightLabel({ flight: "8:10", started: false }), "8:10 flight, not started");
  assert.equal(UI.flightLabel({ flight: "", started: false }), "No flight set");
});

test("a person row is one button: number, name, and the right-hand column", () => {
  assert.equal(UI.personRow({ name: "Dana <Price>", number: 8 }, 'data-open="c1"', "38:16.0"),
    '<li><button type="button" class="row" data-open="c1"><span class="bib">8</span><span class="main"><span class="name">Dana &lt;Price&gt;</span></span><span class="aside-col">38:16.0</span></button></li>');
});

test("the time field fills in the punctuation", () => {
  assert.equal(TimeEntry.format("381"), "38:1");
  assert.equal(TimeEntry.format("38160"), "38:16.0");
  assert.equal(TimeEntry.format("102160"), "1:02:16.0");
  assert.equal(TimeEntry.digitsOf("38:16.0x9"), "381609");
});
