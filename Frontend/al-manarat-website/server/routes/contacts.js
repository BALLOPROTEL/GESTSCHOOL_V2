// ════════════════════════════════════════
//  Routes Contact Messages
// ════════════════════════════════════════
'use strict';

const router = require('express').Router();
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');

const col = () => collections.contacts;
function find(q) { return new Promise((r,j) => col().find(q).sort({ createdAt: -1 }).exec((e,d) => e?j(e):r(d))); }
function ins(d) { return new Promise((r,j) => col().insert(d,(e,doc)=>e?j(e):r(doc))); }
function upd(q,u) { return new Promise((r,j) => col().update(q,u,{},(e)=>e?j(e):r())); }
function del(q) { return new Promise((r,j) => col().remove(q,{},(e)=>e?j(e):r())); }

// ─── PUBLIC ─────────────────────────────────────

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Nom et message requis' });

    await ins({ name: name.trim(), email: (email||'').trim(), phone: (phone||'').trim(),
      subject: (subject||'').trim(), message: message.trim(), is_read: false, createdAt: new Date() });

    res.status(201).json({ message: 'Message envoyé avec succès. Nous vous répondrons dans les 24h.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/contacts/admin/all?is_read=false
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { is_read } = req.query;
    const query = {};
    if (is_read !== undefined) query.is_read = is_read === 'true';
    res.json(await find(query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/contacts/admin/:id/read
router.patch('/admin/:id/read', requireAuth, async (req, res) => {
  try {
    const doc = await new Promise((r,j) => col().findOne({_id:req.params.id},(e,d)=>e?j(e):r(d)));
    if (!doc) return res.status(404).json({ error: 'Message introuvable' });
    await upd({_id:req.params.id}, {$set:{is_read:!doc.is_read}});
    res.json({ is_read: !doc.is_read });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/contacts/admin/:id
router.delete('/admin/:id', requireAuth, async (req, res) => {
  try {
    await del({_id:req.params.id});
    res.json({ message: 'Message supprimé' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
