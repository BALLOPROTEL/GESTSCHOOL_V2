// ════════════════════════════════════════
//  Routes Articles (NeDB version)
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const col = () => collections.articles;

function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function findAll(query, sortField = 'publishedAt', sortDir = -1) {
  return new Promise((r, j) =>
    col().find(query).sort({ [sortField]: sortDir }).exec((e, d) => e ? j(e) : r(d))
  );
}
function findOne(query) { return new Promise((r,j) => col().findOne(query,(e,d)=>e?j(e):r(d))); }
function ins(d) { return new Promise((r,j) => col().insert(d,(e,doc)=>e?j(e):r(doc))); }
function upd(q,u) { return new Promise((r,j) => col().update(q,u,{},(e)=>e?j(e):r())); }
function del(q) { return new Promise((r,j) => col().remove(q,{},(e)=>e?j(e):r())); }

// ─── PUBLIC ─────────────────────────────────────

// GET /api/articles?category=&page=1&limit=9
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 9 } = req.query;
    const query = { status: 'published' };
    if (category && category !== 'all') query.category = category;

    const all = await findAll(query);
    const total = all.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const articles = all.slice(start, start + parseInt(limit)).map(a => ({
      _id: a._id, title: a.title, slug: a.slug, excerpt: a.excerpt,
      category: a.category, cover_image: a.cover_image,
      author: a.author, publishedAt: a.publishedAt
    }));
    res.json({ articles, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/articles/:slug
router.get('/:slug', async (req, res) => {
  try {
    const art = await findOne({ slug: req.params.slug, status: 'published' });
    if (!art) return res.status(404).json({ error: 'Article introuvable' });
    res.json(art);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/articles/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const query = {};
    if (status)   query.status   = status;
    if (category) query.category = category;

    let docs = await findAll(query, 'createdAt', -1);
    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d => d.title.toLowerCase().includes(s) || (d.content||'').toLowerCase().includes(s));
    }
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/articles
router.post('/', requireAuth, upload.single('cover_image'), async (req, res) => {
  try {
    const { title, excerpt, content, category, status, author } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Titre et contenu requis' });

    const slug  = slugify(title) + '-' + Date.now();
    const cover = req.file ? `/uploads/${req.file.filename}` : null;
    const doc   = await ins({
      title, slug, excerpt: excerpt || '', content, category: category || 'general',
      cover_image: cover, status: status || 'draft', author: author || 'Administration',
      publishedAt: status === 'published' ? new Date() : null,
      createdAt: new Date(), updatedAt: new Date()
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/articles/:id
router.put('/:id', requireAuth, upload.single('cover_image'), async (req, res) => {
  try {
    const art = await findOne({ _id: req.params.id });
    if (!art) return res.status(404).json({ error: 'Article introuvable' });

    const { title, excerpt, content, category, status, author } = req.body;
    const $set = { updatedAt: new Date() };
    if (title)    $set.title    = title;
    if (excerpt !== undefined) $set.excerpt = excerpt;
    if (content)  $set.content  = content;
    if (category) $set.category = category;
    if (author)   $set.author   = author;
    if (req.file) $set.cover_image = `/uploads/${req.file.filename}`;
    if (status) {
      $set.status = status;
      if (status === 'published' && art.status !== 'published') $set.publishedAt = new Date();
    }

    await upd({ _id: req.params.id }, { $set });
    res.json({ message: 'Article mis à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/articles/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await del({ _id: req.params.id });
    res.json({ message: 'Article supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/articles/:id/publish
router.patch('/:id/publish', requireAuth, async (req, res) => {
  try {
    const art = await findOne({ _id: req.params.id });
    if (!art) return res.status(404).json({ error: 'Article introuvable' });
    const newStatus = art.status === 'published' ? 'draft' : 'published';
    const $set = { status: newStatus, updatedAt: new Date() };
    if (newStatus === 'published') $set.publishedAt = new Date();
    await upd({ _id: req.params.id }, { $set });
    res.json({ status: newStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
