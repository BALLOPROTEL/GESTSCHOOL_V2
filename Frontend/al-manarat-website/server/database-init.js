// Réexporte les éléments de database.js pour compatibilité avec index.js
'use strict';
const { collections, seedData } = require('./database');

function initializeDataDir() {
  // NeDB gère automatiquement la création des fichiers
  return Promise.resolve();
}

module.exports = { collections, seedData, initializeDataDir };
