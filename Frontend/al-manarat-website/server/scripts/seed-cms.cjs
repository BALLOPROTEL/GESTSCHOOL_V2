#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { closeMongo, connectMongo, ensureMongoIndexes } = require('../db/mongo');
const { seedCmsContent } = require('../cms/seed');

async function main() {
  await connectMongo({ required: true });
  await ensureMongoIndexes();
  const summary = await seedCmsContent();
  console.log('Seed CMS MongoDB terminé :');
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`- ${key}: ${value}`);
  });
}

main()
  .catch(error => {
    console.error('Seed CMS MongoDB échoué:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeMongo());
