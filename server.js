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
  const data = readJson(CHAT_FILE, { messages: [], bots: [] });
  if (!Array.isArray(data.messages)) data.messages = [];
  if (!Array.isArray(data.bots)) data.bots = [];
  return data;
}

function writeChat(data) {
  data.messages = Array.isArray(data.messages) ? data.messages.slice(-300) : [];
  data.bots = Array.isArray(data.bots) ? data.bots.slice(0, 50) : [];
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
  res.json({ ok: true, service: 'zen-os-api', time: new Date().toISOString() });
});

/* =========================
   ANNOUNCEMENTS
========================= */

app.get('/api/announcements', (req, res) => {
  const data = readData();
  res.set('Cache-Control', 'no-store');
  res.json({ announcements: Array.isArray(data.announcements) ? data.announcements : [] });
});

app.post('/api/admin/announcements', adminOnly, (req, res) => {
  const item = req.body || {};
  if (!item.title && !item.content) {
    return res.status(400).json({ ok: false, error: 'title or content required' });
  }

  const data = readData();
  const announcement = {
    id: String(item.id || Date.now()),
    title: String(item.title || ''),
    content: String(item.content || ''),
    date: String(item.date || new Date().toISOString().slice(0, 10)),
    pinned: item.pinned === true,
    isNew: item.isNew === true
  };

  data.announcements = Array.isArray(data.announcements) ? data.announcements : [];
  data.announcements.unshift(announcement);
  writeData(data);
  res.status(201).json({ ok: true, announcement });
});

app.put('/api/admin/announcements/:id', adminOnly, (req, res) => {
  const data = readData();
  const index = (data.announcements || []).findIndex(x => String(x.id) === String(req.params.id));
  if (index < 0) return res.status(404).json({ ok: false, error: 'Announcement not found' });

  const old = data.announcements[index];
  data.announcements[index] = {
    ...old,
    ...req.body,
    id: old.id,
    title: String(req.body.title ?? old.title),
    content: String(req.body.content ?? old.content),
    date: String(req.body.date ?? old.date),
    pinned: req.body.pinned === undefined ? old.pinned === true : req.body.pinned === true,
    isNew: req.body.isNew === undefined ? old.isNew === true : req.body.isNew === true
  };

  writeData(data);
  res.json({ ok: true, announcement: data.announcements[index] });
});

app.delete('/api/admin/announcements/:id', adminOnly, (req, res) => {
  const data = readData();
  const before = data.announcements.length;
  data.announcements = data.announcements.filter(x => String(x.id) !== String(req.params.id));
  if (data.announcements.length === before) {
    return res.status(404).json({ ok: false, error: 'Announcement not found' });
  }
  writeData(data);
  res.json({ ok: true });
});

/* =========================
   ZEN CHAT V2
   - online presence
   - polling-based near real-time messages
   - admin message deletion
   - admin bot management
========================= */

const chatPresence = new Map();
const CHAT_PRESENCE_TTL = 70 * 1000;

function pruneChatPresence() {
  const now = Date.now();
  for (const [clientId, lastSeen] of chatPresence.entries()) {
    if (now - lastSeen > CHAT_PRESENCE_TTL) chatPresence.delete(clientId);
  }
}

app.post('/api/chat/presence', (req, res) => {
  pruneChatPresence();
  const rawId = String((req.body || {}).clientId || '').trim();
  if (!rawId) return res.status(400).json({ ok: false, error: 'clientId required' });

  const clientId = rawId.slice(0, 100);
  chatPresence.set(clientId, Date.now());
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, onlineCount: chatPresence.size });
});

app.get('/api/chat/presence', (req, res) => {
  pruneChatPresence();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, onlineCount: chatPresence.size });
});

app.get('/api/chat/messages', (req, res) => {
  const data = readChat();
  res.set('Cache-Control', 'no-store');
  res.json({ messages: data.messages.slice(-120) });
});

app.post('/api/chat/messages', (req, res) => {
  const body = req.body || {};
  let name = String(body.name || '').trim().slice(0, 32) || 'ZEN用户';
  const content = String(body.content || '').trim().slice(0, 1000);

  if (!content) return res.status(400).json({ ok: false, error: 'Message content required' });

  const data = readChat();
  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    content,
    date: new Date().toISOString(),
    isBot: false
  };

  data.messages.push(message);
  writeChat(data);
  res.status(201).json({ ok: true, message });
});

app.delete('/api/admin/chat/messages/:id', adminOnly, (req, res) => {
  const data = readChat();
  const before = data.messages.length;
  data.messages = data.messages.filter(x => String(x.id) !== String(req.params.id));

  if (data.messages.length === before) {
    return res.status(404).json({ ok: false, error: 'Message not found' });
  }

  writeChat(data);
  res.json({ ok: true });
});

/* ---------- Bots ---------- */

app.get('/api/chat/bots', (req, res) => {
  const data = readChat();
  res.set('Cache-Control', 'no-store');
  res.json({
    bots: data.bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      avatar: bot.avatar
    }))
  });
});

app.post('/api/admin/chat/bots', adminOnly, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 32);
  const avatar = String(body.avatar || '🤖').trim().slice(0, 8) || '🤖';

  if (!name) return res.status(400).json({ ok: false, error: 'Bot name required' });

  const data = readChat();
  const bot = {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    avatar,
    createdAt: new Date().toISOString()
  };

  data.bots.unshift(bot);
  writeChat(data);
  res.status(201).json({ ok: true, bot });
});

app.delete('/api/admin/chat/bots/:id', adminOnly, (req, res) => {
  const data = readChat();
  const before = data.bots.length;
  data.bots = data.bots.filter(x => String(x.id) !== String(req.params.id));

  if (data.bots.length === before) {
    return res.status(404).json({ ok: false, error: 'Bot not found' });
  }

  writeChat(data);
  res.json({ ok: true });
});

app.post('/api/admin/chat/bots/:id/messages', adminOnly, (req, res) => {
  const body = req.body || {};
  const content = String(body.content || '').trim().slice(0, 1000);
  if (!content) return res.status(400).json({ ok: false, error: 'Bot message content required' });

  const data = readChat();
  const bot = data.bots.find(x => String(x.id) === String(req.params.id));
  if (!bot) return res.status(404).json({ ok: false, error: 'Bot not found' });

  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: bot.name,
    content,
    date: new Date().toISOString(),
    isBot: true,
    botId: bot.id,
    avatar: bot.avatar
  };

  data.messages.push(message);
  writeChat(data);
  res.status(201).json({ ok: true, message });
});


/* =========================
   ZEN AI · CLOSED
   AI service is intentionally disabled.
   Website / chat / announcements remain available.
========================= */

app.get('/api/ai/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    enabled: false,
    closed: true,
    message: 'ZEN AI 已关闭。'
  });
});

app.post('/api/ai/chat', (req, res) => {
  res.status(410).json({
    ok: false,
    closed: true,
    error: 'ZEN AI 已关闭，当前不提供 AI 对话服务。'
  });
});

/* =========================
   ROOT
========================= */

app.get('/', (req, res) => {
  res.json({ service: 'ZEN OS API', status: 'online' });
});

app.listen(PORT, () => {
  console.log(`ZEN OS API listening on ${PORT}`);
});
