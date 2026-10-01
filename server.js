/**
 * Local persistence API for the Video Notes app.
 *
 * A zero-dependency Node server that stores the app data as JSON files
 * in the "notes" folder next to this file (video-notes.json, user.json),
 * so data survives page reloads without any browser folder-picker.
 *
 * Endpoints:
 *   GET  /api/notes  -> current video notes dataset (JSON, [] when empty)
 *   PUT  /api/notes  -> replaces the dataset with the request body (JSON)
 *   GET  /api/user   -> saved user name (plain text, '' when empty)
 *   PUT  /api/user   -> replaces the user name with the request body (text)
 *
 * Run with: node server.js  (or `npm start`, which starts it together with ng serve)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.API_PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'notes');
const NOTES_FILE = path.join(DATA_DIR, 'video-notes.json');
const USER_FILE = path.join(DATA_DIR, 'user.json');
const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 MB safety limit

function send(res, status, body, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Atomic write: write to a temp file first, then rename over the target.
function writeFileAtomic(filePath, contents) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function readDataFile(filePath, fallback) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function handle(req, res) {
  const url = (req.url || '').split('?')[0];

  if (url === '/api/notes') {
    if (req.method === 'GET') {
      send(res, 200, readDataFile(NOTES_FILE, '[]'), 'application/json; charset=utf-8');
      return;
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      try {
        JSON.parse(body); // validate before writing
      } catch {
        sendJson(res, 400, { error: 'Body is not valid JSON' });
        return;
      }
      writeFileAtomic(NOTES_FILE, body);
      sendJson(res, 200, { ok: true, bytes: Buffer.byteLength(body) });
      return;
    }
  }

  if (url === '/api/user') {
    if (req.method === 'GET') {
      send(res, 200, readDataFile(USER_FILE, ''), 'text/plain; charset=utf-8');
      return;
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      writeFileAtomic(USER_FILE, body);
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => {
    console.error('[api] error handling', req.method, req.url, err);
    if (!res.headersSent) sendJson(res, 500, { error: String(err && err.message || err) });
  });
});

server.listen(PORT, () => {
  console.log(`[api] Video Notes persistence API listening on http://localhost:${PORT}`);
  console.log(`[api] Data folder: ${DATA_DIR}`);
});
