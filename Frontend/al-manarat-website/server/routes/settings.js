// ════════════════════════════════════════
//  Routes Settings — Version CMS Complète
// ════════════════════════════════════════
'use strict';

const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { collections } = require('../database');
const { requireAuth } = require('../middleware/auth');

const col = () => collections.settings;

// ─── Logo upload storage ─────────────────
const logoDir = path.join(__dirname, '..', '..', 'uploads', 'logo');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  }
});
const uploadLogo = multer({
  storage: logoStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format image requis'));
  }
});

function getAll() {
  return new Promise((r,j) => col().find({},(e,d)=>e?j(e):r(d)));
}
function toMap(docs) {
  return Object.fromEntries(docs.map(d => [d.key, d.value]));
}
function upsert(key, value) {
  return new Promise((r,j) =>
    col().update({key}, {$set:{value, updatedAt: new Date()}}, {upsert:true}, e=>e?j(e):r())
  );
}

// ─── PUBLIC ─────────────────────────────────────

// GET /api/settings/public
router.get('/public', async (req, res) => {
  try {
    const publicKeys = [
      'school_name','school_slogan','school_address','school_phone','school_phone2',
      'school_email','school_email2','school_hours','school_founded',
      'facebook_url','whatsapp_url','youtube_url','instagram_url','twitter_url','tiktok_url',
      'footer_tagline','footer_copyright',
      'logo_path',
      'gestschool_url',
    ];
    const docs = await new Promise((r,j) => col().find({key:{$in:publicKeys}},(e,d)=>e?j(e):r(d)));
    res.json(toMap(docs));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN ─────────────────────────────────────

// GET /api/settings/admin/all
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const docs = await getAll();
    res.json(toMap(docs));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/admin — bulk update
router.put('/admin', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await upsert(key, value);
    }
    res.json({ message: 'Paramètres enregistrés' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/admin/upload-logo
router.post('/admin/upload-logo', requireAuth, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const logoPath = `/uploads/logo/${req.file.filename}`;
    await upsert('logo_path', logoPath);
    res.json({ message: 'Logo mis à jour', logo_path: logoPath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/admin/stats
router.get('/admin/stats', requireAuth, async (req, res) => {
  try {
    const { collections: db } = require('../database');
    const [articles, events, gallery, applications, contacts, newsletter] = await Promise.all([
      new Promise((r,j) => db.articles.count({status:'published'},(e,n)=>e?j(e):r(n))),
      new Promise((r,j) => db.events.count({},(e,n)=>e?j(e):r(n))),
      new Promise((r,j) => db.gallery.count({is_published:true},(e,n)=>e?j(e):r(n))),
      new Promise((r,j) => db.applications.count({},(e,n)=>e?j(e):r(n))),
      new Promise((r,j) => db.contacts.count({is_read:false},(e,n)=>e?j(e):r(n))),
      new Promise((r,j) => db.newsletter.count({is_active:true},(e,n)=>e?j(e):r(n))),
    ]);
    const latestApps = await new Promise((r,j) =>
      db.applications.find({}).sort({createdAt:-1}).limit(5).exec((e,d)=>e?j(e):r(d))
    );
    const latestMessages = await new Promise((r,j) =>
      db.contacts.find({}).sort({createdAt:-1}).limit(5).exec((e,d)=>e?j(e):r(d))
    );
    const newApps = await new Promise((r,j) => db.applications.count({status:'new'},(e,n)=>e?j(e):r(n)));
    res.json({
      articles, events, gallery, applications, contacts_unread: contacts,
      newsletter, new_applications: newApps,
      latest_applications: latestApps,
      latest_messages: latestMessages
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
