// ════════════════════════════════════════════════════
//  Al Manarat Islamiyat — Database (NeDB, pure JS)
//  Aucune dépendance native requise
// ════════════════════════════════════════════════════
'use strict';

const Datastore = require('@seald-io/nedb');
const bcrypt    = require('bcryptjs');
const path      = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const GESTSCHOOL_BASE_PATH = process.env.GESTSCHOOL_BASE_PATH || '/gestion';
const DEFAULT_GESTSCHOOL_URL =
  process.env.GESTSCHOOL_URL ||
  process.env.GESTSCHOOL_PUBLIC_URL ||
  `${GESTSCHOOL_BASE_PATH.replace(/\/$/, '')}/login`;
const CMS_ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || 'admin@almanarat.sn';
const CMS_ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || '';

// ── Créer les collections ─────────────────────────
const collections = {
  admins:        new Datastore({ filename: path.join(DB_DIR, 'admins.db'),        autoload: true }),
  articles:      new Datastore({ filename: path.join(DB_DIR, 'articles.db'),      autoload: true }),
  events:        new Datastore({ filename: path.join(DB_DIR, 'events.db'),        autoload: true }),
  gallery:       new Datastore({ filename: path.join(DB_DIR, 'gallery.db'),       autoload: true }),
  applications:  new Datastore({ filename: path.join(DB_DIR, 'applications.db'),  autoload: true }),
  contacts:      new Datastore({ filename: path.join(DB_DIR, 'contacts.db'),      autoload: true }),
  newsletter:    new Datastore({ filename: path.join(DB_DIR, 'newsletter.db'),    autoload: true }),
  settings:      new Datastore({ filename: path.join(DB_DIR, 'settings.db'),      autoload: true }),
};

// ── Indexes ──────────────────────────────────────
collections.admins.ensureIndex({ fieldName: 'email', unique: true });
collections.articles.ensureIndex({ fieldName: 'slug', unique: true });
collections.events.ensureIndex({ fieldName: 'slug', unique: true });
collections.newsletter.ensureIndex({ fieldName: 'email', unique: true });
collections.settings.ensureIndex({ fieldName: 'key', unique: true });

// ── Helper: promisify findOne ─────────────────────
function findOne(col, query) {
  return new Promise((resolve, reject) => {
    col.findOne(query, (err, doc) => err ? reject(err) : resolve(doc));
  });
}

// ── Seed initial data ─────────────────────────────
async function seedData() {
  const { admins, articles, events, gallery, settings } = collections;

  // Admin
  const existing = await findOne(admins, { email: CMS_ADMIN_EMAIL });
  if (!existing) {
    if (!CMS_ADMIN_PASSWORD) {
      throw new Error('CMS_ADMIN_PASSWORD must be configured before seeding the public site admin.');
    }

    const hash = bcrypt.hashSync(CMS_ADMIN_PASSWORD, 10);
    admins.insert({
      username: 'admin',
      email:    CMS_ADMIN_EMAIL,
      password: hash,
      role:     'superadmin',
      createdAt: new Date()
    });
    console.log(`✅ Admin CMS créé : ${CMS_ADMIN_EMAIL}`);
  }

  // Site settings
  const defaults = [
    // ── Identité ──
    { key: 'school_name',    value: 'Al Manarat Islamiyat' },
    { key: 'school_slogan',  value: "L'École du Phare — Lumière du Savoir" },
    { key: 'school_address', value: 'Cité Al Manarat, Quartier Liberté 6, Dakar, Sénégal' },
    { key: 'school_phone',   value: '+221 77 123 45 67' },
    { key: 'school_phone2',  value: '+221 33 456 78 90' },
    { key: 'school_email',   value: 'info@almanarat.sn' },
    { key: 'school_email2',  value: 'inscriptions@almanarat.sn' },
    { key: 'school_hours',   value: 'Lun – Ven : 8h00 – 16h00 | Sam : 9h00 – 12h00' },
    { key: 'school_founded', value: '2005' },
    { key: 'logo_path',      value: '' },
    // ── Réseaux sociaux ──
    { key: 'facebook_url',   value: '' },
    { key: 'whatsapp_url',   value: '' },
    { key: 'youtube_url',    value: '' },
    { key: 'instagram_url',  value: '' },
    { key: 'twitter_url',    value: '' },
    { key: 'tiktok_url',     value: '' },
    // ── Footer ──
    { key: 'footer_tagline',   value: "« Demandez le savoir, de la naissance jusqu'à la mort. » — Hadith du Prophète ﷺ" },
    { key: 'footer_copyright', value: '© 2025 Al Manarat Islamiyat. Tous droits réservés.' },
    // ── GestSchool ──
    { key: 'gestschool_url', value: DEFAULT_GESTSCHOOL_URL },
  ];
  for (const d of defaults) {
    const ex = await findOne(settings, { key: d.key });
    if (!ex) settings.insert({ ...d, updatedAt: new Date() });
  }

  // Sample articles
  const artCount = await new Promise(r => articles.count({}, (_, n) => r(n)));
  if (artCount === 0) {
    articles.insert([
      {
        title: '95% de réussite au BFEM 2025',
        slug:  'bfem-2025-resultats',
        excerpt: 'Une nouvelle année d\'excellence pour les élèves d\'Al Manarat.',
        content: '<p>Nous sommes fiers d\'annoncer que nos élèves du cycle moyen ont obtenu un taux de réussite exceptionnel de 95% au BFEM 2025. Cette réussite témoigne du travail acharné de nos élèves et du dévouement de notre corps enseignant.</p>',
        category: 'resultats', cover_image: null, status: 'published',
        author: 'Administration', publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        title: 'Ouverture des inscriptions 2025-2026',
        slug:  'inscriptions-2025-2026',
        excerpt: 'Les dossiers de candidature pour l\'année scolaire 2025-2026 sont maintenant ouverts.',
        content: '<p>L\'école Al Manarat Islamiyat ouvre officiellement ses inscriptions pour l\'année scolaire 2025-2026. Les parents souhaitant inscrire leurs enfants peuvent déposer leurs dossiers au secrétariat ou via notre formulaire en ligne.</p>',
        category: 'admissions', cover_image: null, status: 'published',
        author: 'Secrétariat', publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        title: 'Concours de récitation du Coran — Résultats',
        slug:  'concours-coran-resultats',
        excerpt: 'Nos élèves brillent au concours inter-écoles de récitation.',
        content: '<p>Alhamdulillah ! Nos élèves ont remporté le premier prix du concours inter-écoles de récitation du Coran organisé à Dakar.</p>',
        category: 'evenements', cover_image: '/assets/graduation.png', status: 'published',
        author: 'Administration',
        publishedAt: new Date(Date.now() - 7*24*60*60*1000),
        createdAt: new Date(), updatedAt: new Date()
      }
    ]);
  }

  // Sample events
  const evCount = await new Promise(r => events.count({}, (_, n) => r(n)));
  if (evCount === 0) {
    events.insert([
      { title: 'Grande Cérémonie de Remise des Diplômes 2025', slug: 'ceremonie-diplomes-2025', description: 'Célébration de la promotion 2025 : diplômés du BFEM, du Baccalauréat et du cycle Hifz.', date: '2025-07-15', time: '09:00 – 13:00', location: 'Salle des Fêtes Al Manarat', image: '/assets/graduation.png', is_featured: true, status: 'upcoming', createdAt: new Date() },
      { title: 'Concours Inter-Écoles de Récitation du Coran', slug: 'concours-coran-2025', description: 'Les meilleurs récitants de la région s\'affrontent dans un concours de Hifz et de Tadjwid.', date: '2025-06-28', time: '08:30 – 17:00', location: 'Mosquée Centrale Al Manarat', image: '/assets/quran.png', is_featured: false, status: 'upcoming', createdAt: new Date() },
      { title: 'Tournoi de Football Scolaire', slug: 'tournoi-football-2025', description: 'Journée sportive annuelle avec tournoi de football et jeux collectifs.', date: '2025-07-05', time: '07:30 – 16:00', location: 'Terrain Sportif Al Manarat', image: '/assets/sports.png', is_featured: false, status: 'upcoming', createdAt: new Date() },
      { title: 'Rentrée Scolaire 2025-2026', slug: 'rentree-2025-2026', description: 'Accueil des nouveaux élèves et séance d\'intégration.', date: '2025-08-20', time: '08:00 – 12:00', location: 'Cour principale de l\'école', image: null, is_featured: false, status: 'upcoming', createdAt: new Date() },
      { title: 'Journée Portes Ouvertes', slug: 'portes-ouvertes-2025', description: 'Rencontrez nos enseignants et visitez nos installations.', date: '2025-10-10', time: '09:00 – 16:00', location: 'Toutes les salles de l\'école', image: null, is_featured: false, status: 'upcoming', createdAt: new Date() },
    ]);
  }

  // Sample gallery
  const galCount = await new Promise(r => gallery.count({}, (_, n) => r(n)));
  if (galCount === 0) {
    gallery.insert([
      { title: 'Cérémonie de Graduation 2024', description: 'La promotion 2024 reçoit ses diplômes', file_path: '/assets/graduation.png', file_type: 'image', category: 'evenements', is_published: true, sort_order: 1, createdAt: new Date() },
      { title: 'Atelier de Mémorisation Coran', description: 'Séance de Hifz', file_path: '/assets/quran.png', file_type: 'image', category: 'coran', is_published: true, sort_order: 2, createdAt: new Date() },
      { title: 'Séance d\'Apprentissage', description: 'Élèves en cours', file_path: '/assets/students.png', file_type: 'image', category: 'classes', is_published: true, sort_order: 3, createdAt: new Date() },
      { title: 'Journée Sportive', description: 'Tournoi annuel', file_path: '/assets/sports.png', file_type: 'image', category: 'sport', is_published: true, sort_order: 4, createdAt: new Date() },
    ]);
  }

  console.log('✅ Base de données prête');
}

module.exports = { collections, seedData };
