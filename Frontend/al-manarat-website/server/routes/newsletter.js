// ════════════════════════════════════════
//  Routes Newsletter
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');

const col = () => collections.newsletter;

// POST /api/newsletter (subscribe)
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const existing = await new Promise((r,j) => col().findOne({email},(e,d)=>e?j(e):r(d)));
    if (existing) {
      if (existing.is_active) return res.status(409).json({ error: 'Email déjà inscrit' });
      await new Promise((r,j) => col().update({email},{$set:{is_active:true,createdAt:new Date()}},{},(e)=>e?j(e):r()));
      return res.json({ message: 'Inscription réactivée avec succès !' });
    }

    await new Promise((r,j) => col().insert({email, is_active:true, createdAt:new Date()},(e,d)=>e?j(e):r(d)));
    res.status(201).json({ message: 'Inscription à la newsletter réussie !' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/newsletter/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const docs = await new Promise((r,j) =>
      col().find({is_active:true}).sort({createdAt:-1}).exec((e,d)=>e?j(e):r(d))
    );
    res.json(docs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/newsletter/admin/export (CSV)
router.get('/admin/export', requireAuth, async (req, res) => {
  try {
    const docs = await new Promise((r,j) =>
      col().find({is_active:true}).sort({createdAt:-1}).exec((e,d)=>e?j(e):r(d))
    );
    const lines = ['Email,Date inscription', ...docs.map(d =>
      `${d.email},${new Date(d.createdAt).toLocaleDateString('fr-FR')}`
    )];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=newsletter.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/newsletter/admin/:id
router.delete('/admin/:id', requireAuth, async (req, res) => {
  try {
    await new Promise((r,j) => col().update({_id:req.params.id},{$set:{is_active:false}},{},(e)=>e?j(e):r()));
    res.json({ message: 'Désabonné' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
