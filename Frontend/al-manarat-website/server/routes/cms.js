'use strict';

const express = require('express');
const { CMS_COLLECTIONS } = require('../db/collection-names');
const { getMongoCollection, toObjectId } = require('../db/mongo');
const { requireAuth } = require('../middleware/auth');
const {
  cleanSlug,
  makeBlock,
  makeFooterColumn,
  makeMedia,
  makeNavigationItem,
  makePage,
  makeSection,
  serializeDocument,
} = require('../cms/models');

const publicRouter = express.Router();
const adminRouter = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function handleCmsError(error, res) {
  const status = error.statusCode || 500;
  if (
    error.message.includes('MONGODB_URI') ||
    error.message.includes('MongoDB CMS') ||
    error.name === 'MongoServerSelectionError'
  ) {
    return res.status(503).json({
      error: 'CMS MongoDB indisponible',
      message: 'Configurez MONGODB_URI et MONGODB_DB_NAME pour activer le CMS structuré.',
    });
  }

  return res.status(status).json({ error: error.message || 'Erreur CMS' });
}

function withCmsErrors(fn) {
  return asyncHandler(async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      handleCmsError(error, res);
    }
  });
}

async function getCollection(key) {
  return getMongoCollection(CMS_COLLECTIONS[key]);
}

async function loadPagePayload(slug, adminMode = false) {
  const pageSlug = cleanSlug(slug);
  const [pages, sections, blocks] = await Promise.all([
    getCollection('pages'),
    getCollection('sections'),
    getCollection('blocks'),
  ]);

  const pageQuery = adminMode ? { slug: pageSlug } : { slug: pageSlug, status: 'published' };
  const page = await pages.findOne(pageQuery);
  if (!page) return null;

  const sectionQuery = adminMode ? { pageSlug } : { pageSlug, visible: true };
  const blockQuery = adminMode ? { pageSlug } : { pageSlug, visible: true };

  const [sectionDocs, blockDocs] = await Promise.all([
    sections.find(sectionQuery).sort({ order: 1, sectionKey: 1 }).toArray(),
    blocks.find(blockQuery).sort({ sectionKey: 1, order: 1 }).toArray(),
  ]);

  const blocksBySection = new Map();
  blockDocs.forEach(block => {
    const list = blocksBySection.get(block.sectionKey) || [];
    list.push(serializeDocument(block));
    blocksBySection.set(block.sectionKey, list);
  });

  return {
    page: serializeDocument(page),
    sections: sectionDocs.map(section => ({
      ...serializeDocument(section),
      blocks: blocksBySection.get(section.sectionKey) || [],
    })),
  };
}

publicRouter.get('/pages/:slug', withCmsErrors(async (req, res) => {
  const payload = await loadPagePayload(req.params.slug, false);
  if (!payload) return res.status(404).json({ error: 'Page CMS introuvable' });
  return res.json(payload);
}));

publicRouter.get('/navigation', withCmsErrors(async (req, res) => {
  const navigation = await getCollection('navigation');
  const items = await navigation.find({ visible: true }).sort({ order: 1, label: 1 }).toArray();
  return res.json(items.map(serializeDocument));
}));

publicRouter.get('/footer', withCmsErrors(async (req, res) => {
  const footer = await getCollection('footer');
  const columns = await footer.find({ visible: true }).sort({ order: 1, columnKey: 1 }).toArray();
  return res.json(columns.map(serializeDocument));
}));

adminRouter.use(requireAuth);

adminRouter.get('/pages', withCmsErrors(async (req, res) => {
  const pages = await getCollection('pages');
  const docs = await pages.find({}).sort({ slug: 1 }).toArray();
  return res.json(docs.map(serializeDocument));
}));

adminRouter.get('/pages/:slug', withCmsErrors(async (req, res) => {
  const payload = await loadPagePayload(req.params.slug, true);
  if (!payload) return res.status(404).json({ error: 'Page CMS introuvable' });
  return res.json(payload);
}));

adminRouter.put('/pages/:slug', withCmsErrors(async (req, res) => {
  const pages = await getCollection('pages');
  const slug = cleanSlug(req.params.slug);
  const existing = await pages.findOne({ slug });
  const doc = makePage({ ...req.body, slug }, existing, slug);
  await pages.updateOne({ slug }, { $set: doc }, { upsert: true });
  const saved = await pages.findOne({ slug });
  return res.json(serializeDocument(saved));
}));

adminRouter.post('/sections', withCmsErrors(async (req, res) => {
  const sections = await getCollection('sections');
  const doc = makeSection(req.body);
  await sections.insertOne(doc);
  return res.status(201).json(serializeDocument(doc));
}));

adminRouter.put('/sections/reorder', withCmsErrors(async (req, res) => {
  const sections = await getCollection('sections');
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const item of items) {
    await sections.updateOne(
      { _id: toObjectId(item.id) },
      { $set: { order: Number(item.order) || 0, updatedAt: new Date() } }
    );
  }
  return res.json({ updated: items.length });
}));

adminRouter.put('/sections/:id', withCmsErrors(async (req, res) => {
  const sections = await getCollection('sections');
  const _id = toObjectId(req.params.id);
  const existing = await sections.findOne({ _id });
  if (!existing) return res.status(404).json({ error: 'Section CMS introuvable' });
  const doc = makeSection({ ...existing, ...req.body }, existing);
  await sections.updateOne({ _id }, { $set: doc });
  const saved = await sections.findOne({ _id });
  return res.json(serializeDocument(saved));
}));

adminRouter.delete('/sections/:id', withCmsErrors(async (req, res) => {
  const sections = await getCollection('sections');
  const blocks = await getCollection('blocks');
  const _id = toObjectId(req.params.id);
  const existing = await sections.findOne({ _id });
  if (!existing) return res.status(404).json({ error: 'Section CMS introuvable' });
  await sections.deleteOne({ _id });
  await blocks.deleteMany({ pageSlug: existing.pageSlug, sectionKey: existing.sectionKey });
  return res.json({ deleted: true });
}));

adminRouter.post('/blocks', withCmsErrors(async (req, res) => {
  const blocks = await getCollection('blocks');
  const doc = makeBlock(req.body);
  await blocks.insertOne(doc);
  return res.status(201).json(serializeDocument(doc));
}));

adminRouter.put('/blocks/reorder', withCmsErrors(async (req, res) => {
  const blocks = await getCollection('blocks');
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const item of items) {
    await blocks.updateOne(
      { _id: toObjectId(item.id) },
      { $set: { order: Number(item.order) || 0, updatedAt: new Date() } }
    );
  }
  return res.json({ updated: items.length });
}));

adminRouter.put('/blocks/:id', withCmsErrors(async (req, res) => {
  const blocks = await getCollection('blocks');
  const _id = toObjectId(req.params.id);
  const existing = await blocks.findOne({ _id });
  if (!existing) return res.status(404).json({ error: 'Block CMS introuvable' });
  const doc = makeBlock({ ...existing, ...req.body }, existing);
  await blocks.updateOne({ _id }, { $set: doc });
  const saved = await blocks.findOne({ _id });
  return res.json(serializeDocument(saved));
}));

adminRouter.delete('/blocks/:id', withCmsErrors(async (req, res) => {
  const blocks = await getCollection('blocks');
  const result = await blocks.deleteOne({ _id: toObjectId(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ error: 'Block CMS introuvable' });
  return res.json({ deleted: true });
}));

function crudRoutes(pathName, key, makeDoc, filterFromDoc) {
  adminRouter.get(`/${pathName}`, withCmsErrors(async (req, res) => {
    const collection = await getCollection(key);
    const docs = await collection.find({}).sort({ order: 1, createdAt: -1 }).toArray();
    return res.json(docs.map(serializeDocument));
  }));

  adminRouter.post(`/${pathName}`, withCmsErrors(async (req, res) => {
    const collection = await getCollection(key);
    const doc = makeDoc(req.body);
    await collection.updateOne(filterFromDoc(doc), { $setOnInsert: doc }, { upsert: true });
    const saved = await collection.findOne(filterFromDoc(doc));
    return res.status(201).json(serializeDocument(saved));
  }));

  adminRouter.put(`/${pathName}/:id`, withCmsErrors(async (req, res) => {
    const collection = await getCollection(key);
    const _id = toObjectId(req.params.id);
    const existing = await collection.findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Ressource CMS introuvable' });
    const doc = makeDoc({ ...existing, ...req.body }, existing);
    await collection.updateOne({ _id }, { $set: doc });
    const saved = await collection.findOne({ _id });
    return res.json(serializeDocument(saved));
  }));

  adminRouter.delete(`/${pathName}/:id`, withCmsErrors(async (req, res) => {
    const collection = await getCollection(key);
    const result = await collection.deleteOne({ _id: toObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Ressource CMS introuvable' });
    return res.json({ deleted: true });
  }));
}

crudRoutes('navigation', 'navigation', makeNavigationItem, doc => ({ label: doc.label, url: doc.url }));
crudRoutes('footer', 'footer', makeFooterColumn, doc => ({ columnKey: doc.columnKey }));
crudRoutes('media', 'media', makeMedia, doc => ({ filename: doc.filename, url: doc.url }));

module.exports = {
  adminRouter,
  publicRouter,
};
