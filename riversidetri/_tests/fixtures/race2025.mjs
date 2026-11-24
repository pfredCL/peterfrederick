// The 2025 splits under made-up names (the repo is public). Real: every split. Made up: every name.
// Everyone is put in one flight starting at t0, because the 2025 sheet doesn't say who was in which.
export const RESULTS_2025 = [
  ["Sam Carter", "35:26.7", "39:19.5", "23:45.6", false],
  ["Jordan Hayes", "36:31.2", "41:44.8", "20:39.7", false],
  ["Chris Walsh", "34:57.1", "41:04.9", "22:55.3", false],
  ["Taylor Brooks", "33:39.8", "42:28.3", "26:10.2", false],
  ["Morgan Reed", "37:07.5", "42:45.2", "27:46.9", false],
  ["Casey Doyle", "37:23.8", "46:01.5", "27:30.6", false],
  ["Riley Grant", "35:10.2", "46:48.6", "35:30.1", false],
  ["Jamie Lowe", "38:56.8", "45:39.8", "29:02.6", false],
  ["Drew Mason", "36:08.8", "49:07.4", "28:31.7", false],
  ["Pat Kelly", "36:15.4", "48:06.5", "31:53.5", false],
  ["Robin Shaw", "38:44.4", "50:35.1", "28:54.4", false],
  ["Dana Price", "38:16.0", "48:14.8", "32:28.4", false],
  ["Avery Cole", "38:00.6", "51:57.9", "31:26.1", false],
  ["Quinn Foster", "38:43.6", "50:41.1", "35:30.1", false],
  ["Jesse Lane", "40:59.7", "54:49.4", "30:42.6", false],
  ["Cameron Ward", "37:42.0", "59:15.3", "30:24.3", false],
  ["Reese Hughes", "36:39.1", "55:47.8", "35:38.7", false],
  ["Skyler Bell", "38:05.4", "58:50.6", "32:26.6", false],
  ["Logan Park", "41:35.9", "54:17.9", "36:49.5", false],
  ["Hayden Moss", "43:45.2", "51:24.9", "40:10.2", false],
  ["Emerson Clay", "42:14.7", "55:49.1", "40:07.1", false],
  ["Rowan Pike", "51:29.1", "55:02.3", "48:19.2", false],
  ["Blair Nolan", "30:16.7", "32:25.4", "32:25.3", true],
  ["Devon Hart", "33:58.0", "30:24.1", "31:34.2", true],
  ["Kendall Rios", "34:19.7", "39:00.9", "34:09.3", true],
  ["Parker Stone", "34:13.5", "39:07.4", "34:33.6", true],
  ["Sydney Vale", "34:27.1", "39:17.1", "37:38.7", true],
  ["Finley Ross", "34:26.1", "39:17.1", "41:35.5", true],
  ["Harper Lund", "34:22.4", "44:28.8", "40:25.3", true],
  ["Elliot Shea", "34:20.5", "39:26.6", "46:19.9", true],
  ["Marley Dunn", "37:21.5", "57:18.3", "31:24.6", true],
];

export const tenths = (s) => {
  const [m, rest] = s.split(":");
  return Number(m) * 600 + Math.round(Number(rest) * 10);
};

const event = (id, type, at, extra) => Object.assign(
  { id, type, created: at, time: null, received: at, competitor: "", value: "", target: "", station: "", device: "fixture" }, extra);

// Competitor rows and events that replay the 2025 race exactly.
export function race2025(t0 = new Date(2026, 11, 5, 7, 17, 5).getTime()) {
  const rows = [];
  const events = [event("start-715", "start", t0, { value: "7:15", time: t0 })];
  RESULTS_2025.forEach(([name, erg, run, stadium, nontrad], i) => {
    const id = "c" + String(i + 1).padStart(7, "0");
    rows.push({ row: i + 2, id, name, number: String(i + 1), flight: "7:15", nontrad: nontrad ? "Yes" : "" });
    const e = tenths(erg);
    const arrival = t0 + (e + tenths(run)) * 100;
    const finish = arrival + tenths(stadium) * 100;
    events.push(
      event("erg-" + id, "erg", t0 + e * 100, { competitor: id, value: String(e) }),
      event("in-" + id, "tap", arrival, { station: "entrance", time: arrival }),
      event("in-name-" + id, "name", arrival + 1, { target: "in-" + id, competitor: id }),
      event("out-" + id, "tap", finish, { station: "exit", time: finish }),
      event("out-name-" + id, "name", finish + 1, { target: "out-" + id, competitor: id }),
    );
  });
  return { rows, events, t0 };
}
