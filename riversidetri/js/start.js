/* Start page: choose a station, enter the PIN once. Comes straight back to the station next time. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PAGES = { erg: "erg.html", entrance: "entrance.html", exit: "exit.html" };
  const NAMES = { erg: "erg", entrance: "stadium entrance", exit: "stadium exit" };
  const DESK = { organiser: "organiser page", results: "results" };
  const params = new URLSearchParams(location.search);
  const next = DESK[params.get("next")] ? params.get("next") : "";
  const store = Store.create({ url: CONFIG.apiUrl });

  if (!params.has("change") && !params.has("pin") && !next && store.pin && PAGES[store.station]) {
    location.replace(PAGES[store.station]);
    return;
  }

  const form = $("start");
  const open = $("open");
  const chosen = () => { const r = form.querySelector("input[name=station]:checked"); return r ? r.value : ""; };
  const label = () => {
    open.querySelector("span").textContent = next ? "Open the " + DESK[next] : chosen() ? "Open " + NAMES[chosen()] : "Open station";
  };
  const showError = (message) => {
    const el = $("pin-error");
    el.hidden = !message;
    el.innerHTML = message ? UI.icon("alert", "icon-16") + "<span>" + UI.esc(message) + "</span>" : "";
  };

  if (next) { $("stations").hidden = true; $("links").hidden = true; }
  else if (PAGES[store.station]) form.querySelector('input[value="' + store.station + '"]').checked = true;
  if (params.get("pin") === "changed") showError("The PIN has changed. Enter the new one.");
  if (!CONFIG.apiUrl) showError("The timer isn't connected to its sheet yet.");
  label();
  // The PIN field fires "change" on blur, which would hide the error and shift the button mid-tap; clear it on typing instead.
  form.addEventListener("change", (e) => { if (e.target.name === "station") { label(); showError(""); } });
  $("pin").addEventListener("input", () => showError(""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const station = chosen();
    const pin = $("pin").value.trim();
    if (!next && !station) { showError("Choose your station first."); return; }
    if (!pin) { showError("Enter the PIN."); return; }
    open.disabled = true;
    open.querySelector("span").textContent = "Checking…";
    const r = await store.checkPin(pin);
    open.disabled = false;
    label();
    if (!r.ok) {
      showError(r.reason === "pin" ? "That PIN didn't work. Check it with the race organiser." : "Can't reach the timing sheet. Check your signal and try again.");
      return;
    }
    if (next) { location.href = next + ".html"; return; }
    store.setStation(station);
    location.href = PAGES[station];
  });
})();
