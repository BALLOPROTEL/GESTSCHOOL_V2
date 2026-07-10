// ════════════════════════════════════════
//  Routes Gallery
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const gal = () => collections.gallery;

function ins(doc) { return new Promise((r, j) => gal().insert(doc, (e, d) => e ? j(e) : r(d))); }
function upd(q, u) { return new Promise((r, j) => gal().update(q, u, {}, (e) => e ? j(e) : r())); }
function del(q) { return new Promise((r, j) => gal().remove(q, {}, (e) => e ? j(e) : r())); }

// ─── PUBLIC ─────────────────────────────────────

// GET /api/gallery?category=&limit=
router.get('/', async (req, res) => {
  try {
    const { category, limit } = req.query;
    const query = { is_published: true };
    if (category && category !== 'all') query.category = category;

    let docs = await new Promise((r, j) =>
      gal().find(query).sort({ sort_order: 1, createdAt: -1 }).exec((e, d) => e ? j(e) : r(d))
    );
    if (limit) docs = docs.slice(0, parseInt(limit));
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/gallery/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const docs = await new Promise((r, j) =>
      gal().find({}).sort({ sort_order: 1, createdAt: -1 }).exec((e, d) => e ? j(e) : r(d))
    );
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gallery (upload + meta)
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, is_published, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Titre requis' });

    const file_path = req.file ? `/uploads/${req.file.filename}` : req.body.file_path;
    if (!file_path) return res.status(400).json({ error: 'Fichier requis' });

    const ext = file_path.split('.').pop().toLowerCase();
    const file_type = ['mp4', 'mov', 'avi', 'webm'].includes(ext) ? 'video' : 'image';

    const doc = await ins({
      title, description: description || '', file_path, file_type,
      category: category || 'general',
      is_published: is_published !== 'false',
      sort_order: parseInt(sort_order) || 0,
      createdAt: new Date()
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/gallery/:id
router.put('/:id', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, is_published, sort_order } = req.body;
    const $set = { updatedAt: new Date() };
    if (title)       $set.title       = title;
    if (description !== undefined) $set.description = description;
    if (category)    $set.category    = category;
    if (is_published !== undefined) $set.is_published = is_published !== 'false';
    if (sort_order !== undefined) $set.sort_order = parseInt(sort_order);
    if (req.file)    $set.file_path   = `/uploads/${req.file.filename}`;

    await upd({ _id: req.params.id }, { $set });
    res.json({ message: 'Média mis à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/gallery/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await del({ _id: req.params.id });
    res.json({ message: 'Média supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/gallery/:id/toggle
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const doc = await new Promise((r, j) => gal().findOne({ _id: req.params.id }, (e, d) => e ? j(e) : r(d)));
    if (!doc) return res.status(404).json({ error: 'Média introuvable' });
    await upd({ _id: req.params.id }, { $set: { is_published: !doc.is_published } });
    res.json({ is_published: !doc.is_published });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
