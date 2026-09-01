# Observing Schedules

A small static site for keeping a public log of upcoming telescope observations — telescope, project, and time in UTC — with a calendar view, a live UTC clock, a countdown to your next observation, and a full sortable log.

No backend, no build step: it's plain HTML/CSS/JS plus one JSON file, so it's a perfect fit for GitHub Pages.

## What's in here

```
index.html          the page
style.css            styling
app.js               calendar rendering, clock, countdown, add-observation form
observations.json    your schedule — this is the only file you'll edit regularly
.nojekyll            tells GitHub Pages to serve files as-is
README.md            this file
```

## 1. Put this on GitHub

1. Create a new repository named `Observing-Schedules` (or any name you like) on GitHub.
2. Upload all the files in this folder to the repository (or `git init`, `git add .`, `git commit`, `git push` if you're using git locally).
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick the `main` branch and the `/ (root)` folder, then save.
5. GitHub will give you a URL, usually:
   ```
   https://<your-username>.github.io/Observing-Schedules/
   ```
   It can take a minute or two to go live the first time.

If instead you name the repository `<your-username>.github.io` exactly, GitHub will publish it at the root of your GitHub Pages domain instead of a subpath — either works with the files as they are.

## 2. Add your own observations

Open `observations.json`. It's an array of objects like this:

```json
{
  "id": "2026-09-14-keck-quasar",
  "telescope": "Keck II",
  "project": "High-z quasar spectroscopy",
  "start": "2026-09-14T05:00:00Z",
  "end": "2026-09-14T13:00:00Z",
  "notes": "Optional — anything worth remembering"
}
```

- `start` and `end` must be in UTC, in ISO 8601 format (the trailing `Z` means UTC). `end` can be left as `""` if you don't know it yet.
- `id` just needs to be unique — it's not shown anywhere.
- Delete the sample entries once you've got real ones in there.

You can hand-edit this file directly in GitHub's web UI (click the file, click the pencil icon, edit, commit), or edit it locally and push.

### Using the in-page form

Click **+ Add observation** on the site. Fill in the telescope, project, and start/end time in your own local timezone — the page converts it to UTC for you — and it generates the JSON object to paste into `observations.json`. It also previews the entry live on the page immediately, but that preview only lives in your current browser tab until you actually commit the JSON to the file, which is what makes it show up for everyone else.

## 3. Customize

- **Colors, fonts, spacing** live in `style.css` under the `:root` block at the top.
- **Telescope colors** are assigned automatically in `app.js` (`TELESCOPE_COLORS`), cycling through a fixed palette in alphabetical order of telescope name — add more hex values there if you regularly use more than six telescopes.
- The calendar week starts on Monday; change the offset math in `renderCalendar()` in `app.js` if you'd rather start on Sunday.

## Viewing it locally before you publish

Because the page loads `observations.json` with `fetch()`, opening `index.html` directly from disk (a `file://` URL) will fail in most browsers. Run a tiny local server from this folder instead:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000/`.
