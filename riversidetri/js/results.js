/* Results page (laptop): finishers ranked, non-traditional listed separately. Built to be screenshotted for the email. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  $("race-name").textContent = CONFIG.race.name;
  document.title = CONFIG.race.name + " results";
  const store = UI.boot(render, { next: "results" });
  if (!store) return;
  render();

  function table(rows, star) {
    return '<div class="table-scroll"><table class="data fixed"><thead><tr><th class="l">#</th><th class="l">Name</th><th>Erg</th><th>Run</th>' +
      "<th>Stadium</th><th>Total</th></tr></thead><tbody>" +
      rows.map((r) => '<tr><td class="rank">' + UI.esc(r.place) + '</td><td class="l">' + UI.esc(r.person.name) + star + "</td><td>" +
        UI.esc(Model.formatTenths(r.person.erg)) + "</td><td>" + UI.esc(Model.formatTenths(r.person.run)) + "</td><td>" + UI.esc(Model.formatTenths(r.person.stadium)) +
        '</td><td class="strong">' + UI.esc(Model.formatTenths(r.person.total)) + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  function render() {
    const v = store.view();
    if (!v) { UI.setHtml($("overall"), UI.loading(store)); return; }
    const r = Model.rank(v.people);
    const n = r.overall.length + r.nontrad.length;
    $("race-meta").textContent = CONFIG.race.date + ", " + n + (n === 1 ? " finisher" : " finishers");
    UI.setHtml($("overall"), r.overall.length ? table(r.overall, "") : '<p class="empty">No one has finished yet.</p>');
    $("nontrad-block").hidden = !r.nontrad.length;
    UI.setHtml($("nontrad"), r.nontrad.length ? table(r.nontrad, "*") : "");
  }
})();
