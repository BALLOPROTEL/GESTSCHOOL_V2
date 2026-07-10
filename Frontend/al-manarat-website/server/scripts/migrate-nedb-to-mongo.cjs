#!/usr/bin/env node
'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Datastore = require('@seald-io/nedb');
const { LEGACY_COLLECTIONS } = require('../db/collection-names');
const { closeMongo, connectMongo, ensureMongoIndexes, getMongoDb } = require('../db/mongo');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const collections = [
  LEGACY_COLLECTIONS.admins,
  LEGACY_COLLECTIONS.settings,
  LEGACY_COLLECTIONS.articles,
  LEGACY_COLLECTIONS.events,
  LEGACY_COLLECTIONS.gallery,
  LEGACY_COLLECTIONS.applications,
  LEGACY_COLLECTIONS.contacts,
  LEGACY_COLLECTIONS.newsletter,
];

function loadNedbDocs(collectionName) {
  const filename = path.join(DATA_DIR, `${collectionName}.db`);
  if (!fs.existsSync(filename)) {
    return Promise.resolve({ collectionName, filename, docs: [], missing: true });
  }

  const datastore = new Datastore({ filename, autoload: true });
  return new Promise((resolve, reject) => {
    datastore.find({}, (error, docs) => {
      if (error) return reject(error);
      return resolve({ collectionName, filename, docs, missing: false });
    });
  });
}

function normalizeDoc(doc) {
  const copy = { ...doc };
  ['createdAt', 'updatedAt', 'publishedAt'].forEach(field => {
    if (copy[field] && !(copy[field] instanceof Date)) {
      const date = new Date(copy[field]);
      if (!Number.isNaN(date.getTime())) copy[field] = date;
    }
  });
  return copy;
}

async function migrateCollection(db, collectionName) {
  const source = await loadNedbDocs(collectionName);
  if (source.missing) {
    return { collectionName, read: 0, upserted: 0, skipped: true };
  }

  const collection = db.collection(collectionName);
  let upserted = 0;

  for (const doc of source.docs) {
    const normalized = normalizeDoc(doc);
    const filter = normalized._id ? { _id: normalized._id } : normalized;
    await collection.replaceOne(filter, normalized, { upsert: true });
    upserted += 1;
  }

  return { collectionName, read: source.docs.length, upserted, skipped: false };
}

async function main() {
  await connectMongo({ required: true });
  await ensureMongoIndexes();
  const db = await getMongoDb();
  const results = [];

  for (const collectionName of collections) {
    results.push(await migrateCollection(db, collectionName));
  }

  console.log('Migration NeDB -> MongoDB terminée. Aucun fichier NeDB supprimé.');
  results.forEach(result => {
    const suffix = result.skipped ? 'fichier absent' : `${result.upserted}/${result.read} document(s)`;
    console.log(`- ${result.collectionName}: ${suffix}`);
  });
}

main()
  .catch(error => {
    console.error('Migration NeDB -> MongoDB échouée:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeMongo());
