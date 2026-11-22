This folder stores the Video Notes app data:
- video-notes.json : all your video notes
- user.json        : your name
- theme.json       : the selected color theme
- backups/         : automatic snapshots of the files above
- projects/        : the Projects section
                     index.json        : list of projects
                     <project-id>.json : one project (its folders and points)

Data is saved automatically by the app's local Node server
(server.js, started by `npm start`), so no browser folder-picker
is needed anymore. The folder-picker in the header is only a
fallback for when that server is not running.

Backups: every time a file is replaced, the previous version is
copied into backups/ first. Only the newest 5 snapshots are kept:
the server prunes the folder right after each save and again
every 30 minutes while it is running.
To recover an older version, copy the snapshot you want over the
live file, e.g.:

    copy backups\video-notes.<timestamp>.json video-notes.json

To clean up old snapshots without running the app, use
`npm run backups:prune`; `npm run backups:watch` keeps pruning
every 30 minutes in a separate terminal.

Saving is whole-file, so the server refuses a write that would
replace saved videos with an empty dataset. If you really mean to
erase everything, repeat the save with ?force=1.

Projects are edited in the app (/projects). Each project holds
folders, and each folder holds one scrollable page of points. Any
point can have unlimited subpoints, and clicking a point opens its
detail popup (title, description, notes, links, images).
