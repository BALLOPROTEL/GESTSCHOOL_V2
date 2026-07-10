'use strict';

const { CMS_COLLECTIONS } = require('../db/collection-names');
const { getMongoDb } = require('../db/mongo');
const {
  makeBlock,
  makeFooterColumn,
  makeMedia,
  makeNavigationItem,
  makePage,
  makeSection,
} = require('./models');
const seedContent = require('./seed-content');

const refreshExistingSeed = (process.env.CMS_SEED_REFRESH || '').trim().toLowerCase() === 'true';

async function upsertSeed(collection, filter, doc) {
  if (!refreshExistingSeed) {
    await collection.updateOne(filter, { $setOnInsert: doc }, { upsert: true });
    return;
  }

  const { createdAt, ...updates } = doc;
  await collection.updateOne(
    filter,
    {
      $set: updates,
      $setOnInsert: { createdAt },
    },
    { upsert: true }
  );
}

async function seedCmsContent() {
  const db = await getMongoDb();
  const summary = {
    pages: 0,
    sections: 0,
    blocks: 0,
    navigation: 0,
    footer: 0,
    media: 0,
  };

  const pages = db.collection(CMS_COLLECTIONS.pages);
  for (const page of seedContent.pages) {
    await upsertSeed(pages, { slug: page.slug }, makePage(page));
    summary.pages += 1;
  }

  const sections = db.collection(CMS_COLLECTIONS.sections);
  for (const section of seedContent.sections) {
    const doc = makeSection(section);
    await upsertSeed(sections, { pageSlug: doc.pageSlug, sectionKey: doc.sectionKey }, doc);
    summary.sections += 1;
  }

  const blocks = db.collection(CMS_COLLECTIONS.blocks);
  for (const block of seedContent.blocks) {
    const doc = makeBlock(block);
    await upsertSeed(
      blocks,
      { pageSlug: doc.pageSlug, sectionKey: doc.sectionKey, order: doc.order },
      doc
    );
    summary.blocks += 1;
  }

  const navigation = db.collection(CMS_COLLECTIONS.navigation);
  for (const item of seedContent.navigation) {
    const doc = makeNavigationItem(item);
    await upsertSeed(navigation, { label: doc.label, url: doc.url }, doc);
    summary.navigation += 1;
  }

  const footer = db.collection(CMS_COLLECTIONS.footer);
  for (const column of seedContent.footer) {
    const doc = makeFooterColumn(column);
    await upsertSeed(footer, { columnKey: doc.columnKey }, doc);
    summary.footer += 1;
  }

  const media = db.collection(CMS_COLLECTIONS.media);
  for (const item of seedContent.media) {
    const doc = makeMedia(item);
    await upsertSeed(media, { filename: doc.filename, url: doc.url }, doc);
    summary.media += 1;
  }

  return summary;
}

module.exports = { seedCmsContent };
