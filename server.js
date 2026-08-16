'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, 'data', 'announcements.json');
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

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return { announcements: [] };
  }
}

function writeData(data) {
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
}

function adminOnly(req, res, next) {
  if (!ADMIN_API_KEY) return res.status(503).json({ ok: false, error: 'Admin API disabled' });
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'zen-os-api', time: new Date().toISOString() });
});

app.get('/api/announcements', (req, res) => {
  const data = readData();
  res.set('Cache-Control', 'no-store');
  res.json({ announcements: Array.isArray(data.announcements) ? data.announcements : [] });
});

app.post('/api/admin/announcements', adminOnly, (req, res) => {
  const item = req.body || {};
  if (!item.title && !item.content) return res.status(400).json({ ok: false, error: 'title or content required' });
  const data = readData();
  const id = String(item.id || Date.now());
  const announcement = {
    id,
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
  if (data.announcements.length === before) return res.status(404).json({ ok: false, error: 'Announcement not found' });
  writeData(data);
  res.json({ ok: true });
});

app.get('/', (req, res) => res.json({ service: 'ZEN OS API', status: 'online' }));

app.listen(PORT, () => console.log(`ZEN OS API listening on port ${PORT}`));
