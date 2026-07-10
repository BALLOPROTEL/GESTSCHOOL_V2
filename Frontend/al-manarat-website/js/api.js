// ════════════════════════════════════════════════
//  Al Manarat — API Client (js/api.js)
//  Centralise tous les appels HTTP vers /api/site
// ════════════════════════════════════════════════

const SITE_API_BASE_PATH =
  window.SITE_API_BASE_PATH ||
  window.__AL_MANARAT_SITE_API_BASE__ ||
  '/api/site';
const API_BASE = new URL(SITE_API_BASE_PATH, window.location.origin).href.replace(/\/$/, '');

const API = {
  url(path = '') {
    const normalizedPath = String(path).startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalizedPath}`;
  },

  // ── Auth header helper ─────────────────────
  _headers(includeAuth = false) {
    const h = { 'Content-Type': 'application/json' };
    if (includeAuth) {
      const token = localStorage.getItem('am_token');
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  },

  // ── Generic fetch wrapper ──────────────────
  async _fetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const ct  = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
      return data;
    } catch (e) {
      console.error('[API]', e.message);
      throw e;
    }
  },

  // ── Public endpoints ───────────────────────

  getSettings() {
    return this._fetch(this.url('/settings/public'));
  },

  getArticles(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/articles')}${q ? '?' + q : ''}`);
  },

  getArticle(slug) {
    return this._fetch(this.url(`/articles/${slug}`));
  },

  getEvents(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/events')}${q ? '?' + q : ''}`);
  },

  getEvent(slug) {
    return this._fetch(this.url(`/events/${slug}`));
  },

  getGallery(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/gallery')}${q ? '?' + q : ''}`);
  },

  submitApplication(formData) {
    return this._fetch(this.url('/applications'), {
      method: 'POST',
      body: formData // FormData (multipart)
    });
  },

  submitContact(data) {
    return this._fetch(this.url('/contacts'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(data)
    });
  },

  subscribeNewsletter(email) {
    return this._fetch(this.url('/newsletter'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ email })
    });
  },

  // ── Admin endpoints ────────────────────────

  adminLogin(email, password) {
    return this._fetch(this.url('/admin/login'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ email, password })
    });
  },

  adminChangePassword(data) {
    return this._fetch(this.url('/admin/change-password'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },

  // Stats
  getStats() {
    return this._fetch(this.url('/settings/admin/stats'), { headers: this._headers(true) });
  },

  // Articles admin
  adminGetArticles(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/articles/admin/all')}${q ? '?' + q : ''}`, { headers: this._headers(true) });
  },
  adminCreateArticle(formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url('/articles'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminUpdateArticle(id, formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url(`/articles/${id}`), {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminDeleteArticle(id) {
    return this._fetch(this.url(`/articles/${id}`), { method: 'DELETE', headers: this._headers(true) });
  },
  adminToggleArticle(id) {
    return this._fetch(this.url(`/articles/${id}/publish`), { method: 'PATCH', headers: this._headers(true) });
  },

  // Events admin
  adminGetEvents() {
    return this._fetch(this.url('/events/admin/all'), { headers: this._headers(true) });
  },
  adminCreateEvent(formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url('/events'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminUpdateEvent(id, formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url(`/events/${id}`), {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminDeleteEvent(id) {
    return this._fetch(this.url(`/events/${id}`), { method: 'DELETE', headers: this._headers(true) });
  },

  // Gallery admin
  adminGetGallery() {
    return this._fetch(this.url('/gallery/admin/all'), { headers: this._headers(true) });
  },
  adminUploadMedia(formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url('/gallery'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminUpdateMedia(id, formData) {
    const token = localStorage.getItem('am_token');
    return this._fetch(this.url(`/gallery/${id}`), {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  },
  adminDeleteMedia(id) {
    return this._fetch(this.url(`/gallery/${id}`), { method: 'DELETE', headers: this._headers(true) });
  },
  adminToggleMedia(id) {
    return this._fetch(this.url(`/gallery/${id}/toggle`), { method: 'PATCH', headers: this._headers(true) });
  },

  // Applications admin
  adminGetApplications(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/applications/admin/all')}${q ? '?' + q : ''}`, { headers: this._headers(true) });
  },
  adminGetApplication(id) {
    return this._fetch(this.url(`/applications/admin/${id}`), { headers: this._headers(true) });
  },
  adminUpdateApplication(id, data) {
    return this._fetch(this.url(`/applications/admin/${id}`), {
      method: 'PATCH', headers: this._headers(true), body: JSON.stringify(data)
    });
  },

  // Contacts admin
  adminGetContacts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch(`${this.url('/contacts/admin/all')}${q ? '?' + q : ''}`, { headers: this._headers(true) });
  },
  adminToggleRead(id) {
    return this._fetch(this.url(`/contacts/admin/${id}/read`), { method: 'PATCH', headers: this._headers(true) });
  },
  adminDeleteContact(id) {
    return this._fetch(this.url(`/contacts/admin/${id}`), { method: 'DELETE', headers: this._headers(true) });
  },

  // Newsletter admin
  adminGetNewsletter() {
    return this._fetch(this.url('/newsletter/admin/all'), { headers: this._headers(true) });
  },
  adminDeleteSubscriber(id) {
    return this._fetch(this.url(`/newsletter/admin/${id}`), { method: 'DELETE', headers: this._headers(true) });
  },

  // Settings admin
  adminGetSettings() {
    return this._fetch(this.url('/settings/admin/all'), { headers: this._headers(true) });
  },
  adminSaveSettings(data) {
    return this._fetch(this.url('/settings/admin'), {
      method: 'PUT', headers: this._headers(true), body: JSON.stringify(data)
    });
  },

  // CMS public
  getCmsPage(slug) {
    return this._fetch(this.url(`/cms/pages/${encodeURIComponent(slug)}`));
  },
  getCmsNavigation() {
    return this._fetch(this.url('/cms/navigation'));
  },
  getCmsFooter() {
    return this._fetch(this.url('/cms/footer'));
  },

  // CMS admin
  adminCmsListPages() {
    return this._fetch(this.url('/admin/cms/pages'), { headers: this._headers(true) });
  },
  adminCmsGetPage(slug) {
    return this._fetch(this.url(`/admin/cms/pages/${encodeURIComponent(slug)}`), {
      headers: this._headers(true)
    });
  },
  adminCmsUpdatePage(slug, data) {
    return this._fetch(this.url(`/admin/cms/pages/${encodeURIComponent(slug)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsCreateSection(data) {
    return this._fetch(this.url('/admin/cms/sections'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsUpdateSection(id, data) {
    return this._fetch(this.url(`/admin/cms/sections/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsDeleteSection(id) {
    return this._fetch(this.url(`/admin/cms/sections/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this._headers(true)
    });
  },
  adminCmsReorderSections(items) {
    return this._fetch(this.url('/admin/cms/sections/reorder'), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify({ items })
    });
  },
  adminCmsCreateBlock(data) {
    return this._fetch(this.url('/admin/cms/blocks'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsUpdateBlock(id, data) {
    return this._fetch(this.url(`/admin/cms/blocks/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsDeleteBlock(id) {
    return this._fetch(this.url(`/admin/cms/blocks/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this._headers(true)
    });
  },
  adminCmsReorderBlocks(items) {
    return this._fetch(this.url('/admin/cms/blocks/reorder'), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify({ items })
    });
  },
  adminCmsGetNavigation() {
    return this._fetch(this.url('/admin/cms/navigation'), { headers: this._headers(true) });
  },
  adminCmsCreateNavigationItem(data) {
    return this._fetch(this.url('/admin/cms/navigation'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsUpdateNavigationItem(id, data) {
    return this._fetch(this.url(`/admin/cms/navigation/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsDeleteNavigationItem(id) {
    return this._fetch(this.url(`/admin/cms/navigation/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this._headers(true)
    });
  },
  adminCmsGetFooter() {
    return this._fetch(this.url('/admin/cms/footer'), { headers: this._headers(true) });
  },
  adminCmsCreateFooterColumn(data) {
    return this._fetch(this.url('/admin/cms/footer'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsUpdateFooterColumn(id, data) {
    return this._fetch(this.url(`/admin/cms/footer/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsDeleteFooterColumn(id) {
    return this._fetch(this.url(`/admin/cms/footer/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this._headers(true)
    });
  },
  adminCmsGetMedia() {
    return this._fetch(this.url('/admin/cms/media'), { headers: this._headers(true) });
  },
  adminCmsCreateMedia(data) {
    return this._fetch(this.url('/admin/cms/media'), {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsUpdateMedia(id, data) {
    return this._fetch(this.url(`/admin/cms/media/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(data)
    });
  },
  adminCmsDeleteMedia(id) {
    return this._fetch(this.url(`/admin/cms/media/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: this._headers(true)
    });
  },

  // ── Aliases for pages ───────────────────────
  // Used in contact.html, a-propos.html etc.
  getPublicSettings() {
    return this.getSettings ? this.getSettings() : this._fetch(this.url('/settings/public'));
  }
};

// Make globally available
window.API = API;
