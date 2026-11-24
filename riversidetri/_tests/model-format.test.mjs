import test from "node:test";
import assert from "node:assert/strict";
import Model from "../js/model.js";

test("formatTenths shows m:ss.t under an hour and h:mm:ss.t from an hour", () => {
  assert.equal(Model.formatTenths(22960), "38:16.0");
  assert.equal(Model.formatTenths(3032), "5:03.2");
  assert.equal(Model.formatTenths(37360), "1:02:16.0");
  assert.equal(Model.formatTenths(0), "0:00.0");
  assert.equal(Model.formatTenths(null), "");
});

test("formatClock shows a 12-hour local clock, with tenths when asked", () => {
  const t = new Date(2026, 11, 5, 8, 52, 54, 180).getTime();
  assert.equal(Model.formatClock(t, false), "8:52:54");
  assert.equal(Model.formatClock(t, true), "8:52:54.1");
  assert.equal(Model.formatClock(new Date(2026, 11, 5, 13, 5, 0).getTime(), false), "1:05:00");
});

test("parseFlight accepts the ways Sheets shows a time", () => {
  assert.deepEqual(Model.parseFlight("7:15"), { label: "7:15", minutes: 435 });
  assert.deepEqual(Model.parseFlight("07:15:00"), { label: "7:15", minutes: 435 });
  assert.deepEqual(Model.parseFlight("8:10 AM"), { label: "8:10", minutes: 490 });
  assert.equal(Model.parseFlight("8.10"), null);
  assert.equal(Model.parseFlight(""), null);
  assert.equal(Model.parseFlight("7:75"), null);
});

test("parseTimeOfDay reads a clock time on the same local day", () => {
  const base = new Date(2026, 11, 5, 9, 0, 0).getTime();
  assert.equal(Model.parseTimeOfDay("8:14:37", base), new Date(2026, 11, 5, 8, 14, 37).getTime());
  assert.equal(Model.parseTimeOfDay("8:14", base), new Date(2026, 11, 5, 8, 14, 0).getTime());
  assert.equal(Model.parseTimeOfDay("1:05:00", base), new Date(2026, 11, 5, 13, 5, 0).getTime());
  assert.equal(Model.parseTimeOfDay("8:14:61", base), null);
  assert.equal(Model.parseTimeOfDay("soon", base), null);
});

test("durationText and the flight notes read naturally", () => {
  assert.equal(Model.durationText(125000), "2 min 5 s");
  assert.equal(Model.durationText(45000), "45 s");
  assert.equal(Model.durationText(180000), "3 min");
  assert.equal(Model.durationText(3780000), "1 h 3 min");
  const started = { label: "7:15", minutes: 435, start: new Date(2026, 11, 5, 7, 17, 5).getTime() };
  assert.equal(Model.startNote(started), "2 min 5 s after 7:15");
  const waiting = { label: "8:10", minutes: 490, start: null };
  assert.equal(Model.dueNote(waiting, new Date(2026, 11, 5, 8, 13, 20).getTime()), "Due at 8:10, 3 min ago");
  assert.equal(Model.dueNote(waiting, new Date(2026, 11, 5, 8, 0, 0).getTime()), "Due at 8:10");
});

test("ergEntry turns typed digits into tenths", () => {
  assert.deepEqual(Model.ergEntry("38160"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("3816"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("102160"), { tenths: 37360, outside: false });
  assert.deepEqual(Model.ergEntry("25120"), { tenths: 15120, outside: true });
  assert.deepEqual(Model.ergEntry("38:16.0"), { tenths: 22960, outside: false });
  assert.deepEqual(Model.ergEntry("381"), { error: "short" });
  assert.deepEqual(Model.ergEntry("38760"), { error: "range" });
  assert.deepEqual(Model.ergEntry("172160"), { error: "range" });
});

test("tenthsToDigits types a time back in", () => {
  assert.equal(Model.tenthsToDigits(22960), "38160");
  assert.equal(Model.tenthsToDigits(37360), "102160");
  assert.equal(Model.tenthsToDigits(3032), "05032");
});

test("the erg messages are plain sentences", () => {
  assert.equal(Model.ergOutsideMessage(15120), "That's 25:12.0, outside the usual 30 to 70 minutes. Save it anyway?");
  assert.match(Model.ERG_ERRORS.short, /^That time is missing digits\./);
});
