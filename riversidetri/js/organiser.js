/* Organiser page (laptop): start flights, see what needs attention, fix anyone's times. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BIG_START_MS = 15 * 60000; // a start this far from the scheduled time asks first
  const STUCK_MS = 1500;           // a pointer "down" for longer than this is treated as lost
  let editing = null;      // competitor id whose row is open
  let editDigits = "";     // what's typed in that row's erg field
  let editMsg = null;
  let confirmVoid = null;  // tap id waiting for a second click on "Delete time"
  let editingStart = null; // flight label whose start time is being changed
  let startText = "";      // what's typed in the start field, kept across re-renders
  let startMsg = null;
  let startConfirm = null; // ms of a big start change waiting for "Use it"
  let undoing = null;      // flight label waiting for "Undo start" to be confirmed
  let entry = null;
  const pointers = new Set(); // pointerIds down inside main: a re-render must not replace a button under a finger
  let lastDownAt = -Infinity;
  let renderPending = false;
  let flushTimer = null;

  $("race-name").textContent = CONFIG.race.name + " " + CONFIG.race.year;
  const store = UI.boot(render, { next: "organiser" });
  if (!store) return;
  render();
  const main = document.querySelector("main");
  main.addEventListener("click", onClick);
  main.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "start-input") saveStart();
    else if (e.key === "Escape" && editingStart && e.target.closest("#flights")) cancelStart();
    else if (e.key === "Escape" && undoing && e.target.closest("#flights")) keepStart();
  });
  main.addEventListener("input", (e) => { if (e.target.id === "start-input") startText = e.target.value; });
  main.addEventListener("pointerdown", (e) => { pointers.add(e.pointerId); lastDownAt = performance.now(); });
  window.addEventListener("pointerup", released);
  window.addEventListener("pointercancel", released);
  window.addEventListener("contextmenu", clearPointers);
  window.addEventListener("blur", clearPointers);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearPointers(); });

  function fingerDown() { return pointers.size > 0 && performance.now() - lastDownAt < STUCK_MS; }
  // Run the deferred render once: after the page's click handler has run, or after 300 ms, whichever is first.
  function flush() {
    window.removeEventListener("click", onFlushClick);
    clearTimeout(flushTimer);
    flushTimer = null;
    if (renderPending && !fingerDown()) render();
  }
  function onFlushClick() { setTimeout(flush, 0); }
  function afterRelease() {
    if (!renderPending) return;
    window.addEventListener("click", onFlushClick, { once: true });
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 300);
  }
  function released(e) {
    if (!pointers.delete(e.pointerId) || pointers.size) return;
    afterRelease();
  }
  function clearPointers() { if (pointers.size) { pointers.clear(); afterRelease(); } }

  function render(force) {
    UI.renderStatus(store);
    if (!force && fingerDown()) {
      renderPending = true;
      // A pointer that never comes up must not freeze the page: look again once it counts as stale.
      if (!flushTimer) flushTimer = setTimeout(flush, Math.max(0, STUCK_MS - (performance.now() - lastDownAt)) + 20);
      return;
    }
    pointers.clear();
    renderPending = false;
    const v = store.view();
    if (!v) { UI.setHtml($("flights"), UI.loading(store)); return; }
    UI.setHtml($("issues"), issuesHtml(v));
    // Leave a row alone while someone types in it: the Everyone table always, the flights only while a start time is being typed.
    const a = document.activeElement;
    const typingStart = !force && editingStart && a && a.closest("#flights .is-editing");
    const typingErg = !force && a && a.closest("#everyone .is-editing");
    if (editing && !v.byId[editing]) editing = null;
    if (!typingStart) UI.setHtml($("flights"), v.flights.length ? v.flights.map((f) => flightHtml(f)).join("") : UI.emptyRoster());
    if (typingErg) return;
    UI.setHtml($("everyone"), everyoneHtml(v));
    const root = document.querySelector(".edit .time-entry");
    entry = root ? TimeEntry.mount(root, { onInput: (d) => { editDigits = d; }, onEnter: saveErg, onEscape: closeEdit }) : null;
  }

  function flightHtml(f) {
    const people = f.count + (f.count === 1 ? " person" : " people");
    let middle;
    let actions;
    let cls = "flight";
    if (editingStart === f.label && startConfirm !== null) {
      cls += " is-editing";
      middle = UI.confirm("That's " + Model.startNote({ start: startConfirm, minutes: f.minutes, label: f.label }) + ". Use it anyway?",
        { attr: "data-start-use", text: "Use it" }, { attr: "data-start-change", text: "Change it" });
      actions = "";
    } else if (editingStart === f.label) {
      cls += " is-editing";
      middle = '<label class="visually-hidden" for="start-input">Start time for the ' + UI.esc(f.label) + " flight</label>" +
        '<input class="text-input clock-input" id="start-input" autocomplete="off" value="' + UI.esc(startText) + '">' +
        (startMsg ? UI.errorLine(startMsg) : "<span>Like 8:14:37</span>");
      actions = '<button type="button" class="button primary" data-start-save><span>Save</span></button>' +
        '<button type="button" class="button" data-start-cancel><span>Cancel</span></button>';
    } else if (undoing === f.label) {
      middle = "<span>Undo the " + UI.esc(f.label) + " start?</span><span>Times for this flight won't count until it's started again.</span>";
      actions = '<button type="button" class="button danger" data-undo-yes><span>Undo start</span></button>' +
        '<button type="button" class="button" data-undo-no><span>Keep it</span></button>';
    } else if (f.start === null) {
      middle = "<span>Not started</span><span>" + UI.esc(Model.dueNote(f, store.correctedNow())) + "</span>";
      actions = '<button type="button" class="button primary" data-start="' + UI.esc(f.label) + '">' + UI.icon("flag") + "<span>Start " + UI.esc(f.label) + " flight</span></button>";
    } else {
      // How far off the schedule it started, said only when it was off.
      const note = Model.startNote(f);
      middle = '<span class="num">Started at ' + Model.formatClock(f.start, false) + "</span>" +
        (note.indexOf("Right on") === 0 ? "" : "<span>" + UI.esc(note) + "</span>");
      actions = '<button type="button" class="button" data-start-edit="' + UI.esc(f.label) + '"><span>Change start time</span></button>' +
        '<button type="button" class="link-button" data-undo="' + UI.esc(f.label) + '">Undo start</button>';
    }
    return '<div class="' + cls + '" data-flight="' + UI.esc(f.label) + '"><div class="stack"><h3>' + UI.esc(f.label) + " flight</h3><span>" + people + '</span></div><div class="stack">' +
      middle + '</div><div class="actions">' + actions + "</div></div>";
  }

  function issuesHtml(v) {
    if (!v.issues.length) return '<p class="empty">Nothing needs attention.</p>';
    return '<ul class="issues">' + v.issues.map((i) => "<li>" + UI.icon("alert", "icon-16") + "<span>" + UI.esc(i.text) + "</span>" +
      (i.competitor ? '<button type="button" class="link-button" data-fix-person="' + UI.esc(i.competitor) + '"' + (i.kind === "noStart" ? " data-fix-flight" : "") + ">Fix</button>"
        : i.station ? '<a href="' + encodeURIComponent(i.station) + '.html">Open the ' + UI.esc(Model.STATION_NAMES[i.station].toLowerCase()) + "</a>" : "") +
      "</li>").join("") + "</ul>";
  }

  function everyoneHtml(v) {
    // A leg not run yet is blank, except the leg someone is on: whole minutes on it so far.
    const now = store.correctedNow();
    const legFrom = (p) => p.status === "On the erg" ? { col: "erg", from: p.start }
      : p.status === "On the run" ? { col: "run", from: p.start + p.erg * 100 }
      : p.status === "In the stadium" ? { col: "stadium", from: p.arrival } : null;
    const t = (p, col) => {
      if (p[col] !== null) return Model.formatTenths(p[col]);
      const leg = legFrom(p);
      return leg && leg.col === col ? '<span class="pending">' + Math.max(0, Math.floor((now - leg.from) / 60000)) + " min</span>" : "";
    };
    const order = (p) => (p.flightMinutes === null ? 9999 : p.flightMinutes);
    const people = v.people.slice().sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    if (!people.length) return '<tr><td class="l" colspan="8">' + UI.emptyRoster() + "</td></tr>";
    return people.map((p) => "<tr" + (editing === p.id ? ' class="is-open"' : "") + '><td class="rank">' + UI.num(p) + '</td><td class="l">' +
      '<button type="button" class="name-button" data-edit="' + UI.esc(p.id) + '" aria-expanded="' + (editing === p.id) + '">' + UI.esc(p.name) + (p.nontrad ? "*" : "") +
      '</button></td><td class="l">' + UI.esc(p.flight || "–") + '</td><td class="l">' + UI.esc(p.status) + "</td><td>" + t(p, "erg") + "</td><td>" + t(p, "run") +
      "</td><td>" + t(p, "stadium") + '</td><td class="strong">' + t(p, "total") + "</td></tr>" + (editing === p.id ? editHtml(p) : "")).join("");
  }

  function editHtml(p) {
    const tapLine = (label, part, time, tapId) => {
      const clock = time === null ? "" : Model.formatClock(time, true);
      return '<div class="edit-line"><span class="edit-label">' + label + "</span>" + (time === null
        ? '<span class="muted">None recorded</span>'
        : '<span class="num">' + clock + "</span>" +
          '<button type="button" class="button" data-unname="' + UI.esc(tapId) + '" aria-label="' + UI.esc("Remove the name from the " + part + " at " + clock) + '"><span>Remove name</span></button>' +
          (confirmVoid === tapId
            ? '<button type="button" class="button danger" data-void="' + UI.esc(tapId) + '" aria-label="' + UI.esc("Click again to delete the " + part + " time " + clock) + '"><span>Click again to delete</span></button>'
            : '<button type="button" class="button danger" data-void-ask="' + UI.esc(tapId) + '" aria-label="' + UI.esc("Delete the " + part + " time " + clock) + '"><span>Delete time</span></button>')) + "</div>";
    };
    return '<tr class="edit-row is-editing"><td></td><td colspan="7"><div class="edit">' +
      '<div class="edit-line' + (editMsg ? " has-error" : "") + '"><span class="edit-label">Erg</span>' +
      TimeEntry.html("edit-erg", "Erg time for " + UI.esc(p.name), editDigits, editMsg ? "edit-erg-error" : "") +
      '<button type="button" class="button primary" data-erg-save><span>Save erg time</span></button>' +
      (editMsg ? UI.errorLine(editMsg, "edit-erg-error") : "") + "</div>" +
      tapLine("Arrival", "arrival", p.arrival, p.arrivalTapId) + tapLine("Finish", "finish", p.finish, p.finishTapId) +
      '<div class="edit-line"><button type="button" class="link-button" data-edit-close>Close</button></div></div></td></tr>';
  }

  function focusName(id) { UI.focus('[data-edit="' + CSS.escape(id) + '"]'); }
  function focusStartEdit(label) { UI.focus('[data-start-edit="' + CSS.escape(label) + '"]'); }
  // After a change inside the open edit row: its Close button, or the name button if the row has gone.
  function focusEditRow(id) {
    if (document.querySelector("[data-edit-close]")) UI.focus("[data-edit-close]");
    else if (id) focusName(id);
  }

  function openEdit(id) {
    const v = store.view();
    editing = id;
    editMsg = null;
    confirmVoid = null;
    editDigits = id && v.byId[id].erg !== null ? Model.tenthsToDigits(v.byId[id].erg) : "";
    render(true);
    if (entry) entry.focus();
  }

  function closeEdit() {
    const id = editing;
    editing = null;
    render(true);
    if (id) focusName(id);
  }

  function clearStartEdit() {
    editingStart = null;
    startMsg = null;
    startConfirm = null;
    startText = "";
  }

  function cancelStart() {
    const label = editingStart;
    clearStartEdit();
    render(true);
    focusStartEdit(label);
  }

  function keepStart() {
    const label = undoing;
    undoing = null;
    render(true);
    UI.focus('[data-undo="' + CSS.escape(label) + '"]');
  }

  function saveStart() {
    const label = editingStart;
    const f = store.view().flights.find((x) => x.label === label);
    if (!f) {
      UI.announce("That flight or person is no longer in the start list.");
      clearStartEdit();
      render(true);
      return;
    }
    const input = $("start-input");
    const typed = input ? input.value : startText;
    startText = typed;
    const ms = Model.parseTimeOfDay(typed, f.start === null ? store.correctedNow() : f.start);
    if (ms === null) {
      startMsg = "Type the start time like 8:14:37.";
      render(true);
      UI.focus("#start-input");
      return;
    }
    if (Math.abs(ms - Model.atMinutes(ms, f.minutes)) > BIG_START_MS || ms > store.correctedNow()) {
      startConfirm = ms;
      startMsg = null;
      render(true);
      UI.focus("[data-start-use]");
      return;
    }
    commitStart(f, ms);
  }

  function commitStart(f, ms) {
    store.add({ type: "start", value: f.label, time: ms, corrected: true });
    UI.announce("The " + f.label + " flight now starts at " + Model.formatClock(ms, false) + ".");
    clearStartEdit();
    render(true);
    focusStartEdit(f.label);
  }

  function saveErg() {
    const id = editing;
    const p = store.view().byId[id];
    if (!p) {
      UI.announce("That flight or person is no longer in the start list.");
      editing = null;
      editMsg = null;
      render(true);
      return;
    }
    const r = Model.ergEntry(editDigits);
    if (r.error) { editMsg = Model.ERG_ERRORS[r.error]; render(true); if (entry) entry.focus(); return; }
    if (r.tenths !== p.erg) store.add({ type: "erg", competitor: p.id, value: r.tenths });
    UI.announce("Saved " + Model.formatTenths(r.tenths) + " for " + p.name + ".");
    editing = null;
    editMsg = null;
    render(true);
    focusName(id);
  }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    const v = store.view();
    if (!v) return;
    if (d.start) {
      store.add({ type: "start", value: d.start, time: store.correctedNow() });
      UI.announce("Started the " + d.start + " flight.");
      render(true);
      focusStartEdit(d.start);
    } else if (d.startEdit) {
      const f = v.flights.find((x) => x.label === d.startEdit);
      editingStart = d.startEdit;
      startText = f && f.start !== null ? Model.formatClock(f.start, false) : "";
      startMsg = null;
      startConfirm = null;
      render(true);
      UI.focus("#start-input");
    } else if ("startSave" in d) saveStart();
    else if ("startCancel" in d) cancelStart();
    else if ("startUse" in d) {
      const f = v.flights.find((x) => x.label === editingStart);
      const ms = startConfirm;
      if (f && ms !== null) commitStart(f, ms);
      else saveStart();
    } else if ("startChange" in d) {
      startConfirm = null;
      render(true);
      UI.focus("#start-input");
    } else if (d.undo) { undoing = d.undo; render(true); UI.focus("[data-undo-yes]"); }
    else if ("undoYes" in d) {
      const label = undoing;
      const f = v.flights.find((x) => x.label === label);
      if (f) f.startEventIds.forEach((id) => store.add({ type: "void", target: id }));
      UI.announce("The " + label + " flight is back to not started.");
      undoing = null;
      render(true);
      UI.focus('[data-start="' + CSS.escape(label) + '"]');
    } else if ("undoNo" in d) keepStart();
    else if (d.edit) openEdit(editing === d.edit ? null : d.edit);
    else if (d.fixPerson && "fixFlight" in d) {
      const p = v.byId[d.fixPerson];
      const btn = p && p.flight ? document.querySelector('#flights [data-flight="' + CSS.escape(p.flight) + '"] button') : null;
      const target = btn || document.querySelector("main h2");
      if (target) {
        if (!btn) target.setAttribute("tabindex", "-1");
        target.scrollIntoView({ block: "center" });
        target.focus();
      }
    } else if (d.fixPerson) {
      openEdit(d.fixPerson);
      const row = document.querySelector('[data-edit="' + CSS.escape(d.fixPerson) + '"]');
      if (row) row.scrollIntoView({ block: "center" });
    } else if ("ergSave" in d) saveErg();
    else if (d.unname) { store.add({ type: "name", target: d.unname, competitor: "" }); UI.announce("That time is back in Needs a name at the station."); render(true); focusEditRow(editing); }
    else if (d.voidAsk) { confirmVoid = d.voidAsk; render(true); UI.focus('[data-void="' + CSS.escape(d.voidAsk) + '"]'); }
    else if (d.void) { store.add({ type: "void", target: d.void }); confirmVoid = null; UI.announce("Deleted."); render(true); focusEditRow(editing); }
    else if ("editClose" in d) closeEdit();
  }
})();
