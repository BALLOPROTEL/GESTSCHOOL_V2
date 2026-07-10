'use strict';

const LEGACY_COLLECTIONS = Object.freeze({
  admins: 'admins',
  articles: 'articles',
  events: 'events',
  gallery: 'gallery',
  applications: 'applications',
  contacts: 'contacts',
  newsletter: 'newsletter',
  settings: 'settings',
});

const CMS_COLLECTIONS = Object.freeze({
  pages: 'cms_pages',
  sections: 'cms_sections',
  blocks: 'cms_blocks',
  navigation: 'cms_navigation',
  footer: 'cms_footer',
  media: 'cms_media',
});

module.exports = {
  LEGACY_COLLECTIONS,
  CMS_COLLECTIONS,
};
