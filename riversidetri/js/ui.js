/* Shared helpers for the pages: escaping, icons, rows, confirm blocks, the sync status and page start-up. */
var UI = (function () {
  "use strict";
  // Lucide icons, 2px stroke.
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };
  const WHAT = { erg: "An erg time", tap: "A stadium time", name: "A name", start: "A flight start", void: "A deletion" };
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function icon(name, cls) {
    return '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  function esc(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  }

  // Search: part of a name, or the start of a number.
  function matches(p, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    if (/^\d+$/.test(q)) return p.number !== null && p.number !== undefined && String(p.number).indexOf(q) === 0;
    return p.name.toLowerCase().indexOf(q) >= 0;
  }

  function flightLabel(g) {
    return !g.flight ? "No flight set" : g.flight + " flight" + (g.started ? "" : ", not started");
  }

  const num = (p) => (p.number === null || p.number === undefined ? "" : String(p.number));

  // A tappable person row. attrs: extra button attributes. right: HTML for the right-hand column. attrs and right must already be escaped by the caller.
  function personRow(p, attrs, right) {
    return '<li><button type="button" class="row" ' + attrs + '><span class="bib">' + esc(num(p)) + '</span><span class="main"><span class="name">' +
      esc(p.name) + '</span></span><span class="aside-col">' + (right || "") + "</span></button></li>";
  }

  // An inline question with two answers. yes/no: { attr, text, danger }. yes.attr and no.attr must already be escaped by the caller.
  function confirm(message, yes, no) {
    return '<div class="confirm" role="alert"><p>' + esc(message) + '</p><div class="confirm-actions">' +
      '<button type="button" class="button ' + (yes.danger ? "danger" : "primary") + '" ' + yes.attr + "><span>" + esc(yes.text) + "</span></button>" +
      '<button type="button" class="button" ' + no.attr + "><span>" + esc(no.text) + "</span></button></div></div>";
  }

  // id must already be escaped by the caller.
  function errorLine(message, id) {
    return '<p class="row-error"' + (id ? ' id="' + id + '"' : "") + ' role="alert">' + icon("alert", "icon-16") + "<span>" + esc(message) + "</span></p>";
  }

  // Only touch the DOM when the HTML actually changed, so polling doesn't disturb taps or focus.
  function setHtml(el, html) {
    if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; }
  }

  function announce(text) {
    const el = document.getElementById("live");
    if (!el) return;
    el.textContent = "";
    setTimeout(() => { el.textContent = text; }, 50);
  }

  function loading(store) {
    return '<p class="empty-line">' + (store.status().failing
      ? "Can't reach the sheet. Check your signal; this page keeps trying."
      : "Loading the start list…") + "</p>";
  }

  function emptyRoster() {
    return '<p class="empty-line">The start list is empty. Add competitors to the Competitors tab in the Sheet.</p>';
  }

  // Top-bar status (#sync) and the notices strip (#notices), on pages that have them.
  function renderStatus(store) {
    const st = store.status();
    const sync = document.getElementById("sync");
    if (sync) {
      const s = st.failing ? ["sync is-failing", "alert", "Not connected"]
        : st.pending ? ["sync is-waiting", "clock", st.pending + " waiting to send"]
        : ["sync", "check", "All saved"];
      sync.className = s[0];
      setHtml(sync, icon(s[1], "icon-16") + "<span>" + esc(s[2]) + "</span>");
    }
    const box = document.getElementById("notices");
    if (box) {
      let html = st.failing ? '<p class="notice">' + icon("alert", "icon-16") +
        "<span>Can't reach the sheet. Your times are safe on this phone and will send when the connection is back.</span></p>" : "";
      if (st.storageFailing) {
        html += '<p class="notice">' + icon("alert", "icon-16") +
          "<span>This phone can't keep times if the page closes, because its storage is full or blocked. Keep this page open until it says All saved.</span></p>";
      }
      st.rejected.forEach((r, i) => {
        html += '<p class="notice">' + icon("alert", "icon-16") + "<span>" + esc(Object.prototype.hasOwnProperty.call(WHAT, r.event.type) ? WHAT[r.event.type] : "An entry") + " wasn't saved. " +
          esc(r.reason) + '</span><button type="button" class="link-button" data-dismiss="' + i + '">OK</button></p>';
      });
      setHtml(box, html);
    }
  }

  function focus(selector) {
    const el = document.querySelector(selector);
    if (el) el.focus();
  }

  // Page start-up: check config and PIN, wire notices, re-render on every change, start syncing.
  // The start page must not call boot(): it redirects there when there is no PIN.
  // opts.next: "organiser" or "results", so the start page knows where to come back to.
  function boot(render, opts) {
    opts = opts || {};
    if (!window.CONFIG || !CONFIG.apiUrl) {
      const main = document.querySelector("main");
      if (main) main.innerHTML = "<p class=\"empty-line\">The timer isn't connected to its sheet yet.</p>";
      return null;
    }
    const store = Store.create({ url: CONFIG.apiUrl });
    const toStart = (extra) => {
      const q = [opts.next ? "next=" + opts.next : "", extra || ""].filter(Boolean).join("&");
      location.replace("index.html" + (q ? "?" + q : ""));
    };
    if (!store.pin) { toStart(""); return null; }
    const box = document.getElementById("notices");
    if (box) {
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-dismiss]");
        if (b) store.dismissRejected(Number(b.dataset.dismiss));
      });
    }
    store.onChange(() => {
      if (store.status().pinError) { store.forgetPin(); toStart("pin=changed"); return; }
      render();
    });
    store.start(CONFIG.refreshMs || 5000);
    return store;
  }

  return { icon, esc, matches, flightLabel, num, personRow, confirm, errorLine, setHtml, announce, loading, emptyRoster, renderStatus, focus, boot };
})();
if (typeof module !== "undefined" && module.exports) module.exports = UI;
