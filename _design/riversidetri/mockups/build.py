"""Builds the static Tri-Wrathlon mockups from the 2025 results, with made-up names.

Real: every erg/run/stadium split and total (transcribed from the 2025 leaderboard).
Made up: every name (the repo is public).
Placeholders, because the 2025 sheet doesn't have them: bib numbers (alphabetical by surname),
which flight each person was in (alternating down the leaderboard), and the flights' actual
start times (7:17:05 and 8:14:37). Clock times on the station screens are worked out from those
start times plus the real splits, so every screen agrees with every other.

Run: python build.py   (writes the .html files next to this script)
"""
from pathlib import Path

HERE = Path(__file__).parent

ROWS = """Sam Carter|35:26.7|39:19.5|23:45.6|1:38:31.8
Jordan Hayes|36:31.2|41:44.8|20:39.7|1:38:55.7
Chris Walsh|34:57.1|41:04.9|22:55.3|1:38:57.3
Taylor Brooks|33:39.8|42:28.3|26:10.2|1:42:18.3
Morgan Reed|37:07.5|42:45.2|27:46.9|1:47:39.6
Casey Doyle|37:23.8|46:01.5|27:30.6|1:50:55.9
Riley Grant|35:10.2|46:48.6|35:30.1|1:51:04.3
Jamie Lowe|38:56.8|45:39.8|29:02.6|1:53:39.1
Drew Mason|36:08.8|49:07.4|28:31.7|1:53:47.9
Pat Kelly|36:15.4|48:06.5|31:53.5|1:56:15.4
Robin Shaw|38:44.4|50:35.1|28:54.4|1:58:13.8
Dana Price|38:16.0|48:14.8|32:28.4|1:58:59.2
Avery Cole|38:00.6|51:57.9|31:26.1|2:01:24.5
Quinn Foster|38:43.6|50:41.1|35:30.1|2:04:54.8
Jesse Lane|40:59.7|54:49.4|30:42.6|2:06:31.7
Cameron Ward|37:42.0|59:15.3|30:24.3|2:07:21.6
Reese Hughes|36:39.1|55:47.8|35:38.7|2:08:05.6
Skyler Bell|38:05.4|58:50.6|32:26.6|2:09:22.6
Logan Park|41:35.9|54:17.9|36:49.5|2:12:43.2
Hayden Moss|43:45.2|51:24.9|40:10.2|2:15:20.3
Emerson Clay|42:14.7|55:49.1|40:07.1|2:18:10.7
Rowan Pike|51:29.1|55:02.3|48:19.2|2:34:50.6
Blair Nolan*|30:16.7|32:25.4|32:25.3|1:35:07.4
Devon Hart*|33:58.0|30:24.1|31:34.2|1:35:56.1
Kendall Rios*|34:19.7|39:00.9|34:09.3|1:47:29.9
Parker Stone*|34:13.5|39:07.4|34:33.6|1:47:54.5
Sydney Vale*|34:27.1|39:17.1|37:38.7|1:51:11.9
Finley Ross*|34:26.1|39:17.1|41:35.5|1:55:18.6
Harper Lund*|34:22.4|44:28.8|40:25.3|1:59:16.5
Elliot Shea*|34:20.5|39:26.6|46:19.9|2:00:07.0
Marley Dunn*|37:21.5|57:18.3|31:24.6|2:06:04.4"""


def secs(t):
    parts = t.split(":")
    h = int(parts[0]) if len(parts) == 3 else 0
    return round(h * 3600 + int(parts[-2]) * 60 + float(parts[-1]), 1)


def clock(x, tenths=True):
    t = round(x * 10)
    h, r = divmod(t, 36000)
    m, r = divmod(r, 600)
    s, d = divmod(r, 10)
    return f"{h}:{m:02d}:{s:02d}" + (f".{d}" if tenths else "")


PEOPLE = []
for line in ROWS.splitlines():
    name, erg, run, stadium, total = line.split("|")
    PEOPLE.append(dict(name=name.rstrip("*"), nontrad=name.endswith("*"), erg=erg, run=run, stadium=stadium, total=total))
for bib, p in enumerate(sorted(PEOPLE, key=lambda p: (p["name"].split()[-1], p["name"])), 1):
    p["bib"] = bib
START = {"7:15": secs("7:17:05"), "8:10": secs("8:14:37")}
for i, p in enumerate(PEOPLE):
    p["flight"] = "7:15" if i % 2 == 0 else "8:10"
    p["erg_end"] = START[p["flight"]] + secs(p["erg"])
    p["arrived"] = p["erg_end"] + secs(p["run"])
    p["finished"] = p["arrived"] + secs(p["stadium"])

by_first = lambda p: p["name"]

# Lucide icons, 2px stroke
ICON = {
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "flag": '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
}


def icon(name, cls="icon"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[name]}</svg>')


def page(title, body, wide=False):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · Tri-Wrathlon mockup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="mockup.css">
<!-- Mockup only: #dark or #light in the address forces a theme for screenshots. -->
<script>if (location.hash === "#dark" || location.hash === "#light") document.documentElement.dataset.theme = location.hash.slice(1);</script>
</head>
<body>
{body}
</body>
</html>
"""


def sync(waiting=0):
    if waiting:
        return f'<span class="sync is-waiting">{icon("clock", "icon-16")}<span>{waiting} waiting to send</span></span>'
    return f'<span class="sync">{icon("check", "icon-16")}<span>All saved</span></span>'


def search(label):
    return f'<div class="search">{icon("search")}<input type="search" placeholder="Name or number" aria-label="{label}"></div>'


def person_row(p, cls=""):
    return (f'<li class="row{cls}"><span class="bib">{p["bib"]}</span>'
            f'<span class="main"><span class="name">{p["name"]}</span></span><span></span></li>')


def done_row(p, sub, right):
    sub_html = f'<span class="sub">{sub}</span>' if sub else ""
    return (f'<li class="row"><span class="bib">{p["bib"]}</span>'
            f'<span class="main"><span class="name">{p["name"]}</span>{sub_html}</span>'
            f'<span class="time muted">{right}</span></li>')


def section(title, count, inner, before="", after=""):
    return (f'<section class="section"><div class="section-head"><h2>{title}</h2><span class="count">{count}</span></div>'
            f'{before}<ul class="list">{inner}</ul>{after}</section>')


def dock(what, t):
    return (f'<div class="dock"><button class="record" type="button"><span class="what">{what}</span>'
            f'<span class="clock">{clock(t, tenths=False)}</span></button></div>')


SHOW_RECENT = 3  # the log at the bottom of a station shows the latest few, with a link to the rest


def show_all(total):
    return f'<a class="more" href="#">Show all {total}</a>' if total > SHOW_RECENT else ""


# ---------------------------------------------------------------- start
def start():
    choices = [
        ("Erg", "In the boathouse. Type each rower's time from the monitor.", False),
        ("Stadium entrance", "Where the run ends. Tap as each runner comes in.", True),
        ("Stadium exit", "The finish. Tap as each runner comes out.", False),
    ]
    items = "".join(
        f'<li class="choice{" is-selected" if sel else ""}" role="radio" aria-checked="{"true" if sel else "false"}">'
        f'<span class="radio"></span><span class="choice-text"><span class="choice-name">{n}</span>'
        f'<span class="choice-sub">{d}</span></span></li>' for n, d, sel in choices)
    body = f"""<div class="phone">
  <header class="topbar"><h1>RBC Tri-Wrathlon</h1></header>
  <main class="content">
    <h2 class="page-title">Which station are you at?</h2>
    <ul class="choices" role="radiogroup" aria-label="Station">{items}</ul>
    <div class="field">
      <label for="pin">Station PIN</label>
      <input class="text-input" id="pin" type="password" inputmode="numeric" value="4127" autocomplete="off">
      <span class="hint">Ask the race organiser for it. You only need it once on this phone.</span>
    </div>
    <div class="after-form"><button class="button primary block" type="button"><span>Open stadium entrance</span></button></div>
    <p class="footer-links">Organising? Open the <a href="organiser.html">organiser page</a> or the <a href="results.html">results</a>.</p>
  </main>
</div>"""
    return page("Start", body)


# ---------------------------------------------------------------- erg: tap a name, its row opens for the time
ERG_NOW = secs("8:52:30")
ENTRY_LAG = 60  # a volunteer types the time in about a minute after the rower stops
TIME_FIELD = ('<div class="time-entry is-focus"><div class="time-display" aria-hidden="true">'
              '<span>3</span><span>8</span><span>:</span><span>1</span><span>6</span><span>.</span>'
              '<span class="caret"></span><span class="ghost">0</span></div></div>')


def open_row(p):
    return (f'<li class="row is-open"><span class="bib">{p["bib"]}</span>'
            f'<span class="main"><span class="name">{p["name"]}</span></span><span></span>'
            f'<div class="row-entry">{TIME_FIELD}<button class="button primary" type="button"><span>Save</span></button></div>'
            f'<p class="row-hint">Type the digits only. The colon and decimal point fill in for you.</p></li>')


def erg():
    f810 = [p for p in PEOPLE if p["flight"] == "8:10"]
    entered = sorted([p for p in f810 if p["erg_end"] + ENTRY_LAG <= ERG_NOW], key=lambda p: -p["erg_end"])
    waiting = sorted([p for p in f810 if p["erg_end"] + ENTRY_LAG > ERG_NOW], key=by_first)
    n715 = sum(p["flight"] == "7:15" for p in PEOPLE)
    rows = "".join(open_row(p) if p["name"] == "Dana Price" else person_row(p) for p in waiting)
    log = "".join(done_row(p, "", p["erg"]) for p in entered[:SHOW_RECENT])
    body = f"""<div class="phone">
  <header class="topbar"><h1>Erg</h1>{sync()}</header>
  <main class="content">
    {section("Waiting for a time", f"{len(waiting)} from the 8:10 flight", rows, before=search("Find a rower"))}
    {section("Entered", f"{len(entered)} from the 8:10 flight", log, after=show_all(len(entered)))}
    <p class="status">All {n715} times from the 7:15 flight are in.</p>
  </main>
</div>"""
    return page("Erg", body)


# ---------------------------------------------------------------- stadium: record, then tap who it was
def stamp_row(t, target):
    cls = " is-target" if target else ""
    note = "Tap who it was" if target else "Next"
    return f'<li class="row stamp{cls}"><span class="time">{clock(t)}</span><span class="aside-col">{note}</span></li>'


def name_pool(ps):
    out = ""
    for f in ("7:15", "8:10"):
        group = sorted([p for p in ps if p["flight"] == f], key=by_first)
        if group:
            out += f'<li class="group-label">{f} flight</li>' + "".join(person_row(p) for p in group)
    return out


def stadium(title, now, record, unnamed_n, at, pool_title, pool_of, log_title, log_sub, waiting=0):
    done = sorted([p for p in PEOPLE if p[at] <= now], key=lambda p: p[at])
    unnamed, named = done[-unnamed_n:], done[:-unnamed_n][::-1]
    pool = [p for p in PEOPLE if pool_of(p) or p in unnamed]
    stamps = "".join(stamp_row(p[at], i == 0) for i, p in enumerate(unnamed))
    log = "".join(done_row(p, log_sub(p), clock(p[at])) for p in named[:SHOW_RECENT])
    body = f"""<div class="phone">
  <header class="topbar"><h1>{title}</h1>{sync(waiting)}</header>
  <main class="content">
    {section("Needs a name", len(unnamed), stamps)}
    {section(pool_title, len(pool), name_pool(pool), before=search("Find a runner"))}
    {section(log_title, len(named), log, after=show_all(len(named)))}
  </main>
  {dock(record, now)}
</div>"""
    return page(title, body)


IN_NOW = secs("8:53:10")
OUT_NOW = secs("9:16:00")


def entrance():
    return stadium("Stadium entrance", IN_NOW, "Record arrival", 2, "arrived", "On the run",
                   lambda p: p["erg_end"] <= IN_NOW < p["arrived"], "Arrived", lambda p: f"Run {p['run']}")


def stadium_exit():
    return stadium("Stadium exit", OUT_NOW, "Record finish", 1, "finished", "In the stadium",
                   lambda p: p["arrived"] <= OUT_NOW < p["finished"], "Finished",
                   lambda p: f"Stadium {p['stadium']}", waiting=1)


# ---------------------------------------------------------------- organiser (laptop)
ORG_NOW = secs("8:13:20")


def desk_head(current, extra=""):
    current_attr = ' aria-current="page"'
    nav = "".join(f'<a href="{href}"{current_attr if label == current else ""}>{label}</a>'
                  for label, href in (("Organiser", "organiser.html"), ("Results", "results.html")))
    return (f'<header class="desk-head"><div><h1>RBC Tri-Wrathlon 2026</h1>{extra}</div>'
            f'<div class="meta">{sync() if current == "Organiser" else ""}<nav class="nav" aria-label="Pages">{nav}</nav></div></header>')


def status_at(p, t):
    if START[p["flight"]] > t: return "Not started"
    if p["erg_end"] > t: return "On the erg"
    if p["arrived"] > t: return "On the run"
    if p["finished"] > t: return "In the stadium"
    return "Finished"


def organiser():
    n = {f: sum(p["flight"] == f for p in PEOPLE) for f in ("7:15", "8:10")}
    late = int(START["7:15"] - secs("7:15:00"))
    due = int(ORG_NOW - secs("8:10:00")) // 60
    flights = f"""<div class="flights">
  <div class="flight"><div class="stack"><h3>7:15 flight</h3><span>{n["7:15"]} people</span></div>
    <div class="stack"><span class="num">Started at {clock(START["7:15"], tenths=False)}</span><span>{late // 60} min {late % 60} s after 7:15</span></div>
    <button class="button" type="button"><span>Change start time</span></button></div>
  <div class="flight"><div class="stack"><h3>8:10 flight</h3><span>{n["8:10"]} people</span></div>
    <div class="stack"><span>Not started</span><span>Due at 8:10, {due} min ago</span></div>
    <button class="button primary" type="button">{icon("flag")}<span>Start 8:10 flight</span></button></div>
</div>"""
    rows = ""
    for p in sorted(PEOPLE, key=lambda p: (p["flight"], p["name"])):
        st = status_at(p, ORG_NOW)
        erg_t = p["erg"] if p["erg_end"] + ENTRY_LAG <= ORG_NOW else "–"
        star = "*" if p["nontrad"] else ""
        rows += (f'<tr class="is-clickable"><td class="rank">{p["bib"]}</td><td class="l">{p["name"]}{star}</td>'
                 f'<td class="l">{p["flight"]}</td><td class="l">{st}</td><td>{erg_t}</td>'
                 f'<td class="pending">–</td><td class="pending">–</td><td class="pending">–</td></tr>')
    body = f"""<div class="desk">
  {desk_head("Organiser")}
  <div class="block-head"><h2>Flights</h2><p>Start each flight when it actually starts rowing. The time is taken when you press.</p></div>
  {flights}
  <div class="block-head"><h2>Needs attention</h2></div>
  <p class="empty">Nothing needs attention. Times without names, missing erg times and duplicates show up here.</p>
  <div class="block-head"><h2>Everyone</h2><p>Click a row to fix a time.</p></div>
  <div class="table-scroll"><table class="data">
    <thead><tr><th class="l">#</th><th class="l">Name</th><th class="l">Flight</th><th class="l">Status</th><th>Erg</th><th>Run</th><th>Stadium</th><th>Total</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  <p class="footnote">* denotes non-traditional tri (not eligible for awards)</p>
</div>"""
    return page("Organiser", body, wide=True)


# ---------------------------------------------------------------- results (laptop)
def results():
    def table(ps, star):
        rows = "".join(
            f'<tr><td class="rank">{i}</td><td class="l">{p["name"]}{star}</td><td>{p["erg"]}</td><td>{p["run"]}</td>'
            f'<td>{p["stadium"]}</td><td class="strong">{p["total"]}</td></tr>' for i, p in enumerate(ps, 1))
        return ('<div class="table-scroll"><table class="data fixed"><thead><tr><th class="l">#</th><th class="l">Name</th>'
                f'<th>Erg</th><th>Run</th><th>Stadium</th><th>Total</th></tr></thead><tbody>{rows}</tbody></table></div>')
    trad = sorted([p for p in PEOPLE if not p["nontrad"]], key=lambda p: secs(p["total"]))
    non = sorted([p for p in PEOPLE if p["nontrad"]], key=lambda p: secs(p["total"]))
    body = f"""<div class="desk">
  {desk_head("Results", f'<p class="muted">{len(PEOPLE)} finishers</p>')}
  <div class="block-head"><h2>Overall</h2></div>
  {table(trad, "")}
  <div class="block-head"><h2>Non-traditional</h2></div>
  {table(non, "*")}
  <p class="footnote">* denotes non-traditional tri (not eligible for awards)</p>
</div>"""
    return page("Results", body, wide=True)


SCREENS = {
    "start": start, "erg": erg, "entrance": entrance, "exit": stadium_exit,
    "organiser": organiser, "results": results,
}

if __name__ == "__main__":
    for name, build in SCREENS.items():
        (HERE / f"{name}.html").write_text(build(), encoding="utf-8", newline="\n")
        print("wrote", f"{name}.html")
