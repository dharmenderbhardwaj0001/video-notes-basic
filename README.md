# Video Notes

A local-first web app for tracking the videos you watch and the notes you take while watching them — organized by year, month, and day, with watch progress, a most-watched leaderboard, per-video watch history, and 12 color themes.

Everything runs on your machine. No account, no cloud, no tracking.

## What you can do

- **Add videos for any day** — give it a title, a YouTube (or any) URL, and optional notes. If the link is a YouTube video, the app shows the video's real thumbnail everywhere it appears.
- **Track watch progress** — save the position where you left off (hours / minutes / seconds). Videos you're partway through show a "continue watching" badge and their watched-till time.
- **Browse your watch history** — videos are grouped by year, month, and day, with stats for each (videos watched, time watched, notes taken).
- **Today's Progress dashboard** — the home page shows today's total watch time, videos, notes, longest session, this week's chart, and all-time stats.
- **Top Videos card** — your 10 most-watched videos, ranked by total time, with thumbnails and watch time. Click one to jump to the day you last watched it.
- **Per-video history page** — every video card has a history icon (clock) that opens a timeline of every day you watched that video, with watched-till positions and session times.
- **Set your name** — click the avatar in the header; the app greets you with it.
- **Pick a theme** — the palette icon in the header opens a theme picker with 12 themes (Light, Dark, Midnight, Forest, Coffee, Nord, Ocean, Sunset, Rose, Violet, Slate, Sepia). The whole UI follows the chosen theme and it is remembered between sessions.

## Getting started

Requires [Node.js](https://nodejs.org/) (LTS version recommended).

```bash
npm install
npm start
```

`npm start` launches both the app and its local data server, then opens `http://localhost:4200/` (the dev server picks a port if 4200 is taken).

Useful commands:

| Command | What it does |
| --- | --- |
| `npm start` | Starts the data API (`server.js`) and the Angular dev server together |
| `npm run api` | Starts only the data API on port 3000 |
| `npm run serve` | Starts only the Angular dev server (needs the API for saving) |
| `npm run build` | Builds the app into `dist/` |

Note: if you only run `npm run serve` without the API, saving fails silently — always use `npm start`.

## Where your data is saved

All data lives in plain files on your own PC, in the `notes/` folder next to `server.js`:

```
notes/
├── video-notes.json   # all your video notes (one line per day)
├── user.json          # your name
├── theme.json         # your selected color theme
└── README.txt         # short note about this folder
```

- The local API (`server.js`) reads and writes these files automatically as you use the app — no setup or folder picker needed.
- Every save is written atomically (temp file + rename), so a crash mid-save can't corrupt your data.
- `video-notes.json` is formatted for humans: each day sits on its own line, so you can read or hand-edit it in any editor.
- The folder-picker button in the header is only a fallback for browsers supporting the File System Access API when the API server isn't running; Chrome may also keep a copy in the folder you pick.
- These files are personal data and are excluded from git via `.gitignore`.

## Tech stack

- [Angular 19](https://angular.dev/) (standalone components)
- Zero-dependency Node.js persistence API (`server.js`)
- SCSS with a CSS-variable theme system
