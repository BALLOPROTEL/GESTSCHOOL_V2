// ════════════════════════════════════════
//  Routes Candidatures (Admissions)
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const col = () => collections.applications;

function find(query) {
  return new Promise((r, j) =>
    col().find(query).sort({ createdAt: -1 }).exec((e, d) => e ? j(e) : r(d))
  );
}
function findOne(query) {
  return new Promise((r, j) => col().findOne(query, (e, d) => e ? j(e) : r(d)));
}
function ins(doc) { return new Promise((r, j) => col().insert(doc, (e, d) => e ? j(e) : r(d))); }
function upd(q, u) { return new Promise((r, j) => col().update(q, u, {}, (e) => e ? j(e) : r())); }

// ─── PUBLIC ─────────────────────────────────────

// POST /api/applications
router.post('/', upload.array('documents', 5), async (req, res) => {
  try {
    const {
      student_first_name, student_last_name, student_dob, level, cursus,
      parent_name, phone, email, address, message
    } = req.body;

    // Validation
    const required = { student_first_name, student_last_name, student_dob, level, parent_name, phone };
    for (const [k, v] of Object.entries(required)) {
      if (!v || !v.trim()) {
        return res.status(400).json({ error: `Le champ "${k}" est requis` });
      }
    }

    const documents = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const doc = await ins({
      student_first_name: student_first_name.trim(),
      student_last_name:  student_last_name.trim(),
      student_dob: student_dob.trim(),
      level: level.trim(),
      cursus: cursus || 'franco-arabe',
      parent_name: parent_name.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      address: (address || '').trim(),
      message: (message || '').trim(),
      documents,
      status: 'new',
      admin_notes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      message: 'Candidature soumise avec succès. Nous vous contacterons dans les 48h.',
      id: doc._id
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/applications/admin/all?status=&level=&search=
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { status, level, cursus, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (level)  query.level  = level;
    if (cursus) query.cursus = cursus;

    let docs = await find(query);

    if (search) {
      const s = search.toLowerCase();
      docs = docs.filter(d =>
        d.student_first_name.toLowerCase().includes(s) ||
        d.student_last_name.toLowerCase().includes(s) ||
        d.parent_name.toLowerCase().includes(s) ||
        d.phone.includes(s)
      );
    }

    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/applications/admin/stats
router.get('/admin/stats', requireAuth, async (req, res) => {
  try {
    const all = await find({});
    const statuses = ['new', 'in_progress', 'accepted', 'refused', 'incomplete'];
    const stats = {};
    for (const s of statuses) stats[s] = all.filter(a => a.status === s).length;
    stats.total = all.length;
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/applications/admin/:id
router.get('/admin/:id', requireAuth, async (req, res) => {
  try {
    const doc = await findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Candidature introuvable' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/applications/admin/:id
router.patch('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const $set = { updatedAt: new Date() };
    if (status)       $set.status      = status;
    if (admin_notes !== undefined) $set.admin_notes = admin_notes;
    await upd({ _id: req.params.id }, { $set });
    res.json({ message: 'Candidature mise à jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
