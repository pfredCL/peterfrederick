/* Where the timer's Apps Script web app lives, and what the race is called. The URL isn't secret: the PIN guards it. */
var CONFIG = {
  apiUrl: "", // the web app URL, ending in /exec, pasted in after deployment (see _apps-script/README.md)
  refreshMs: 5000,
  race: { name: "RBC Tri-Wrathlon 2026", date: "Saturday 5 December" },
};
