/* Where the timer's Apps Script web app lives, and what the race is called. The URL isn't secret: the PIN guards it. */
var CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbxj_Sqegf0cWw-9R9umaDlNT91vKweSeTuSMzrVOSPPSHlfpl1rmlXfy7blKWXi8QSP/exec",
  refreshMs: 5000,
  // Each year, change year and date.
  race: { name: "RBC Tri-Wrathlon", year: 2026, date: "Saturday 5 December" },
};
