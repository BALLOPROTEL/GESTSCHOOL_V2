// ════════════════════════════════════════════════════
//  Al Manarat Islamiyat — Serveur Express Principal
//  Port: 3001
// ════════════════════════════════════════════════════
'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { seedData } = require('./database-init');
const { connectMongo, ensureMongoIndexes, getMongoConfig, isMongoConfigured } = require('./db/mongo');
const { seedCmsContent } = require('./cms/seed');

const app  = express();
const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname, '..');   // al-manarat-website/
const NODE_ENV = (process.env.NODE_ENV || 'development').trim().toLowerCase();
const CORS_ORIGIN_RAW = (process.env.CORS_ORIGIN || '').trim();

if (NODE_ENV === 'production' && (!CORS_ORIGIN_RAW || CORS_ORIGIN_RAW.includes('*'))) {
  throw new Error('CORS_ORIGIN must list explicit origins in production.');
}

const CORS_ORIGIN = CORS_ORIGIN_RAW
  ? CORS_ORIGIN_RAW.split(',').map(origin => origin.trim()).filter(Boolean)
  : true;

// ── Middleware ───────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ────────────────────────────────
app.use(express.static(ROOT));
app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

// ── API Routes ──────────────────────────────────
const siteRouters = {
  admin:        require('./routes/auth'),
  articles:     require('./routes/articles'),
  events:       require('./routes/events'),
  gallery:      require('./routes/gallery'),
  applications: require('./routes/applications'),
  contacts:     require('./routes/contacts'),
  newsletter:   require('./routes/newsletter'),
  settings:     require('./routes/settings'),
  cms:          require('./routes/cms'),
};

function mountSiteApi(prefix) {
  app.use(`${prefix}/admin`,        siteRouters.admin);
  app.use(`${prefix}/articles`,     siteRouters.articles);
  app.use(`${prefix}/events`,       siteRouters.events);
  app.use(`${prefix}/gallery`,      siteRouters.gallery);
  app.use(`${prefix}/applications`, siteRouters.applications);
  app.use(`${prefix}/contacts`,     siteRouters.contacts);
  app.use(`${prefix}/newsletter`,   siteRouters.newsletter);
  app.use(`${prefix}/settings`,     siteRouters.settings);
  app.use(`${prefix}/cms`,          siteRouters.cms.publicRouter);
  app.use(`${prefix}/admin/cms`,    siteRouters.cms.adminRouter);
  app.get(`${prefix}/health`, (req, res) => res.json({ status: 'ok', time: new Date() }));
}

// Canonical production path. Legacy /api stays enabled during migration.
mountSiteApi('/api/site');
mountSiteApi('/api');

// ── Public gateway pages ─────────────────────────
app.get(['/acces-scolaire', '/acces-scolaire.html'], (req, res) => {
  res.sendFile(path.join(ROOT, 'pages', 'acces-scolaire.html'));
});

// ── SPA Fallback (public pages) ──────────────────
function sendAdminPage(req, res, basePath) {
  const adminRoot = path.join(ROOT, 'admin');
  const relativePath = req.path
    .replace(new RegExp(`^${basePath}/?`), '')
    .replace(/^\/+/, '') || 'login.html';
  const file = path.resolve(adminRoot, relativePath);

  if (file.startsWith(`${adminRoot}${path.sep}`) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return res.sendFile(file);
  }

  return res.sendFile(path.join(adminRoot, 'login.html'));
}

app.get(['/admin-site', '/admin-site/'], (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

app.get('/admin-site/*', (req, res) => {
  sendAdminPage(req, res, '/admin-site');
});

app.get('/admin/*', (req, res) => {
  const file = path.join(ROOT, req.path);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

app.get('/pages/*', (req, res) => {
  const file = path.join(ROOT, req.path);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ── Error handling ───────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (max 20MB)' });
  }
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

// ── Start ─────────────────────────────────────────
async function start() {
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Seed initial data
    await seedData();

    if (isMongoConfigured()) {
      try {
        await connectMongo();
        await ensureMongoIndexes();
        await seedCmsContent();
        console.log('✅ MongoDB CMS prêt');
      } catch (mongoError) {
        if (getMongoConfig().required) throw mongoError;
        console.warn('⚠️  MongoDB CMS indisponible, NeDB reste actif :', mongoError.message);
      }
    } else {
      console.warn('⚠️  MONGODB_URI absent : CMS MongoDB structuré désactivé, NeDB reste actif.');
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════╗');
      console.log('║   🕌  Al Manarat Islamiyat — Serveur       ║');
      console.log(`║   ✅  http://localhost:${PORT}                ║`);
      console.log(`║   🔐  Admin: http://localhost:${PORT}/admin-site/ ║`);
      console.log('╚═══════════════════════════════════════════╝');
    });
  } catch (err) {
    console.error('❌ Erreur démarrage :', err);
    process.exit(1);
  }
}

start();
