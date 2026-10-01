This folder stores the Video Notes app data:
- video-notes.json : all your video notes
- user.json        : your name

Data is saved automatically by the app's local Node server
(server.js, started by `npm start`), so no browser folder-picker
is needed anymore. The folder-picker in the header is only a
fallback for when that server is not running.
