# Tri-Wrathlon timer: Apps Script back end

The web app behind peterfrederick.com/riversidetri. It lives in the race Sheet's Apps Script project.

## Set up once (about 15 minutes)

1. Signed in to the Google account that will own the race Sheet, create a Sheet called "RBC Tri-Wrathlon" (no year: the Sheet keeps every year).
2. Extensions → Apps Script.
3. Replace everything in `Code.gs` with `Code.gs` from this folder.
4. Add a script file (＋ → Script) named `model` and replace its contents with `model.js` from this folder.
5. Project Settings (gear icon) → Script properties → Add script property: name `PIN`, value the race PIN. Save.
   A longer PIN is harder to guess; anyone with the PIN can read and change times.
6. Back in the editor, pick `setup` in the function menu and click Run. Approve Google's permission screen.
   The Sheet now has Competitors, Events and Results tabs and a "Tri-Wrathlon" menu.
   If there is an empty "Sheet1" tab, delete it.
7. Deploy → New deployment → gear → Web app. Execute as: Me. Who has access: Anyone. Deploy, then copy the
   web app URL (it ends in `/exec`). If "Anyone" isn't offered, the account's Workspace admin blocks it:
   use a personal Google account for the Sheet instead.
   To check it worked, open the web app URL in a browser. You should see one line starting "Tri-Wrathlon timer."
8. The URL goes in `riversidetri/js/config.js` as `apiUrl`.

## Filling in Competitors

One row per person per year.

- **Year** is the race year, like 2026. Leave it blank for this year and the timer fills it in. Copying last year's
  rows and changing the Year is fine: the copies get new IDs.
- **Name** is required.
- **Number** is optional, a whole number.
- **Flight** is a time like 7:15 or 8:10.
- **Non-traditional** is Yes or blank.
- Leave the **ID** column alone. The timer fills it in, and if you copy a row it gives the copy its own ID.

Add late entries the same way, even on race day. Phones pick them up within a few seconds.

## After changing Code.gs or model.js

Paste the new files in, then Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
The URL stays the same.

## The Tri-Wrathlon menu

- **Rebuild results** rewrites the Results rows of every year that has events. It leaves other years alone.
- **Clear timing data** asks which year to clear (type it, like 2026), then deletes that year's flight starts, erg times
  and stadium times and rebuilds that year's Results. Competitors and other years stay. Use it after the rehearsal.
  It also stops any phone that still holds that year's rehearsal times from sending them later.
  It does nothing for a year with no events.

## Each new year

1. Add the year's rows to Competitors (copy last year's and change the Year, or add new people and leave the Year blank).
2. In `riversidetri/js/config.js`, change `year` and `date`.
3. Rehearse.
4. Clear timing data for that year, so race day starts empty.

Past years can be typed straight into Results with their Year. The timer never touches a year that has no events.

## If something goes wrong

- If Run says authorisation is required, run `setup` again and approve the permission screen. On "Google hasn't
  verified this app", choose Advanced, then go to the project.
- If the phones say the PIN didn't work, check the script property `PIN` has no spaces.
- If the Events tab is ever deleted or rebuilt, run setup again.
- Only the Sheet's owner can use the Tri-Wrathlon menu, because the Events and Results tabs are protected.
