'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'announcements.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!ADMIN_API_KEY) {
  console.warn('[WARN] ADMIN_API_KEY is not set. Admin write endpoints are disabled.');
}

app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',').map(v => v.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '256kb' }));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

function readData() {
  return readJson(DATA_FILE, { announcements: [] });
}

function writeData(data) {
  writeJson(DATA_FILE, data);
}

function readChat() {
  const data = readJson(CHAT_FILE, { messages: [] });
  if (!Array.isArray(data.messages)) data.messages = [];
  return data;
}

function writeChat(data) {
  data.messages = Array.isArray(data.messages) ? data.messages : [];
  // Keep the newest 200 messages so the first version stays lightweight.
  data.messages = data.messages.slice(-200);
  writeJson(CHAT_FILE, data);
}

function adminOnly(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ ok: false, error: 'Admin API disabled' });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || token !== ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  next();
}

/* =========================
   HEALTH
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'zen-os-api',
    time: new Date().toISOString()
  });
});

/* =========================
   ANNOUNCEMENTS
========================= */

app.get('/api/announcements', (req, res) => {
  const data = readData();

  res.set('Cache-Control', 'no-store');
  res.json({
    announcements: Array.isArray(data.announcements)
      ? data.announcements
      : []
  });
});

app.post('/api/admin/announcements', adminOnly, (req, res) => {
  const item = req.body || {};

  if (!item.title && !item.content) {
    return res.status(400).json({
      ok: false,
      error: 'title or content required'
    });
  }

  const data = readData();
  const id = String(item.id || Date.now());

  const announcement = {
    id,
    title: String(item.title || ''),
    content: String(item.content || ''),
    date: String(
      item.date ||
      new Date().toISOString().slice(0, 10)
    ),
    pinned: item.pinned === true,
    isNew: item.isNew === true
  };

  data.announcements =
    Array.isArray(data.announcements)
      ? data.announcements
      : [];

  data.announcements.unshift(announcement);

  writeData(data);

  res.status(201).json({
    ok: true,
    announcement
  });
});

app.put('/api/admin/announcements/:id', adminOnly, (req, res) => {
  const data = readData();

  const index = (data.announcements || [])
    .findIndex(x => String(x.id) === String(req.params.id));

  if (index < 0) {
    return res.status(404).json({
      ok: false,
      error: 'Announcement not found'
    });
  }

  const old = data.announcements[index];

  data.announcements[index] = {
    ...old,
    ...req.body,
    id: old.id,
    title: String(req.body.title ?? old.title),
    content: String(req.body.content ?? old.content),
    date: String(req.body.date ?? old.date),
    pinned:
      req.body.pinned === undefined
        ? old.pinned === true
        : req.body.pinned === true,
    isNew:
      req.body.isNew === undefined
        ? old.isNew === true
        : req.body.isNew === true
  };

  writeData(data);

  res.json({
    ok: true,
    announcement: data.announcements[index]
  });
});

app.delete('/api/admin/announcements/:id', adminOnly, (req, res) => {
  const data = readData();
  const before = data.announcements.length;

  data.announcements = data.announcements.filter(
    x => String(x.id) !== String(req.params.id)
  );

  if (data.announcements.length === before) {
    return res.status(404).json({
      ok: false,
      error: 'Announcement not found'
    });
  }

  writeData(data);

  res.json({ ok: true });
});

/* =========================
   ZEN CHAT V1 + PRESENCE
========================= */

// Lightweight in-memory presence for the homepage online counter.
// A client is considered online for 60 seconds after its last heartbeat.
const chatPresence = new Map();
const CHAT_PRESENCE_TTL = 60 * 1000;

function pruneChatPresence() {
  const now = Date.now();
  for (const [clientId, lastSeen] of chatPresence.entries()) {
    if (now - lastSeen > CHAT_PRESENCE_TTL) chatPresence.delete(clientId);
  }
}

app.post('/api/chat/presence', (req, res) => {
  pruneChatPresence();

  const rawId = String((req.body || {}).clientId || '').trim();
  if (!rawId) {
    return res.status(400).json({ ok: false, error: 'clientId required' });
  }

  const clientId = rawId.slice(0, 100);
  chatPresence.set(clientId, Date.now());

  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    onlineCount: chatPresence.size
  });
});

app.get('/api/chat/presence', (req, res) => {
  pruneChatPresence();
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    onlineCount: chatPresence.size
  });
});


app.get('/api/chat/messages', (req, res) => {
  const data = readChat();

  res.set('Cache-Control', 'no-store');

  res.json({
    messages: data.messages.slice(-100)
  });
});

app.post('/api/chat/messages', (req, res) => {
  const body = req.body || {};

  let name = String(body.name || '').trim();
  let content = String(body.content || '').trim();

  if (!name) name = 'ZEN用户';

  if (!content) {
    return res.status(400).json({
      ok: false,
      error: 'Message content required'
    });
  }

  // Keep the public chat lightweight and avoid unexpectedly huge messages.
  name = name.slice(0, 32);
  content = content.slice(0, 1000);

  const data = readChat();

  const message = {
    id:
      String(Date.now()) +
      '-' +
      Math.random().toString(36).slice(2, 8),
    name,
    content,
    date: new Date().toISOString()
  };

  data.messages.push(message);
  writeChat(data);

  res.status(201).json({
    ok: true,
    message
  });
});

app.delete('/api/admin/chat/messages/:id', adminOnly, (req, res) => {
  const data = readChat();

  const before = data.messages.length;

  data.messages = data.messages.filter(
    x => String(x.id) !== String(req.params.id)
  );

  if (data.messages.length === before) {
    return res.status(404).json({
      ok: false,
      error: 'Message not found'
    });
  }

  writeChat(data);

  res.json({ ok: true });
});

/* =========================
   ROOT
========================= */

app.get('/', (req, res) => {
  res.json({
    service: 'ZEN OS API',
    status: 'online'
  });
});

app.listen(PORT, () => {
  console.log(`ZEN OS API listening on ${PORT}`);
});
