# Tri-Wrathlon timer: Apps Script back end

The web app behind peterfrederick.com/riversidetri. It lives in the race Sheet's Apps Script project.

## Set up once (about 15 minutes)

1. Signed in to the Google account that will own the race Sheet, create a Sheet called "RBC Tri-Wrathlon 2026".
2. Extensions → Apps Script.
3. Replace everything in `Code.gs` with `Code.gs` from this folder.
4. Add a script file (＋ → Script) named `model` and replace its contents with `model.js` from this folder.
5. Project Settings (gear icon) → Script properties → Add script property: name `PIN`, value the race PIN. Save.
6. Back in the editor, pick `setup` in the function menu and click Run. Approve Google's permission screen.
   The Sheet now has Competitors, Events and Results tabs and a "Tri-Wrathlon" menu.
7. Deploy → New deployment → gear → Web app. Execute as: Me. Who has access: Anyone. Deploy, then copy the
   web app URL (it ends in `/exec`). If "Anyone" isn't offered, the account's Workspace admin blocks it:
   use a personal Google account for the Sheet instead.
8. The URL goes in `riversidetri/js/config.js` as `apiUrl`.

## After changing Code.gs or model.js

Paste the new files in, then Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
The URL stays the same.

## The Tri-Wrathlon menu

- **Rebuild results** rewrites the Results tab.
- **Clear timing data** deletes every flight start, erg time and stadium time (it asks first). Use it after the rehearsal.
