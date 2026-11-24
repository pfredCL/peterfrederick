/* Start page: choose a station, enter the PIN once. Comes straight back to the station next time. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  $("race-name").textContent = CONFIG.race.name + " " + CONFIG.race.year;
  const PAGES = { erg: "erg.html", entrance: "entrance.html", exit: "exit.html" };
  const NAMES = { erg: "erg", entrance: "stadium entrance", exit: "stadium exit" };
  const DESK = { organiser: "organiser page", results: "results" };
  const params = new URLSearchParams(location.search);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const next = has(DESK, params.get("next")) ? params.get("next") : "";
  const store = Store.create({ url: CONFIG.apiUrl, year: CONFIG.race.year });

  if (!params.has("change") && !params.has("pin") && !next && store.pin && has(PAGES, store.station)) {
    location.replace(PAGES[store.station]);
    return;
  }

  const form = $("start");
  const open = $("open");
  const chosen = () => { const r = form.querySelector("input[name=station]:checked"); return r ? r.value : ""; };
  const label = () => {
    open.querySelector("span").textContent = next ? "Open the " + DESK[next] : chosen() ? "Open " + NAMES[chosen()] : "Open station";
  };
  const pinField = $("pin");
  // Show or clear the error. "where" says what to focus: the PIN field (and mark it invalid) or the first station.
  const showError = (message, where) => {
    const el = $("pin-error");
    el.hidden = !message;
    if (message && where === "pin") pinField.setAttribute("aria-invalid", "true"); else pinField.removeAttribute("aria-invalid");
    el.innerHTML = message ? UI.icon("alert", "icon-16") + "<span>" + UI.esc(message) + "</span>" : "";
    if (message && where === "pin") pinField.focus();
    else if (message && where === "station") form.querySelector("input[name=station]").focus();
  };

  if (next) { $("stations").hidden = true; $("links").hidden = true; }
  else if (has(PAGES, store.station)) form.querySelector('input[value="' + store.station + '"]').checked = true;
  if (params.get("pin") === "changed") showError("The PIN has changed. Enter the new one.");
  if (!CONFIG.apiUrl) showError("The timer isn't connected to its sheet yet.");
  let busy = false;
  label();
  // The PIN field fires "change" on blur, which would hide the error and shift the button mid-tap; clear it on typing instead.
  form.addEventListener("change", (e) => { if (e.target.name === "station") { label(); showError(""); } });
  pinField.addEventListener("input", () => { if (CONFIG.apiUrl) showError(""); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !CONFIG.apiUrl) return;
    const station = chosen();
    const pin = pinField.value.trim();
    if (!next && !station) { showError("Choose your station first.", "station"); return; }
    if (!pin) { showError("Enter the PIN.", "pin"); return; }
    busy = true;
    open.setAttribute("aria-disabled", "true");
    open.querySelector("span").textContent = "Checking…";
    const r = await store.checkPin(pin);
    busy = false;
    open.removeAttribute("aria-disabled");
    label();
    if (!r.ok) {
      showError(r.reason === "pin" ? "That PIN didn't work. Check it with the race organiser." : "Can't reach the sheet. Check your signal and try again.", "pin");
      return;
    }
    if (next) { location.replace(next + ".html"); return; }
    store.setStation(station);
    location.replace(PAGES[station]);
  });
})();
