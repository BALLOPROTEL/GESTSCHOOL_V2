# Al Manarat Website - MongoDB CMS

## Decision

The public Al Manarat website is moving from local NeDB files to MongoDB Atlas for all CMS and public-site data. The migration is progressive: existing NeDB routes still run until each module is migrated and verified.

The server uses the official MongoDB Node.js driver instead of Mongoose. This keeps the Express/vanilla stack simple, avoids an extra modeling layer, and centralizes validation in small server-side CMS model helpers.

## Environment

Required to enable MongoDB CMS:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
MONGODB_DB_NAME=AlManaratDB
MONGODB_APP_NAME=al-manarat-website
```

Optional:

```env
MONGODB_REQUIRED=false
```

Use `MONGODB_REQUIRED=true` in production once Atlas is mandatory. Without `MONGODB_URI`, the server keeps NeDB active and the structured CMS routes return `503`.

Never commit real MongoDB credentials.

## Collections

Legacy collections targeted for progressive migration:

- `admins`
- `articles`
- `events`
- `gallery`
- `applications`
- `contacts`
- `newsletter`
- `settings`

## Current NeDB Data Audit

Current NeDB files:

- `admins.db`
- `applications.db`
- `articles.db`
- `contacts.db`
- `events.db`
- `gallery.db`
- `newsletter.db`
- `settings.db`

Routes currently using NeDB directly:

- `routes/auth.js` -> `admins`
- `routes/settings.js` -> `settings`, plus dashboard counts across all collections
- `routes/articles.js` -> `articles`
- `routes/events.js` -> `events`
- `routes/gallery.js` -> `gallery`
- `routes/applications.js` -> `applications`
- `routes/contacts.js` -> `contacts`
- `routes/newsletter.js` -> `newsletter`

NeDB methods currently used:

- `find`
- `findOne`
- `insert`
- `update`
- `remove`
- `count`
- `sort`
- `limit`
- `exec`

Current seed content in `server/database.js`:

- admin account from `CMS_ADMIN_EMAIL` / `CMS_ADMIN_PASSWORD`
- global settings
- home hero/stats/footer settings
- about/schooling/admissions settings
- sample articles
- sample events
- sample gallery items

Migration risks:

- NeDB `_id` values are strings; MongoDB can keep them as string `_id`, but new CMS documents use `ObjectId`.
- Public and admin pages expect current JSON response shapes, so route migration must preserve API contracts.
- Upload file paths must remain stable.
- Admin auth must not expose or migrate weak credentials; production must set `CMS_ADMIN_PASSWORD`.
- NeDB files must not be deleted automatically.

Structured CMS collections:

- `cms_pages`
- `cms_sections`
- `cms_blocks`
- `cms_navigation`
- `cms_footer`
- `cms_media`

## Structured CMS Models

`cms_pages`

- `_id`
- `slug`
- `title`
- `metaTitle`
- `metaDescription`
- `status`
- `createdAt`
- `updatedAt`

`cms_sections`

- `_id`
- `pageSlug`
- `sectionKey`
- `type`
- `title`
- `subtitle`
- `body`
- `mediaId`
- `buttons`
- `order`
- `visible`
- `metadata`
- `createdAt`
- `updatedAt`

`cms_blocks`

- `_id`
- `pageSlug`
- `sectionKey`
- `type`
- `title`
- `subtitle`
- `body`
- `mediaId`
- `url`
- `icon`
- `order`
- `visible`
- `metadata`
- `createdAt`
- `updatedAt`

`cms_navigation`

- `_id`
- `label`
- `url`
- `order`
- `visible`
- `target`
- `type`
- `createdAt`
- `updatedAt`

`cms_footer`

- `_id`
- `columnKey`
- `title`
- `content`
- `links`
- `order`
- `visible`
- `createdAt`
- `updatedAt`

`cms_media`

- `_id`
- `filename`
- `url`
- `mimeType`
- `type`
- `alt`
- `caption`
- `size`
- `createdAt`
- `updatedAt`

## Indexes

Created by `server/db/mongo.js`:

- `settings.key`, unique
- `admins.email`, unique
- `articles.slug`, unique sparse
- `events.slug`, unique sparse
- `newsletter.email`, unique sparse
- `cms_pages.slug`, unique
- `cms_sections.pageSlug + sectionKey`, unique
- `cms_sections.pageSlug + order`
- `cms_blocks.pageSlug + sectionKey + order`, unique
- `cms_navigation.order`
- `cms_footer.columnKey`, unique
- `cms_media.filename`

## Commands

From `Frontend/al-manarat-website/server`:

```bash
npm run cms:seed
npm run migrate:nedb-to-mongo
npm start
```

`cms:seed` creates the structured CMS baseline. It is idempotent and uses `$setOnInsert`, so existing customized CMS documents are preserved.

If a database was already initialized with an older seed and you intentionally want to refresh the editorial baseline, run:

```bash
CMS_SEED_REFRESH=true npm run cms:seed
```

Use this refresh mode before production content editing, or after a backup, because it updates existing CMS seed documents.

`migrate:nedb-to-mongo` reads local `data/*.db`, upserts documents into MongoDB, and never deletes NeDB files.

The Phase 3 seed migrates the hardcoded editorial baseline into Mongo CMS documents:

- 9 public pages: `home`, `about`, `schooling`, `admissions`, `contact`, `school-access`, `news`, `events`, `gallery`
- 33 sections covering page headers, home hero, programs, school life, admissions process, contact, school access, news/events/gallery intros
- 38 structured blocks for programs, values, team, school levels, FAQ, admission steps, required documents, testimonials and contact cards
- navigation and footer baseline

## API Routes

Public:

- `GET /api/site/cms/pages/:slug`
- `GET /api/site/cms/navigation`
- `GET /api/site/cms/footer`

Admin, protected by JWT:

- `GET /api/site/admin/cms/pages`
- `GET /api/site/admin/cms/pages/:slug`
- `PUT /api/site/admin/cms/pages/:slug`
- `POST /api/site/admin/cms/sections`
- `PUT /api/site/admin/cms/sections/:id`
- `DELETE /api/site/admin/cms/sections/:id`
- `PUT /api/site/admin/cms/sections/reorder`
- `POST /api/site/admin/cms/blocks`
- `PUT /api/site/admin/cms/blocks/:id`
- `DELETE /api/site/admin/cms/blocks/:id`
- `PUT /api/site/admin/cms/blocks/reorder`
- CRUD basic routes for `navigation`, `footer`, and `media`

## Current Limits

- Existing articles, events, gallery, settings, applications, contacts, newsletter, and auth routes still use NeDB.
- Public pages keep their static HTML as safe fallback, then progressively apply Mongo CMS navigation, footer and page sections when MongoDB is configured.
- `admin-site/contenus.html` now includes a structured CMS tab for editing pages and sections. Blocks, navigation, footer and media still need richer dedicated editors.
- Rich HTML editing is not enabled in this phase; server models store text and structured metadata.

## Phase 3 Done

- Hardcoded editorial content was moved into a clean CMS seed.
- Public rendering loads CMS content without dangerous `innerHTML` for CMS text.
- Invisible CMS sections can hide matching public sections through `data-cms-section`.
- The admin content page can list CMS pages, select sections and edit title, subtitle, body, type, order and visibility.

## Next Phase

- Add dedicated block editors for programs, team members, FAQ, admission steps and contact cards.
- Add navigation/footer/media editors.
- Move settings/articles/events/gallery/applications/contacts/newsletter routes to the shared Mongo data layer when the structured CMS is stable.
- Add route-level tests for Mongo available/unavailable modes.
