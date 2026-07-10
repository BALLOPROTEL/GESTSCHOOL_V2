// ════════════════════════════════════════
//  Routes Events
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const ev = () => collections.events;

function q(col, query, multi = true) {
  return new Promise((res, rej) => {
    const cursor = col.find(query).sort({ date: 1 });
    if (multi) cursor.exec((e, d) => e ? rej(e) : res(d));
    else col.findOne(query, (e, d) => e ? rej(e) : res(d));
  });
}
function insert(col, doc) { return new Promise((r, j) => col.insert(doc, (e, d) => e ? j(e) : r(d))); }
function update(col, q, upd) { return new Promise((r, j) => col.update(q, upd, {}, (e, n) => e ? j(e) : r(n))); }
function remove(col, q) { return new Promise((r, j) => col.remove(q, {}, (e, n) => e ? j(e) : r(n))); }

function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ─── PUBLIC ─────────────────────────────────────

// GET /api/events?status=upcoming&featured=true&limit=5
router.get('/', async (req, res) => {
  try {
    const { status, featured, limit } = req.query;
    const query = {};
    if (status) query.status = status;
    if (featured === 'true') query.is_featured = true;

    let docs = await q(ev(), query);
    if (limit) docs = docs.slice(0, parseInt(limit));
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/events/:slug
router.get('/:slug', async (req, res) => {
  try {
    const doc = await new Promise((r, j) => ev().findOne({ slug: req.params.slug }, (e, d) => e ? j(e) : r(d)));
    if (!doc) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/events/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const docs = await new Promise((r, j) => ev().find({}).sort({ createdAt: -1 }).exec((e, d) => e ? j(e) : r(d)));
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/events
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, time, location, status, is_featured } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Titre et date requis' });

    const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || null);
    const slug  = slugify(title) + '-' + Date.now();
    const doc = await insert(ev(), {
      title, slug, description: description || '', date, time: time || '',
      location: location || '', image, is_featured: is_featured === 'true',
      status: status || 'upcoming', createdAt: new Date(), updatedAt: new Date()
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/events/:id
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, time, location, status, is_featured } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : undefined;

    const upd = { $set: { updatedAt: new Date() } };
    if (title)       upd.$set.title       = title;
    if (description !== undefined) upd.$set.description = description;
    if (date)        upd.$set.date        = date;
    if (time !== undefined)  upd.$set.time = time;
    if (location !== undefined) upd.$set.location = location;
    if (status)      upd.$set.status      = status;
    if (is_featured !== undefined) upd.$set.is_featured = is_featured === 'true';
    if (image)       upd.$set.image       = image;

    await update(ev(), { _id: req.params.id }, upd);
    res.json({ message: 'Événement mis à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await remove(ev(), { _id: req.params.id });
    res.json({ message: 'Événement supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
