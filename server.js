const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// shortcut: sessions live in memory and vanish on restart/redeploy, fine for one kitchen; add a DB if rounds must survive restarts
const sessions = new Map();
const DAY = 24 * 60 * 60 * 1000;
const page = fs.readFileSync(path.join(__dirname, 'index.html'));

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, easy to read out loud
  let code;
  do code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  while (sessions.has(code));
  return code;
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function api(req, res, parts) {
  const [, , code, action] = parts; // /api/sessions/:code/:action

  if (req.method === 'POST' && !code) {
    const body = await readBody(req);
    const question = text(body.question, 200);
    const target = num(body.target);
    if (!question || target === null) return send(res, 400, { error: 'Question and number are required' });
    for (const [c, s] of sessions) if (Date.now() - s.created > DAY) sessions.delete(c);
    const s = { code: newCode(), hostKey: crypto.randomUUID(), question, target, closed: false, guesses: [], created: Date.now() };
    sessions.set(s.code, s);
    return send(res, 201, { code: s.code, hostKey: s.hostKey });
  }

  const s = sessions.get(String(code).toUpperCase());
  if (!s) return send(res, 404, { error: 'Session not found' });
  const isHost = req.headers['x-host-key'] === s.hostKey;

  if (req.method === 'GET' && !action) {
    if (!isHost) return send(res, 200, { question: s.question, closed: s.closed });
    return send(res, 200, { question: s.question, target: s.target, closed: s.closed, guesses: s.guesses });
  }

  if (req.method === 'POST' && action === 'guesses') {
    const body = await readBody(req);
    const name = text(body.name, 30);
    const guess = num(body.guess);
    if (!name || guess === null) return send(res, 400, { error: 'Name and number are required' });
    if (s.closed) return send(res, 409, { error: 'This round is already closed' });
    if (s.guesses.some((g) => g.name.toLowerCase() === name.toLowerCase())) return send(res, 409, { error: 'That name already guessed' });
    s.guesses.push({ name, guess });
    return send(res, 201, { ok: true });
  }

  if (req.method === 'POST' && action === 'close') {
    if (!isHost) return send(res, 403, { error: 'Only the host can close the round' });
    s.closed = true;
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const parts = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
  if (parts[0] === 'api' && parts[1] === 'sessions') {
    try { await api(req, res, parts); } catch { send(res, 400, { error: 'Bad request' }); }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Listening on http://localhost:${port}`));
}

module.exports = server;
