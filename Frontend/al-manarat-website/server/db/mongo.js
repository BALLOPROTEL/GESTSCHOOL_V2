'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const { CMS_COLLECTIONS, LEGACY_COLLECTIONS } = require('./collection-names');

let client = null;
let db = null;
let connectionPromise = null;

function isMongoConfigured() {
  return Boolean((process.env.MONGODB_URI || '').trim());
}

function getMongoConfig() {
  const uri = (process.env.MONGODB_URI || '').trim();
  const dbName = (process.env.MONGODB_DB_NAME || 'al_manarat_cms').trim();
  const appName = (process.env.MONGODB_APP_NAME || 'al-manarat-website').trim();
  const required = String(process.env.MONGODB_REQUIRED || '').toLowerCase() === 'true';

  return { uri, dbName, appName, required };
}

async function connectMongo(options = {}) {
  if (db) return db;

  const config = getMongoConfig();
  const required = options.required ?? config.required;

  if (!config.uri) {
    const message = 'MONGODB_URI is not configured; MongoDB CMS is disabled.';
    if (required) throw new Error(message);
    return null;
  }

  if (!connectionPromise) {
    client = new MongoClient(config.uri, {
      appName: config.appName,
      serverSelectionTimeoutMS: 5000,
    });

    connectionPromise = client
      .connect()
      .then(() => {
        db = client.db(config.dbName);
        return db;
      })
      .catch(error => {
        connectionPromise = null;
        client = null;
        db = null;
        throw error;
      });
  }

  try {
    return await connectionPromise;
  } catch (error) {
    if (required) throw error;
    console.warn('[MongoDB] CMS disabled:', error.message);
    return null;
  }
}

async function getMongoDb() {
  const connectedDb = await connectMongo({ required: true });
  if (!connectedDb) throw new Error('MongoDB CMS is not available.');
  return connectedDb;
}

async function getMongoCollection(name) {
  const connectedDb = await getMongoDb();
  return connectedDb.collection(name);
}

async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
  connectionPromise = null;
}

function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    const error = new Error('Identifiant MongoDB invalide.');
    error.statusCode = 400;
    throw error;
  }
  return new ObjectId(id);
}

async function ensureMongoIndexes() {
  const connectedDb = await connectMongo({ required: true });

  await Promise.all([
    connectedDb.collection(LEGACY_COLLECTIONS.settings).createIndex({ key: 1 }, { unique: true }),
    connectedDb.collection(LEGACY_COLLECTIONS.admins).createIndex({ email: 1 }, { unique: true }),
    connectedDb.collection(LEGACY_COLLECTIONS.articles).createIndex({ slug: 1 }, { unique: true, sparse: true }),
    connectedDb.collection(LEGACY_COLLECTIONS.events).createIndex({ slug: 1 }, { unique: true, sparse: true }),
    connectedDb.collection(LEGACY_COLLECTIONS.newsletter).createIndex({ email: 1 }, { unique: true, sparse: true }),

    connectedDb.collection(CMS_COLLECTIONS.pages).createIndex({ slug: 1 }, { unique: true }),
    connectedDb.collection(CMS_COLLECTIONS.sections).createIndex(
      { pageSlug: 1, sectionKey: 1 },
      { unique: true }
    ),
    connectedDb.collection(CMS_COLLECTIONS.sections).createIndex({ pageSlug: 1, order: 1 }),
    connectedDb.collection(CMS_COLLECTIONS.blocks).createIndex(
      { pageSlug: 1, sectionKey: 1, order: 1 },
      { unique: true }
    ),
    connectedDb.collection(CMS_COLLECTIONS.navigation).createIndex({ order: 1 }),
    connectedDb.collection(CMS_COLLECTIONS.footer).createIndex({ columnKey: 1 }, { unique: true }),
    connectedDb.collection(CMS_COLLECTIONS.media).createIndex({ filename: 1 }),
  ]);
}

module.exports = {
  closeMongo,
  connectMongo,
  ensureMongoIndexes,
  getMongoCollection,
  getMongoConfig,
  getMongoDb,
  isMongoConfigured,
  toObjectId,
};
