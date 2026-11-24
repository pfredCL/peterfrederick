/* Organiser page (laptop): start flights, see what needs attention, fix anyone's times. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let editing = null;      // competitor id whose row is open
  let editDigits = "";     // what's typed in that row's erg field
  let editMsg = null;
  let confirmVoid = null;  // tap id waiting for a second click on "Delete time"
  let editingStart = null; // flight label whose start time is being changed
  let startMsg = null;
  let undoing = null;      // flight label waiting for "Undo start" to be confirmed
  let entry = null;

  $("race-name").textContent = CONFIG.race.name;
  const store = UI.boot(render, { next: "organiser" });
  if (!store) return;
  render();
  const main = document.querySelector("main");
  main.addEventListener("click", onClick);
  main.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "start-input") saveStart(); });

  function render(force) {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("flights"), UI.loading(store)); return; }
    UI.setHtml($("issues"), issuesHtml(v));
    // Leave an open row alone while someone types in it.
    if (!force && document.activeElement && document.activeElement.closest(".is-editing")) return;
    if (editing && !v.byId[editing]) editing = null;
    UI.setHtml($("flights"), v.flights.length ? v.flights.map((f) => flightHtml(f)).join("") : UI.emptyRoster());
    UI.setHtml($("everyone"), everyoneHtml(v));
    const root = document.querySelector(".edit .time-entry");
    entry = root ? TimeEntry.mount(root, { onInput: (d) => { editDigits = d; }, onEnter: saveErg, onEscape: closeEdit }) : null;
  }

  function flightHtml(f) {
    const people = f.count + (f.count === 1 ? " person" : " people");
    let middle;
    let actions;
    let cls = "flight";
    if (editingStart === f.label) {
      cls += " is-editing";
      middle = '<label class="visually-hidden" for="start-input">Start time for the ' + UI.esc(f.label) + " flight</label>" +
        '<input class="text-input clock-input" id="start-input" autocomplete="off" value="' + (f.start === null ? "" : Model.formatClock(f.start, false)) + '">' +
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
      middle = '<span class="num">Started at ' + Model.formatClock(f.start, false) + "</span><span>" + UI.esc(Model.startNote(f)) + "</span>";
      actions = '<button type="button" class="button" data-start-edit="' + UI.esc(f.label) + '"><span>Change start time</span></button>' +
        '<button type="button" class="link-button" data-undo="' + UI.esc(f.label) + '">Undo start</button>';
    }
    return '<div class="' + cls + '"><div class="stack"><h3>' + UI.esc(f.label) + " flight</h3><span>" + people + '</span></div><div class="stack">' +
      middle + '</div><div class="actions">' + actions + "</div></div>";
  }

  function issuesHtml(v) {
    if (!v.issues.length) return '<p class="empty">Nothing needs attention. Times without names, missing erg times and duplicates show up here.</p>';
    return '<ul class="issues">' + v.issues.map((i) => "<li>" + UI.icon("alert", "icon-16") + "<span>" + UI.esc(i.text) + "</span>" +
      (i.competitor ? '<button type="button" class="link-button" data-fix-person="' + UI.esc(i.competitor) + '">Fix</button>'
        : i.station ? '<a href="' + encodeURIComponent(i.station) + '.html">Open the ' + UI.esc(Model.STATION_NAMES[i.station].toLowerCase()) + "</a>" : "") +
      "</li>").join("") + "</ul>";
  }

  function everyoneHtml(v) {
    const t = (x) => (x === null ? '<span class="pending">–</span>' : Model.formatTenths(x));
    const order = (p) => (p.flightMinutes === null ? 9999 : p.flightMinutes);
    const people = v.people.slice().sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    if (!people.length) return '<tr><td class="l" colspan="8">' + UI.emptyRoster() + "</td></tr>";
    return people.map((p) => "<tr" + (editing === p.id ? ' class="is-open"' : "") + '><td class="rank">' + UI.num(p) + '</td><td class="l">' +
      '<button type="button" class="name-button" data-edit="' + UI.esc(p.id) + '" aria-expanded="' + (editing === p.id) + '">' + UI.esc(p.name) + (p.nontrad ? "*" : "") +
      '</button></td><td class="l">' + UI.esc(p.flight || "–") + '</td><td class="l">' + UI.esc(p.status) + "</td><td>" + t(p.erg) + "</td><td>" + t(p.run) +
      "</td><td>" + t(p.stadium) + '</td><td class="strong">' + t(p.total) + "</td></tr>" + (editing === p.id ? editHtml(p) : "")).join("");
  }

  function editHtml(p) {
    const tapLine = (label, time, tapId) => '<div class="edit-line"><span class="edit-label">' + label + "</span>" + (time === null
      ? '<span class="muted">None recorded</span>'
      : '<span class="num">' + Model.formatClock(time, true) + "</span>" +
        '<button type="button" class="button" data-unname="' + UI.esc(tapId) + '"><span>Remove name</span></button>' +
        (confirmVoid === tapId
          ? '<button type="button" class="button danger" data-void="' + UI.esc(tapId) + '"><span>Click again to delete</span></button>'
          : '<button type="button" class="button danger" data-void-ask="' + UI.esc(tapId) + '"><span>Delete time</span></button>')) + "</div>";
    return '<tr class="edit-row is-editing"><td></td><td colspan="7"><div class="edit">' +
      '<div class="edit-line' + (editMsg ? " has-error" : "") + '"><span class="edit-label">Erg</span>' +
      TimeEntry.html("edit-erg", "Erg time for " + UI.esc(p.name), editDigits, editMsg ? "edit-erg-error" : "") +
      '<button type="button" class="button primary" data-erg-save><span>Save erg time</span></button>' +
      (editMsg ? UI.errorLine(editMsg, "edit-erg-error") : "") + "</div>" +
      tapLine("Arrival", p.arrival, p.arrivalTapId) + tapLine("Finish", p.finish, p.finishTapId) +
      '<div class="edit-line"><button type="button" class="link-button" data-edit-close>Close</button></div></div></td></tr>';
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
    if (id) UI.focus('[data-edit="' + CSS.escape(id) + '"]');
  }

  function saveStart() {
    const f = store.view().flights.find((x) => x.label === editingStart);
    const typed = $("start-input").value;
    const ms = Model.parseTimeOfDay(typed, f.start === null ? store.correctedNow() : f.start);
    if (ms === null) {
      startMsg = "Type the start time like 8:14:37.";
      render(true);
      $("start-input").value = typed;
      UI.focus("#start-input");
      return;
    }
    store.add({ type: "start", value: f.label, time: ms, corrected: true });
    UI.announce("The " + f.label + " flight now starts at " + Model.formatClock(ms, false) + ".");
    editingStart = null;
    startMsg = null;
    render(true);
  }

  function saveErg() {
    const p = store.view().byId[editing];
    const r = Model.ergEntry(editDigits);
    if (r.error) { editMsg = Model.ERG_ERRORS[r.error]; render(true); if (entry) entry.focus(); return; }
    if (r.tenths !== p.erg) store.add({ type: "erg", competitor: p.id, value: r.tenths });
    UI.announce("Saved " + Model.formatTenths(r.tenths) + " for " + p.name + ".");
    editing = null;
    editMsg = null;
    render(true);
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
    } else if (d.startEdit) { editingStart = d.startEdit; startMsg = null; render(true); UI.focus("#start-input"); }
    else if ("startSave" in d) saveStart();
    else if ("startCancel" in d) { editingStart = null; render(true); }
    else if (d.undo) { undoing = d.undo; render(true); UI.focus("[data-undo-yes]"); }
    else if ("undoYes" in d) {
      const f = v.flights.find((x) => x.label === undoing);
      if (f) f.startEventIds.forEach((id) => store.add({ type: "void", target: id }));
      UI.announce("The " + undoing + " flight is back to not started.");
      undoing = null;
      render(true);
    } else if ("undoNo" in d) { undoing = null; render(true); }
    else if (d.edit) openEdit(editing === d.edit ? null : d.edit);
    else if (d.fixPerson) {
      openEdit(d.fixPerson);
      const row = document.querySelector('[data-edit="' + CSS.escape(d.fixPerson) + '"]');
      if (row) row.scrollIntoView({ block: "center" });
    } else if ("ergSave" in d) saveErg();
    else if (d.unname) { store.add({ type: "name", target: d.unname, competitor: "" }); UI.announce("That time is back in Needs a name at the station."); render(true); }
    else if (d.voidAsk) { confirmVoid = d.voidAsk; render(true); UI.focus('[data-void="' + CSS.escape(d.voidAsk) + '"]'); }
    else if (d.void) { store.add({ type: "void", target: d.void }); confirmVoid = null; UI.announce("Deleted."); render(true); }
    else if ("editClose" in d) closeEdit();
  }
})();
