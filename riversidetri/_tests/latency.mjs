// Times the live web app. Run with TW_URL and TW_PIN set in the environment; never commit the PIN.
// TW_YEAR is the race year to ask for (default: this calendar year).
const url = process.env.TW_URL;
const pin = process.env.TW_PIN;
const year = Number(process.env.TW_YEAR) || new Date().getFullYear();
if (!url || !pin) { console.error("Set TW_URL and TW_PIN first."); process.exit(1); }
const times = [];
for (let i = 0; i < 10; i++) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ pin, year, action: "state" }),
  });
  const data = await res.json();
  times.push(Date.now() - t0);
  if (!data.ok) { console.error("The web app said:", data.message); process.exit(1); }
}
console.log("state requests in order (ms):", times.join(", "));
times.sort((a, b) => a - b);
console.log("fastest", times[0], "median", times[5], "slowest", times[9]);
