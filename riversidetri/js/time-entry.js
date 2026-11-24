/* The digits-only time field: ghost zeros, printed colon and decimal point, digits fill from the left.
   A real input sits invisibly on top and holds the formatted time for screen readers. */
var TimeEntry = (function () {
  "use strict";
  const layoutFor = (n) => (n > 5 ? "d:dd:dd.d" : "dd:dd.d");
  const digitsOf = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

  function format(d) {
    let out = "";
    let i = 0;
    for (const ch of layoutFor(d.length)) {
      if (i >= d.length) break;
      out += ch === "d" ? d[i++] : ch;
    }
    return out;
  }

  // label and id must already be HTML-escaped.
  function html(id, label, digits, describedBy) {
    return '<div class="time-entry"><input class="time-input" id="' + id + '" inputmode="numeric" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="done" aria-label="' +
      label + '" value="' + format(digitsOf(digits)) + '"' + (describedBy ? ' aria-describedby="' + describedBy + '"' : "") + '><div class="time-display" aria-hidden="true"></div></div>';
  }

  // root is the .time-entry element. Mounting the same element twice returns the first handle.
  function mount(root, opts) {
    if (root.__timeEntry) return root.__timeEntry;
    opts = opts || {};
    const input = root.querySelector(".time-input");
    const display = root.querySelector(".time-display");
    const toEnd = () => input.setSelectionRange(input.value.length, input.value.length);

    function paint() {
      const d = digitsOf(input.value);
      input.value = format(d);
      display.replaceChildren();
      let i = 0;
      let next = null;
      for (const ch of layoutFor(d.length)) {
        const el = document.createElement("span");
        if (ch !== "d") el.textContent = ch;
        else if (i < d.length) el.textContent = d[i++];
        else { el.textContent = "0"; el.className = "ghost"; if (!next) next = el; }
        display.append(el);
      }
      const caret = document.createElement("span");
      caret.className = "caret";
      if (next) next.before(caret); else display.append(caret);
    }

    input.addEventListener("input", () => { paint(); toEnd(); if (opts.onInput) opts.onInput(digitsOf(input.value)); });
    input.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown"].indexOf(e.key) >= 0) e.preventDefault();
      if (e.key === "Enter" && opts.onEnter) { e.preventDefault(); opts.onEnter(); }
      if (e.key === "Escape" && opts.onEscape) { e.preventDefault(); opts.onEscape(); }
    });
    input.addEventListener("focus", () => { toEnd(); requestAnimationFrame(toEnd); });
    input.addEventListener("pointerup", () => requestAnimationFrame(toEnd));
    paint();
    root.__timeEntry = { input: input, digits: () => digitsOf(input.value), focus: () => input.focus() };
    return root.__timeEntry;
  }

  return { html: html, mount: mount, format: format, digitsOf: digitsOf };
})();
if (typeof module !== "undefined" && module.exports) module.exports = TimeEntry;
