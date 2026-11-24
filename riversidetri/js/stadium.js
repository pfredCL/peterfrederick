/* Stadium entrance and exit: record a time, then tap who it was. One screen; <body data-station> says which. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const station = document.body.dataset.station;
  const AT = station === "entrance" ? "arrival" : "finish";
  const BOUNCE_MS = 300; // a second press this soon is a bounce, not a runner
  let target = null;     // the unnamed time picked to name next; null means the oldest
  let query = "";
  let showAll = false;
  let deleting = null;   // an unnamed time waiting for "Delete" to be confirmed
  let fixing = null;     // { tapId, confirm } for a named time opened in the log
  let moving = null;     // { person, fromTap, fromTime, toTap, toTime }
  let lastPress = 0;

  const store = UI.boot(render);
  if (!store) return;
  store.setStation(station);
  render();

  const tick = () => { $("clock").textContent = Model.formatClock(store.correctedNow(), false); };
  tick();
  setInterval(tick, 250);

  $("record").addEventListener("click", () => {
    const t = store.correctedNow();
    if (t - lastPress < BOUNCE_MS) return;
    lastPress = t;
    store.add({ type: "tap", station: station, time: t });
    UI.announce("Recorded " + Model.formatClock(t, true) + ".");
  });
  $("search").addEventListener("input", (e) => { query = e.target.value; moving = null; render(); });
  document.querySelector("main").addEventListener("click", onClick);

  function currentTarget(v) {
    const unnamed = Model.unnamedTaps(v, station);
    if (target && unnamed.some((t) => t.id === target)) return target;
    return unnamed.length ? unnamed[0].id : null;
  }

  function tapTime(v, id) {
    const t = v.taps[station].find((x) => x.id === id);
    return t ? t.time : null;
  }

  function render() {
    UI.renderStatus(store);
    const v = store.view();
    if (!v) { UI.setHtml($("pool"), UI.loading(store)); return; }
    if (!v.people.length) { UI.setHtml($("pool"), UI.emptyRoster()); return; }
    const tgt = currentTarget(v);
    renderQueue(v, tgt);
    renderPool(v, tgt);
    renderLog(v);
  }

  function renderQueue(v, tgt) {
    const unnamed = Model.unnamedTaps(v, station);
    $("queue-count").textContent = unnamed.length ? String(unnamed.length) : "";
    if (!unnamed.length) { UI.setHtml($("queue"), '<li class="empty-line">No times waiting for a name.</li>'); return; }
    const next = unnamed.find((t) => t.id !== tgt);
    UI.setHtml($("queue"), unnamed.map((t) => {
      const clock = Model.formatClock(t.time, true);
      if (deleting === t.id) {
        return '<li class="stamp-item is-target">' + UI.confirm("Delete " + clock + "? Use this for a press that wasn't a runner.",
          { attr: "data-delete-yes", text: "Delete", danger: true }, { attr: "data-delete-no", text: "Keep it" }) + "</li>";
      }
      const isTarget = t.id === tgt;
      const note = isTarget ? "Tap who it was" : next && t.id === next.id ? "Next" : "Waiting";
      return '<li class="stamp-item' + (isTarget ? " is-target" : "") + '"><button type="button" class="row stamp" data-target="' + UI.esc(t.id) +
        '" aria-pressed="' + isTarget + '"><span class="time">' + clock + '</span><span class="aside-col">' + note + "</span></button>" +
        (isTarget ? '<button type="button" class="link-button" data-delete="' + UI.esc(t.id) + '">Delete</button>' : "") + "</li>";
    }).join(""));
  }

  function renderPool(v, tgt) {
    const c = Model.nameCandidates(v, station);
    const count = c.main.concat(c.extra).reduce((n, g) => n + g.people.length, 0);
    $("pool-count").textContent = count ? String(count) : "";
    const filter = (groups) => groups
      .map((g) => Object.assign({}, g, { people: g.people.filter((p) => UI.matches(p, query)) }))
      .filter((g) => g.people.length);
    const list = (groups, key) => groups.map((g) => '<p class="group-label">' + UI.esc(UI.flightLabel(g)) + '</p><ul class="list">' +
      g.people.map((p) => UI.personRow(p, key + '="' + UI.esc(p.id) + '"' + (tgt ? "" : " disabled"), "")).join("") + "</ul>").join("");
    const main = filter(c.main);
    const extra = filter(c.extra);
    const recorded = query ? filter(Model.groupByFlight(v, v.people.filter((p) => p[AT] !== null))) : [];
    let html = "";
    if (moving) {
      html += UI.confirm(moving.person.name + " already has " + (station === "entrance" ? "an arrival" : "a finish") + " at " +
        Model.formatClock(moving.fromTime, true) + ". Move it to " + Model.formatClock(moving.toTime, true) + "?",
        { attr: "data-move-yes", text: "Move it" }, { attr: "data-move-no", text: "Cancel" });
    }
    if (!tgt) html += '<p class="empty-line">Record a time first, then tap who it was.</p>';
    html += list(main, "data-name");
    if (extra.length) html += '<p class="subsection">Not recorded at the entrance</p>' + list(extra, "data-name");
    if (recorded.length) html += '<p class="subsection">Already recorded here</p>' + list(recorded, "data-recorded");
    if (!main.length && !extra.length && !recorded.length) {
      html += '<p class="empty-line">' + (query ? "No one matches “" + UI.esc(query) + "”."
        : station === "entrance" ? "No one is on the run." : "No one is in the stadium.") + "</p>";
    }
    UI.setHtml($("pool"), html);
  }

  function splitText(t) {
    if (station === "entrance") return t.person.run === null ? "Run waits for the erg time" : "Run " + Model.formatTenths(t.person.run);
    return t.person.stadium === null ? "No arrival recorded" : "Stadium " + Model.formatTenths(t.person.stadium);
  }

  function renderLog(v) {
    const named = Model.namedTaps(v, station);
    $("log-count").textContent = named.length ? String(named.length) : "";
    if (!named.length) {
      UI.setHtml($("log"), '<p class="empty-line">' + (station === "entrance" ? "No arrivals yet." : "No finishes yet.") + "</p>");
      return;
    }
    if (fixing && !named.some((t) => t.id === fixing.tapId)) fixing = null;
    const shown = showAll ? named : named.slice(0, 3);
    let html = '<ul class="list">' + shown.map((t) => {
      const head = '<span class="bib">' + UI.esc(UI.num(t.person)) + '</span><span class="main"><span class="name">' + UI.esc(t.person.name) +
        '</span><span class="sub">' + UI.esc(splitText(t)) + '</span></span><span class="time">' + Model.formatClock(t.time, true) + "</span>";
      if (!fixing || fixing.tapId !== t.id) return '<li><button type="button" class="row" data-fix="' + UI.esc(t.id) + '">' + head + "</button></li>";
      const actions = fixing.confirm
        ? UI.confirm("Delete " + Model.formatClock(t.time, true) + " for " + t.person.name + "? Their " + (station === "entrance" ? "arrival" : "finish") + " will be empty.",
          { attr: "data-void-yes", text: "Delete", danger: true }, { attr: "data-fix-close", text: "Keep it" })
        : '<div class="row-actions"><button type="button" class="button" data-unname><span>Change name</span></button>' +
          '<button type="button" class="button danger" data-void-ask><span>Delete this time</span></button>' +
          '<button type="button" class="link-button" data-fix-close>Cancel</button></div>';
      return '<li><div class="row is-open">' + head + actions + "</div></li>";
    }).join("") + "</ul>";
    if (named.length > 3) html += '<button type="button" class="link-button" data-more>' + (showAll ? "Show the latest 3" : "Show all " + named.length) + "</button>";
    UI.setHtml($("log"), html);
  }

  function clearSearch() { query = ""; $("search").value = ""; }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    const v = store.view();
    if (!v) return;
    const tgt = currentTarget(v);
    if (d.target) { target = d.target; deleting = null; render(); }
    else if (d.delete) { deleting = d.delete; render(); UI.focus("[data-delete-yes]"); }
    else if ("deleteYes" in d) { store.add({ type: "void", target: deleting }); deleting = null; UI.announce("Deleted."); render(); }
    else if ("deleteNo" in d) { deleting = null; render(); }
    else if (d.name && tgt) {
      const p = v.byId[d.name];
      if (!p) return;
      store.add({ type: "name", target: tgt, competitor: p.id });
      UI.announce(p.name + ", " + Model.formatClock(tapTime(v, tgt), true) + ".");
      target = null;
      clearSearch();
      render();
    } else if (d.recorded && tgt) {
      const p = v.byId[d.recorded];
      if (!p) return;
      moving = { person: p, fromTap: p[AT + "TapId"], fromTime: p[AT], toTap: tgt, toTime: tapTime(v, tgt) };
      render();
      UI.focus("[data-move-yes]");
    } else if ("moveYes" in d && moving) {
      store.add({ type: "name", target: moving.fromTap, competitor: "" });
      store.add({ type: "name", target: moving.toTap, competitor: moving.person.id });
      UI.announce("Moved " + moving.person.name + " to " + Model.formatClock(moving.toTime, true) + ".");
      moving = null;
      target = null;
      clearSearch();
      render();
    } else if ("moveNo" in d) { moving = null; render(); }
    else if (d.fix) { fixing = { tapId: d.fix, confirm: false }; render(); }
    else if ("unname" in d && fixing) {
      store.add({ type: "name", target: fixing.tapId, competitor: "" });
      target = fixing.tapId;
      fixing = null;
      UI.announce("That time is back in Needs a name. Tap who it was.");
      render();
    } else if ("voidAsk" in d && fixing) { fixing.confirm = true; render(); UI.focus("[data-void-yes]"); }
    else if ("voidYes" in d && fixing) { store.add({ type: "void", target: fixing.tapId }); fixing = null; UI.announce("Deleted."); render(); }
    else if ("fixClose" in d) { fixing = null; render(); }
    else if ("more" in d) { showAll = !showAll; render(); }
  }
})();
