/* Erg station: tap a name and its row opens for the time; save. Everything happens on this one screen. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NONE_YET = '<p class="empty-line">No erg times yet.</p>';
  const HINT = "Type the digits only. The colon and decimal point fill in for you.";
  let open = null;  // { id, list: "waiting" | "entered", digits, error, confirm, tenths }
  let entry = null; // the mounted TimeEntry in the open row
  let query = "";
  let showAll = false;
  let notice = ""; // shown at the top of the waiting list until a row is opened again
  const GONE = "That person is no longer on the start list, so the time wasn't saved.";

  const store = UI.boot(render);
  if (!store) return;
  store.setStation("erg");
  render();

  $("search").addEventListener("input", (e) => {
    query = e.target.value;
    if (open && open.list === "waiting") {
      const pp = store.view() && store.view().byId[open.id];
      if (!pp || !UI.matches(pp, query)) open = null;
    }
    render(true);
  });
  document.querySelector("main").addEventListener("click", onClick);

  function render(force) {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("waiting"), UI.loading(store)); UI.setHtml($("entered"), NONE_YET); return; }
    if (!v.people.length) { UI.setHtml($("waiting"), UI.emptyRoster()); UI.setHtml($("entered"), NONE_YET); return; }
    if (open && !v.byId[open.id]) { open = null; force = true; setNotice(); }
    // Don't rebuild the rows under someone's thumb while they type a time.
    if (!force && open && document.activeElement && document.activeElement.closest(".is-open")) return;
    renderWaiting(v);
    renderEntered(v);
    const complete = v.flights.filter((f) => v.people.every((p) => p.flight !== f.label || p.erg !== null));
    UI.setHtml($("erg-status"), complete.map((f) => (f.count === 1 ? "All 1 time from the " + f.label + " flight is in." : "All " + f.count + " times from the " + f.label + " flight are in.")).join(" "));
    mountEntry();
  }

  function setNotice() { notice = GONE; UI.announce(GONE); }

  function renderWaiting(v) {
    const all = Model.waitingForErg(v);
    const total = all.reduce((n, g) => n + g.people.length, 0);
    $("waiting-count").textContent = total ? String(total) : "";
    const groups = all
      .map((g) => Object.assign({}, g, { people: g.people.filter((p) => UI.matches(p, query)) }))
      .filter((g) => g.people.length);
    let html;
    if (!total) html = '<p class="empty-line">Everyone has an erg time.</p>';
    else if (!groups.length) html = '<p class="empty-line">No one waiting matches “' + UI.esc(query) + "”.</p>";
    else {
      html = groups.map((g) => '<p class="group-label">' + UI.esc(UI.flightLabel(g)) + '</p><ul class="list">' +
        g.people.map((p) => (open && open.list === "waiting" && open.id === p.id ? openRow(p) : UI.personRow(p, 'data-open="' + UI.esc(p.id) + '"', ""))).join("") +
        "</ul>").join("");
    }
    UI.setHtml($("waiting"), (notice ? '<p class="empty-line">' + UI.esc(notice) + "</p>" : "") + html);
  }

  function renderEntered(v) {
    const done = Model.ergEntered(v);
    $("entered-count").textContent = done.length ? String(done.length) : "";
    if (!done.length) { UI.setHtml($("entered"), NONE_YET); return; }
    const shown = showAll ? done : done.slice(0, 3);
    let html = '<ul class="list">' + shown.map((p) => (open && open.list === "entered" && open.id === p.id
      ? openRow(p)
      : UI.personRow(p, 'data-fix="' + UI.esc(p.id) + '"', '<span class="time">' + Model.formatTenths(p.erg) + "</span>"))).join("") + "</ul>";
    if (done.length > 3) html += '<button type="button" class="link-button" data-more>' + (showAll ? "Show the latest 3" : "Show all " + done.length) + "</button>";
    UI.setHtml($("entered"), html);
  }

  function openRow(p) {
    let foot;
    if (open.confirm === "outside") {
      foot = UI.confirm(Model.ergOutsideMessage(open.tenths), { attr: 'data-confirm="outside"', text: "Save anyway" }, { attr: "data-change", text: "Change it" });
    } else if (open.confirm === "replace") {
      foot = UI.confirm("Replace " + Model.formatTenths(p.erg) + " with " + Model.formatTenths(open.tenths) + "?",
        { attr: 'data-confirm="replace"', text: "Replace" }, { attr: "data-close", text: "Keep " + Model.formatTenths(p.erg) });
    } else if (open.error) {
      foot = UI.errorLine(open.error, "open-msg");
    } else {
      foot = '<p class="row-hint" id="open-msg">' + HINT + "</p>";
    }
    const disabled = open.confirm || open.digits.length < 4 ? " disabled" : "";
    return '<li><div class="row is-open' + (open.error ? " has-error" : "") + '">' +
      '<span class="bib">' + UI.num(p) + '</span><span class="main"><span class="name">' + UI.esc(p.name) + "</span></span>" +
      '<button type="button" class="link-button" data-close aria-label="Cancel the time for ' + UI.esc(p.name) + '">Cancel</button>' +
      '<div class="row-entry">' + TimeEntry.html("erg-input", "Erg time for " + UI.esc(p.name), open.digits, "open-msg") +
      '<button type="button" class="button primary" data-save' + disabled + "><span>Save</span></button></div>" +
      foot + "</div></li>";
  }

  function mountEntry() {
    const root = document.querySelector(".row.is-open .time-entry");
    entry = root ? TimeEntry.mount(root, {
      onInput: (d) => {
        open.digits = d;
        const row = root.closest(".row");
        row.querySelector("[data-save]").disabled = d.length < 4;
        if (open.confirm) {
          open.confirm = null;
          open.tenths = null;
          render(true);
          if (entry) entry.focus();
          return;
        }
        if (open.error) {
          open.error = null;
          row.classList.remove("has-error");
          row.querySelector("#open-msg").outerHTML = '<p class="row-hint" id="open-msg">' + HINT + "</p>";
        }
      },
      onEnter: () => save(),
      onEscape: close,
    }) : null;
  }

  function openFor(id, list) {
    const p = store.view().byId[id];
    notice = "";
    open = { id: id, list: list, digits: list === "entered" ? Model.tenthsToDigits(p.erg) : "", error: null, confirm: null, tenths: null };
    render(true);
    if (entry) entry.focus();
  }

  function close() {
    const id = open ? open.id : null;
    open = null;
    render(true);
    if (id) UI.focus('[data-open="' + CSS.escape(id) + '"], [data-fix="' + CSS.escape(id) + '"]');
  }

  function save(confirmed) {
    if (!open) return;
    const p = store.view().byId[open.id];
    if (!p) { open = null; setNotice(); render(true); UI.focus("#search"); return; }
    const r = Model.ergEntry(open.digits);
    if (r.error) {
      open.error = Model.ERG_ERRORS[r.error];
      open.confirm = null;
      render(true);
      if (entry) entry.focus();
      return;
    }
    open.tenths = r.tenths;
    if (r.outside && !confirmed) { open.confirm = "outside"; render(true); UI.focus("[data-confirm]"); return; }
    if (p.erg !== null && p.erg !== r.tenths && confirmed !== "replace") { open.confirm = "replace"; render(true); UI.focus("[data-confirm]"); return; }
    if (p.erg !== r.tenths) store.add({ type: "erg", competitor: p.id, value: r.tenths });
    UI.announce("Saved " + Model.formatTenths(r.tenths) + " for " + p.name + ".");
    open = null;
    query = "";
    $("search").value = "";
    render(true);
    UI.focus("#search");
  }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.open) openFor(d.open, "waiting");
    else if (d.fix) openFor(d.fix, "entered");
    else if ("close" in d) close();
    else if ("save" in d) save();
    else if (d.confirm) save(d.confirm);
    else if ("change" in d) { open.confirm = null; render(true); if (entry) entry.focus(); }
    else if ("more" in d) { showAll = !showAll; render(true); }
  }
})();
