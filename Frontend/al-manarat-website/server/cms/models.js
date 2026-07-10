'use strict';

const PAGE_STATUSES = new Set(['draft', 'published', 'archived']);
const TARGETS = new Set(['_self', '_blank']);

function now() {
  return new Date();
}

function cleanString(value, fallback = '', max = 5000) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
}

function cleanSlug(value) {
  const slug = cleanString(value, '', 120)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    const error = new Error('Slug CMS invalide.');
    error.statusCode = 400;
    throw error;
  }

  return slug;
}

function cleanKey(value, fallback = '') {
  return cleanString(value, fallback, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanStatus(value, fallback = 'draft') {
  const status = cleanString(value, fallback, 40);
  return PAGE_STATUSES.has(status) ? status : fallback;
}

function cleanBool(value, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanOrder(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function cleanButtons(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map(button => ({
    label: cleanString(button?.label, '', 120),
    url: cleanString(button?.url, '', 500),
    target: TARGETS.has(button?.target) ? button.target : '_self',
    variant: cleanString(button?.variant, 'primary', 40),
  })).filter(button => button.label && button.url);
}

function cleanLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(link => ({
    label: cleanString(link?.label, '', 120),
    url: cleanString(link?.url, '', 500),
    target: TARGETS.has(link?.target) ? link.target : '_self',
  })).filter(link => link.label && link.url);
}

function makePage(input = {}, existing = null, forcedSlug = null) {
  const date = now();
  const slug = cleanSlug(forcedSlug || input.slug);

  return {
    slug,
    title: cleanString(input.title, existing?.title || slug, 180),
    metaTitle: cleanString(input.metaTitle, existing?.metaTitle || '', 180),
    metaDescription: cleanString(input.metaDescription, existing?.metaDescription || '', 320),
    status: cleanStatus(input.status, existing?.status || 'draft'),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function makeSection(input = {}, existing = null) {
  const date = now();
  const pageSlug = cleanSlug(input.pageSlug || existing?.pageSlug);
  const sectionKey = cleanKey(input.sectionKey || existing?.sectionKey);
  if (!sectionKey) {
    const error = new Error('sectionKey CMS invalide.');
    error.statusCode = 400;
    throw error;
  }

  return {
    pageSlug,
    sectionKey,
    type: cleanString(input.type, existing?.type || 'content', 80),
    title: cleanString(input.title, existing?.title || '', 240),
    subtitle: cleanString(input.subtitle, existing?.subtitle || '', 500),
    body: cleanString(input.body, existing?.body || '', 12000),
    mediaId: cleanString(input.mediaId, existing?.mediaId || '', 120),
    buttons: cleanButtons(input.buttons ?? existing?.buttons),
    order: cleanOrder(input.order, existing?.order || 0),
    visible: cleanBool(input.visible, existing?.visible ?? true),
    metadata: cleanObject(input.metadata ?? existing?.metadata),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function makeBlock(input = {}, existing = null) {
  const date = now();
  const pageSlug = cleanSlug(input.pageSlug || existing?.pageSlug);
  const sectionKey = cleanKey(input.sectionKey || existing?.sectionKey);
  if (!sectionKey) {
    const error = new Error('sectionKey CMS invalide.');
    error.statusCode = 400;
    throw error;
  }

  return {
    pageSlug,
    sectionKey,
    type: cleanString(input.type, existing?.type || 'text', 80),
    title: cleanString(input.title, existing?.title || '', 240),
    subtitle: cleanString(input.subtitle, existing?.subtitle || '', 500),
    body: cleanString(input.body, existing?.body || '', 12000),
    mediaId: cleanString(input.mediaId, existing?.mediaId || '', 120),
    url: cleanString(input.url, existing?.url || '', 500),
    icon: cleanString(input.icon, existing?.icon || '', 80),
    order: cleanOrder(input.order, existing?.order || 0),
    visible: cleanBool(input.visible, existing?.visible ?? true),
    metadata: cleanObject(input.metadata ?? existing?.metadata),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function makeNavigationItem(input = {}, existing = null) {
  const date = now();
  return {
    label: cleanString(input.label, existing?.label || '', 120),
    url: cleanString(input.url, existing?.url || '#', 500),
    order: cleanOrder(input.order, existing?.order || 0),
    visible: cleanBool(input.visible, existing?.visible ?? true),
    target: TARGETS.has(input.target) ? input.target : (existing?.target || '_self'),
    type: cleanString(input.type, existing?.type || 'main', 80),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function makeFooterColumn(input = {}, existing = null) {
  const date = now();
  const columnKey = cleanKey(input.columnKey || existing?.columnKey);
  if (!columnKey) {
    const error = new Error('columnKey CMS invalide.');
    error.statusCode = 400;
    throw error;
  }

  return {
    columnKey,
    title: cleanString(input.title, existing?.title || '', 180),
    content: cleanString(input.content, existing?.content || '', 6000),
    links: cleanLinks(input.links ?? existing?.links),
    order: cleanOrder(input.order, existing?.order || 0),
    visible: cleanBool(input.visible, existing?.visible ?? true),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function makeMedia(input = {}, existing = null) {
  const date = now();
  return {
    filename: cleanString(input.filename, existing?.filename || '', 240),
    url: cleanString(input.url, existing?.url || '', 500),
    mimeType: cleanString(input.mimeType, existing?.mimeType || '', 120),
    type: cleanString(input.type, existing?.type || 'image', 80),
    alt: cleanString(input.alt, existing?.alt || '', 240),
    caption: cleanString(input.caption, existing?.caption || '', 500),
    size: cleanOrder(input.size, existing?.size || 0),
    createdAt: existing?.createdAt || date,
    updatedAt: date,
  };
}

function serializeDocument(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    id: String(doc._id),
    _id: String(doc._id),
  };
}

module.exports = {
  cleanSlug,
  makeBlock,
  makeFooterColumn,
  makeMedia,
  makeNavigationItem,
  makePage,
  makeSection,
  serializeDocument,
};
