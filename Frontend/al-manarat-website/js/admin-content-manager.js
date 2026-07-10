// Al Manarat — page-first CMS editor for /admin-site/contenus.html

(() => {
  const PAGE_DEFS = [
    { slug: 'home', title: 'Accueil', path: '/index.html', description: 'Hero, présentation, parcours, agenda, galerie, témoignages, CTA et contact.' },
    { slug: 'about', title: 'À propos', path: '/pages/a-propos.html', description: 'Histoire, fondements, mission, valeurs et équipe.' },
    { slug: 'schooling', title: 'Scolarité', path: '/pages/scolarite.html', description: 'Cursus, niveaux, orientation et FAQ.' },
    { slug: 'admissions', title: 'Admissions', path: '/pages/admissions.html', description: 'Processus, documents requis et textes autour de la candidature.' },
    { slug: 'news', title: 'Actualités', path: '/pages/actualites.html', description: 'Introduction, contenus éditoriaux et liste des actualités.' },
    { slug: 'events', title: 'Événements', path: '/pages/evenements.html', description: 'Introduction, contenus éditoriaux et liste des événements.' },
    { slug: 'gallery', title: 'Galerie', path: '/pages/galerie.html', description: 'Introduction, catégories et contenus média.' },
    { slug: 'contact', title: 'Contact', path: '/pages/contact.html', description: 'Coordonnées, horaires, réseaux sociaux et textes de formulaire.' },
    { slug: 'school-access', title: 'Espace Scolaire', path: '/pages/acces-scolaire.html', description: 'Accès GestSchool, aide et bouton de redirection.' },
  ];

  const DEFAULT_SECTION_LABELS = {
    hero: 'Hero',
    about: 'À Propos de Nous',
    programs: 'Parcours Éducatifs',
    'school-life': 'Vie Scolaire',
    agenda: 'Agenda',
    'gallery-preview': 'Galerie Photos',
    testimonials: 'Témoignages',
    'admissions-cta': 'Inscriptions Ouvertes 2025-2026',
    contact: 'Contactez-Nous',
    header: 'Header',
    history: 'Notre histoire',
    foundations: 'Nos fondements',
    team: 'Notre équipe',
    curriculum: 'Cursus',
    orientation: 'Orientation',
    faq: 'FAQ',
    process: 'Processus',
    'required-documents': 'Documents requis',
    'application-form-intro': 'Candidature en ligne',
    intro: 'Introduction',
    'contact-info': 'Coordonnées',
    'contact-form-intro': 'Formulaire de contact',
    'access-intro': 'Texte d’accès',
    'gestschool-link': 'Bouton vers GestSchool',
  };

  const SETTING_FIELDS = [
    ['school_name', 'Nom de l’école'],
    ['school_slogan', 'Slogan'],
    ['school_founded', 'Année de fondation'],
    ['school_address', 'Adresse'],
    ['school_phone', 'Téléphone principal'],
    ['school_phone2', 'Téléphone secondaire'],
    ['school_email', 'Email principal'],
    ['school_email2', 'Email inscriptions'],
    ['school_hours', 'Horaires'],
    ['gestschool_url', 'URL GestSchool'],
    ['footer_tagline', 'Texte court footer'],
    ['footer_copyright', 'Copyright'],
    ['facebook_url', 'Facebook'],
    ['instagram_url', 'Instagram'],
    ['youtube_url', 'YouTube'],
    ['whatsapp_url', 'WhatsApp'],
    ['twitter_url', 'X / Twitter'],
    ['tiktok_url', 'TikTok'],
  ];

  const state = {
    pages: [],
    currentSlug: 'home',
    currentPayload: null,
    mode: 'page',
    settings: {},
    navigation: [],
    footer: [],
    media: [],
  };

  const editorRoot = () => document.getElementById('cmsEditorRoot');
  const pageRail = () => document.getElementById('cmsPageRail');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugLabel(slug) {
    return PAGE_DEFS.find(page => page.slug === slug)?.title || slug;
  }

  function sectionLabel(section) {
    return section.title || DEFAULT_SECTION_LABELS[section.sectionKey] || section.sectionKey;
  }

  function statusChip(status) {
    const label = status === 'published' ? 'Publié' : status === 'archived' ? 'Archivé' : 'Brouillon';
    const cls = status === 'published' ? 'is-published' : 'is-draft';
    return `<span class="cms-chip ${cls}">${label}</span>`;
  }

  function visibleChip(visible) {
    return visible
      ? '<span class="cms-chip is-visible">Visible</span>'
      : '<span class="cms-chip is-hidden">Masquée</span>';
  }

  function setStatus(message, type = 'success') {
    const el = document.getElementById('cmsStatusLine');
    if (!el) return;
    el.textContent = message;
    el.className = `cms-status-line is-visible is-${type}`;
  }

  function renderRail() {
    const pagesBySlug = new Map(state.pages.map(page => [page.slug, page]));
    pageRail().innerHTML = PAGE_DEFS.map(page => {
      const cmsPage = pagesBySlug.get(page.slug);
      const status = cmsPage?.status || 'à créer';
      const active = state.mode === 'page' && state.currentSlug === page.slug ? 'active' : '';
      return `
        <button class="rail-page-btn ${active}" type="button" data-action="select-page" data-slug="${page.slug}">
          <strong>${escapeHtml(page.title)}</strong>
          <small>${escapeHtml(status)} · ${escapeHtml(page.description)}</small>
        </button>
      `;
    }).join('');

    document.querySelector('.rail-global-btn')?.classList.toggle('active', state.mode === 'global');
  }

  async function loadAdminData() {
    const [pagesResult, settingsResult, navigationResult, footerResult, mediaResult] = await Promise.allSettled([
      API.adminCmsListPages(),
      API.adminGetSettings(),
      API.adminCmsGetNavigation(),
      API.adminCmsGetFooter(),
      API.adminCmsGetMedia(),
    ]);

    if (pagesResult.status === 'fulfilled') state.pages = pagesResult.value;
    if (settingsResult.status === 'fulfilled') state.settings = settingsResult.value;
    if (navigationResult.status === 'fulfilled') state.navigation = navigationResult.value;
    if (footerResult.status === 'fulfilled') state.footer = footerResult.value;
    if (mediaResult.status === 'fulfilled') state.media = mediaResult.value;

    if (pagesResult.status === 'rejected') {
      throw pagesResult.reason;
    }

    updateSidebarLogo();
    renderRail();
  }

  function updateSidebarLogo() {
    const logo = state.settings.logo_path;
    const img = document.getElementById('sidebarLogo');
    if (logo && img) {
      img.src = `${logo}?t=${Date.now()}`;
      img.style.display = '';
    }
  }

  async function ensurePage(slug) {
    try {
      return await API.adminCmsGetPage(slug);
    } catch (error) {
      const def = PAGE_DEFS.find(page => page.slug === slug);
      if (!def) throw error;
      const page = await API.adminCmsUpdatePage(slug, {
        slug,
        title: def.title,
        metaTitle: def.title,
        metaDescription: def.description,
        status: 'draft',
      });
      state.pages = await API.adminCmsListPages();
      renderRail();
      return { page, sections: [] };
    }
  }

  async function selectPage(slug) {
    state.mode = 'page';
    state.currentSlug = slug;
    state.currentPayload = null;
    renderRail();
    showLoading(`Chargement de la page ${slugLabel(slug)}...`);

    try {
      state.currentPayload = await ensurePage(slug);
      renderPageEditor();
    } catch (error) {
      showError(`Impossible de charger la page ${slugLabel(slug)} : ${error.message}`);
    }
  }

  function selectGlobal() {
    state.mode = 'global';
    renderRail();
    renderGlobalEditor();
  }

  function showLoading(text) {
    editorRoot().innerHTML = `
      <div class="cms-empty-panel">
        <div class="spinner"></div>
        <h3>${escapeHtml(text)}</h3>
        <p>Merci de patienter pendant la lecture des données MongoDB.</p>
      </div>
    `;
  }

  function showError(text) {
    editorRoot().innerHTML = `
      <div class="cms-empty-panel">
        <h3>Erreur de chargement</h3>
        <p>${escapeHtml(text)}</p>
        <button class="btn btn-primary btn-sm" type="button" data-action="reload-current">Réessayer</button>
      </div>
    `;
  }

  function renderPageEditor() {
    const payload = state.currentPayload;
    const page = payload.page;
    const def = PAGE_DEFS.find(item => item.slug === page.slug) || { title: page.title, path: '/index.html', description: '' };
    const sections = [...(payload.sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

    editorRoot().innerHTML = `
      <div class="cms-editor-header">
        <div>
          <h2>${escapeHtml(def.title)}</h2>
          <p>${escapeHtml(def.description || page.metaDescription || 'Page du site public.')}</p>
        </div>
        <div class="cms-editor-actions">
          ${statusChip(page.status)}
          <a href="${def.path}" target="_blank" class="btn btn-outline btn-sm">Prévisualiser</a>
          <button class="btn btn-outline btn-sm" type="button" data-action="reload-current">Recharger</button>
          <button class="btn btn-primary btn-sm" type="button" data-action="save-page">Sauvegarder la page</button>
        </div>
      </div>
      <div class="cms-editor-body">
        <div class="cms-status-line" id="cmsStatusLine"></div>
        ${renderPageMeta(page)}
        <div class="cms-section-toolbar">
          <h3>Sections dans l’ordre d’affichage (${sections.length})</h3>
          <button class="btn btn-outline btn-sm" type="button" data-action="save-sections-order">Enregistrer l’ordre</button>
        </div>
        <div class="cms-section-stack">
          ${sections.length ? sections.map(renderSectionCard).join('') : renderEmptySections()}
          ${renderAddSectionCard(page.slug, sections.length)}
        </div>
      </div>
    `;
  }

  function renderPageMeta(page) {
    return `
      <section class="cms-page-meta">
        <div class="cms-form-grid three">
          <div class="cms-form-field">
            <label for="page-title">Nom de la page</label>
            <input id="page-title" data-page-field="title" type="text" value="${escapeHtml(page.title)}" />
          </div>
          <div class="cms-form-field">
            <label for="page-status">Statut</label>
            <select id="page-status" data-page-field="status">
              <option value="published" ${page.status === 'published' ? 'selected' : ''}>Publié</option>
              <option value="draft" ${page.status === 'draft' ? 'selected' : ''}>Brouillon</option>
              <option value="archived" ${page.status === 'archived' ? 'selected' : ''}>Archivé</option>
            </select>
          </div>
          <div class="cms-form-field">
            <label for="page-meta-title">Titre SEO</label>
            <input id="page-meta-title" data-page-field="metaTitle" type="text" value="${escapeHtml(page.metaTitle)}" />
          </div>
          <div class="cms-form-field full">
            <label for="page-meta-description">Description SEO</label>
            <textarea id="page-meta-description" data-page-field="metaDescription" rows="2">${escapeHtml(page.metaDescription)}</textarea>
          </div>
        </div>
      </section>
    `;
  }

  function renderEmptySections() {
    return `
      <div class="cms-empty-panel">
        <h3>Aucune section pour cette page</h3>
        <p>Ajoutez une première section pour commencer à structurer le contenu public.</p>
      </div>
    `;
  }

  function renderSectionCard(section, index) {
    const blocks = [...(section.blocks || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const open = index === 0 ? 'open' : '';
    return `
      <details class="cms-editor-card" data-section-card="${section.id}" ${open}>
        <summary>
          <div class="cms-card-summary">
            <div>
              <strong>${escapeHtml(sectionLabel(section))}</strong>
              <small>Clé : ${escapeHtml(section.sectionKey)} · Type : ${escapeHtml(section.type)} · Ordre : ${escapeHtml(section.order)}</small>
            </div>
            <div class="cms-chip-row">
              ${visibleChip(section.visible)}
              <span class="cms-chip">${blocks.length} bloc(s)</span>
            </div>
          </div>
        </summary>
        <div class="cms-card-body">
          <div class="cms-form-grid three">
            ${field('Titre', 'title', section.title, section.id)}
            ${field('Type de section', 'type', section.type, section.id)}
            ${field('Ordre', 'order', section.order, section.id, 'number')}
            ${textareaField('Sous-titre', 'subtitle', section.subtitle, section.id)}
            ${textareaField('Texte principal', 'body', section.body, section.id)}
            ${field('ID média / image / vidéo', 'mediaId', section.mediaId, section.id)}
          </div>
          <div class="cms-divider-title">Boutons et liens de la section</div>
          <div class="cms-inline-list" data-buttons-list="${section.id}">
            ${(section.buttons || []).map(button => renderButtonRow(section.id, button)).join('')}
          </div>
          <button class="btn btn-outline btn-sm" type="button" data-action="add-button" data-section-id="${section.id}">Ajouter un bouton</button>

          <div class="cms-divider-title">Blocs / items de la section</div>
          <div class="cms-inline-list">
            ${blocks.length ? blocks.map(block => renderBlockCard(block)).join('') : '<p class="cms-muted-text">Aucun bloc dans cette section.</p>'}
          </div>
          ${renderAddBlockCard(section)}

          <details>
            <summary class="cms-advanced-summary">Options avancées de la section</summary>
            <div class="cms-form-grid cms-advanced-grid">
              ${textareaField('Métadonnées JSON', 'metadata', JSON.stringify(section.metadata || {}, null, 2), section.id)}
            </div>
          </details>

          <div class="cms-action-row">
            <button class="btn btn-primary btn-sm" type="button" data-action="save-section" data-section-id="${section.id}">Sauvegarder la section</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="toggle-section" data-section-id="${section.id}">
              ${section.visible ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <div class="cms-danger-zone">
            <div>
              <strong>Suppression de section</strong>
              <p class="cms-muted-text">Supprime aussi tous les blocs rattachés à cette section.</p>
            </div>
            <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="delete-section" data-section-id="${section.id}">Supprimer</button>
          </div>
        </div>
      </details>
    `;
  }

  function field(label, name, value, sectionId, type = 'text') {
    return `
      <div class="cms-form-field">
        <label>${escapeHtml(label)}</label>
        <input type="${type}" data-section-id="${sectionId}" data-section-field="${name}" value="${escapeHtml(value)}" />
      </div>
    `;
  }

  function textareaField(label, name, value, sectionId) {
    return `
      <div class="cms-form-field full">
        <label>${escapeHtml(label)}</label>
        <textarea data-section-id="${sectionId}" data-section-field="${name}" rows="4">${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  function renderButtonRow(sectionId, button = {}) {
    return `
      <div class="cms-inline-row cms-button-row" data-button-row data-section-id="${sectionId}">
        <div class="cms-form-field"><label>Libellé</label><input data-button-field="label" type="text" value="${escapeHtml(button.label)}" /></div>
        <div class="cms-form-field"><label>Lien</label><input data-button-field="url" type="text" value="${escapeHtml(button.url)}" /></div>
        <div class="cms-form-field"><label>Style</label><input data-button-field="variant" type="text" value="${escapeHtml(button.variant || 'primary')}" /></div>
        <div class="cms-form-field"><label>Cible</label><select data-button-field="target"><option value="_self" ${button.target !== '_blank' ? 'selected' : ''}>Même page</option><option value="_blank" ${button.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option></select></div>
        <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="remove-button">Retirer</button>
      </div>
    `;
  }

  function renderBlockCard(block) {
    return `
      <article class="cms-block-card" data-block-card="${block.id}">
        <header>
          <div>
            <strong>${escapeHtml(block.title || 'Bloc sans titre')}</strong>
            <small class="cms-muted-text">Type : ${escapeHtml(block.type)} · Ordre : ${escapeHtml(block.order)}</small>
          </div>
          <div class="cms-chip-row">${visibleChip(block.visible)}</div>
        </header>
        <div class="cms-card-body">
          <div class="cms-form-grid three">
            ${blockField('Titre', 'title', block.title, block.id)}
            ${blockField('Type', 'type', block.type, block.id)}
            ${blockField('Ordre', 'order', block.order, block.id, 'number')}
            ${blockTextarea('Sous-titre', 'subtitle', block.subtitle, block.id)}
            ${blockTextarea('Texte', 'body', block.body, block.id)}
            ${blockField('Icône', 'icon', block.icon, block.id)}
            ${blockField('Lien / URL', 'url', block.url, block.id)}
            ${blockField('ID média', 'mediaId', block.mediaId, block.id)}
          </div>
          <details>
            <summary class="cms-advanced-summary">Métadonnées avancées</summary>
            <div class="cms-form-grid cms-advanced-grid">${blockTextarea('Métadonnées JSON', 'metadata', JSON.stringify(block.metadata || {}, null, 2), block.id)}</div>
          </details>
          <div class="cms-action-row">
            <button class="btn btn-primary btn-sm" type="button" data-action="save-block" data-block-id="${block.id}">Sauvegarder le bloc</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="toggle-block" data-block-id="${block.id}">${block.visible ? 'Masquer' : 'Afficher'}</button>
            <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="delete-block" data-block-id="${block.id}">Supprimer</button>
          </div>
        </div>
      </article>
    `;
  }

  function blockField(label, name, value, blockId, type = 'text') {
    return `
      <div class="cms-form-field">
        <label>${escapeHtml(label)}</label>
        <input type="${type}" data-block-id="${blockId}" data-block-field="${name}" value="${escapeHtml(value)}" />
      </div>
    `;
  }

  function blockTextarea(label, name, value, blockId) {
    return `
      <div class="cms-form-field full">
        <label>${escapeHtml(label)}</label>
        <textarea data-block-id="${blockId}" data-block-field="${name}" rows="3">${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  function renderAddBlockCard(section) {
    return `
      <div class="cms-add-card" data-new-block="${section.id}">
        <div class="cms-divider-title cms-divider-title-compact">Ajouter un bloc</div>
        <div class="cms-form-grid three">
          <div class="cms-form-field"><label>Titre</label><input data-new-block-field="title" type="text" placeholder="Ex : Nouveau niveau" /></div>
          <div class="cms-form-field"><label>Type</label><input data-new-block-field="type" type="text" value="text" /></div>
          <div class="cms-form-field"><label>Ordre</label><input data-new-block-field="order" type="number" value="${(section.blocks || []).length * 10 + 10}" /></div>
          <div class="cms-form-field full"><label>Texte</label><textarea data-new-block-field="body" rows="3"></textarea></div>
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="add-block" data-section-id="${section.id}">Ajouter ce bloc</button>
      </div>
    `;
  }

  function renderAddSectionCard(pageSlug, sectionCount) {
    return `
      <section class="cms-add-card" data-new-section>
        <div class="cms-divider-title cms-divider-title-compact">Ajouter une section à ${escapeHtml(slugLabel(pageSlug))}</div>
        <div class="cms-form-grid three">
          <div class="cms-form-field"><label>Clé technique lisible</label><input data-new-section-field="sectionKey" type="text" placeholder="ex : new-section" /></div>
          <div class="cms-form-field"><label>Titre</label><input data-new-section-field="title" type="text" /></div>
          <div class="cms-form-field"><label>Type</label><input data-new-section-field="type" type="text" value="content" /></div>
          <div class="cms-form-field"><label>Ordre</label><input data-new-section-field="order" type="number" value="${sectionCount * 10 + 10}" /></div>
          <div class="cms-form-field full"><label>Texte principal</label><textarea data-new-section-field="body" rows="3"></textarea></div>
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="add-section">Ajouter la section</button>
      </section>
    `;
  }

  function renderGlobalEditor() {
    const logo = state.settings.logo_path || '/assets/logo.png';
    editorRoot().innerHTML = `
      <div class="cms-editor-header">
        <div>
          <h2>Paramètres globaux du site</h2>
          <p>Gérez l’identité, les coordonnées, le menu, les liens sociaux, GestSchool et le footer.</p>
        </div>
        <div class="cms-editor-actions">
          <a href="/index.html" target="_blank" class="btn btn-outline btn-sm">Prévisualiser le site</a>
          <button class="btn btn-primary btn-sm" type="button" data-action="save-global-settings">Sauvegarder les paramètres</button>
        </div>
      </div>
      <div class="cms-editor-body">
        <div class="cms-status-line" id="cmsStatusLine"></div>
        <div class="cms-global-grid">
          <section class="cms-global-card">
            <h3>Identité, contacts et accès globaux</h3>
            <p>Ces informations alimentent le logo, les coordonnées, les réseaux sociaux, le footer et le lien GestSchool.</p>
            <div class="cms-logo-row">
              <img class="cms-logo-preview" src="${escapeHtml(logo)}" alt="Logo actuel" onerror="this.src='/assets/logo.png'" />
              <div>
                <div class="cms-form-grid">
                  <div class="cms-form-field"><label>Chemin du logo</label><input data-setting-key="logo_path" type="text" value="${escapeHtml(state.settings.logo_path)}" placeholder="/uploads/logo/logo.png" /></div>
                  <div class="cms-form-field"><label>Uploader un nouveau logo</label><input id="cmsLogoFile" type="file" accept="image/*" /></div>
                </div>
                <button class="btn btn-outline btn-sm cms-upload-logo-btn" type="button" data-action="upload-logo">Uploader le logo</button>
              </div>
            </div>
            <div class="cms-form-grid">
              ${SETTING_FIELDS.map(([key, label]) => settingField(key, label)).join('')}
            </div>
          </section>
          <section class="cms-global-card">
            <div class="cms-record-header">
              <div>
                <h3>Navbar / menu public</h3>
                <p>Ordre, visibilité, libellé et lien des entrées de navigation.</p>
              </div>
              <button class="btn btn-outline btn-sm" type="button" data-action="add-navigation">Ajouter un lien</button>
            </div>
            <div class="cms-table-like">${state.navigation.map(renderNavigationRow).join('') || '<p class="cms-muted-text">Aucun lien de navigation.</p>'}</div>
          </section>
          <section class="cms-global-card">
            <div class="cms-record-header">
              <div>
                <h3>Footer complet</h3>
                <p>Colonnes, textes, liens et visibilité du bas de page.</p>
              </div>
              <button class="btn btn-outline btn-sm" type="button" data-action="add-footer">Ajouter une colonne</button>
            </div>
            <div class="cms-table-like">${state.footer.map(renderFooterRow).join('') || '<p class="cms-muted-text">Aucune colonne footer.</p>'}</div>
          </section>
          <section class="cms-global-card">
            <div class="cms-record-header">
              <div>
                <h3>Médiathèque CMS structurée</h3>
                <p>Référencez les images, vidéos ou documents utilisés dans les sections et blocs par leur URL et leur ID média.</p>
              </div>
              <button class="btn btn-outline btn-sm" type="button" data-action="add-media">Ajouter un média</button>
            </div>
            <div class="cms-table-like">${state.media.map(renderMediaRow).join('') || '<p class="cms-muted-text">Aucun média CMS structuré.</p>'}</div>
          </section>
        </div>
      </div>
    `;
  }

  function settingField(key, label) {
    const value = state.settings[key] || '';
    const isLong = ['footer_tagline', 'footer_copyright'].includes(key);
    if (isLong) {
      return `<div class="cms-form-field full"><label>${escapeHtml(label)}</label><textarea data-setting-key="${key}" rows="3">${escapeHtml(value)}</textarea></div>`;
    }
    return `<div class="cms-form-field"><label>${escapeHtml(label)}</label><input data-setting-key="${key}" type="text" value="${escapeHtml(value)}" /></div>`;
  }

  function renderNavigationRow(item) {
    return `
      <article class="cms-record-row" data-navigation-row="${item.id}">
        <div class="cms-record-header">
          <strong>${escapeHtml(item.label || 'Lien sans titre')}</strong>
          ${visibleChip(item.visible)}
        </div>
        <div class="cms-form-grid three">
          <div class="cms-form-field"><label>Libellé</label><input data-nav-field="label" type="text" value="${escapeHtml(item.label)}" /></div>
          <div class="cms-form-field"><label>URL</label><input data-nav-field="url" type="text" value="${escapeHtml(item.url)}" /></div>
          <div class="cms-form-field"><label>Ordre</label><input data-nav-field="order" type="number" value="${escapeHtml(item.order)}" /></div>
          <div class="cms-form-field"><label>Type</label><input data-nav-field="type" type="text" value="${escapeHtml(item.type || 'main')}" /></div>
          <div class="cms-form-field"><label>Cible</label><select data-nav-field="target"><option value="_self" ${item.target !== '_blank' ? 'selected' : ''}>Même page</option><option value="_blank" ${item.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option></select></div>
          <div class="cms-form-field"><label>Visibilité</label><select data-nav-field="visible"><option value="true" ${item.visible ? 'selected' : ''}>Visible</option><option value="false" ${!item.visible ? 'selected' : ''}>Masqué</option></select></div>
        </div>
        <div class="cms-action-row">
          <button class="btn btn-primary btn-sm" type="button" data-action="save-navigation" data-navigation-id="${item.id}">Sauvegarder</button>
          <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="delete-navigation" data-navigation-id="${item.id}">Supprimer</button>
        </div>
      </article>
    `;
  }

  function renderFooterRow(column) {
    return `
      <article class="cms-record-row" data-footer-row="${column.id}">
        <div class="cms-record-header">
          <strong>${escapeHtml(column.title || column.columnKey)}</strong>
          ${visibleChip(column.visible)}
        </div>
        <div class="cms-form-grid three">
          <div class="cms-form-field"><label>Clé colonne</label><input data-footer-field="columnKey" type="text" value="${escapeHtml(column.columnKey)}" /></div>
          <div class="cms-form-field"><label>Titre</label><input data-footer-field="title" type="text" value="${escapeHtml(column.title)}" /></div>
          <div class="cms-form-field"><label>Ordre</label><input data-footer-field="order" type="number" value="${escapeHtml(column.order)}" /></div>
          <div class="cms-form-field"><label>Visibilité</label><select data-footer-field="visible"><option value="true" ${column.visible ? 'selected' : ''}>Visible</option><option value="false" ${!column.visible ? 'selected' : ''}>Masqué</option></select></div>
          <div class="cms-form-field full"><label>Contenu</label><textarea data-footer-field="content" rows="3">${escapeHtml(column.content)}</textarea></div>
        </div>
        <div class="cms-divider-title">Liens footer</div>
        <div class="cms-inline-list" data-footer-links="${column.id}">
          ${(column.links || []).map(link => renderFooterLinkRow(column.id, link)).join('')}
        </div>
        <button class="btn btn-outline btn-sm" type="button" data-action="add-footer-link" data-footer-id="${column.id}">Ajouter un lien</button>
        <div class="cms-action-row">
          <button class="btn btn-primary btn-sm" type="button" data-action="save-footer" data-footer-id="${column.id}">Sauvegarder</button>
          <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="delete-footer" data-footer-id="${column.id}">Supprimer</button>
        </div>
      </article>
    `;
  }

  function renderFooterLinkRow(footerId, link = {}) {
    return `
      <div class="cms-inline-row cms-footer-link-row" data-footer-link-row data-footer-id="${footerId}">
        <div class="cms-form-field"><label>Libellé</label><input data-footer-link-field="label" type="text" value="${escapeHtml(link.label)}" /></div>
        <div class="cms-form-field"><label>URL</label><input data-footer-link-field="url" type="text" value="${escapeHtml(link.url)}" /></div>
        <div class="cms-form-field"><label>Cible</label><select data-footer-link-field="target"><option value="_self" ${link.target !== '_blank' ? 'selected' : ''}>Même page</option><option value="_blank" ${link.target === '_blank' ? 'selected' : ''}>Nouvel onglet</option></select></div>
        <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="remove-footer-link">Retirer</button>
      </div>
    `;
  }

  function renderMediaRow(media) {
    const preview = media.url
      ? `<img class="cms-media-preview" src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || media.filename || 'Média')}" onerror="this.style.display='none'" />`
      : '<div class="cms-media-preview is-empty">Media</div>';
    return `
      <article class="cms-record-row" data-media-row="${media.id}">
        <div class="cms-record-header">
          <div>
            <strong>${escapeHtml(media.filename || 'Média sans nom')}</strong>
            <div class="cms-muted-text">${escapeHtml(media.url || 'URL non renseignée')}</div>
          </div>
          ${preview}
        </div>
        <div class="cms-form-grid three">
          <div class="cms-form-field"><label>Nom de fichier</label><input data-media-field="filename" type="text" value="${escapeHtml(media.filename)}" /></div>
          <div class="cms-form-field"><label>URL</label><input data-media-field="url" type="text" value="${escapeHtml(media.url)}" /></div>
          <div class="cms-form-field"><label>Type</label><input data-media-field="type" type="text" value="${escapeHtml(media.type || 'image')}" /></div>
          <div class="cms-form-field"><label>MIME type</label><input data-media-field="mimeType" type="text" value="${escapeHtml(media.mimeType)}" /></div>
          <div class="cms-form-field"><label>Taille</label><input data-media-field="size" type="number" value="${escapeHtml(media.size || 0)}" /></div>
          <div class="cms-form-field"><label>Texte alternatif</label><input data-media-field="alt" type="text" value="${escapeHtml(media.alt)}" /></div>
          <div class="cms-form-field full"><label>Légende</label><textarea data-media-field="caption" rows="2">${escapeHtml(media.caption)}</textarea></div>
        </div>
        <div class="cms-action-row">
          <button class="btn btn-primary btn-sm" type="button" data-action="save-media" data-media-id="${media.id}">Sauvegarder</button>
          <button class="btn btn-outline btn-sm cms-btn-danger" type="button" data-action="delete-media" data-media-id="${media.id}">Supprimer</button>
        </div>
      </article>
    `;
  }

  function readFields(root, selector, attr) {
    const data = {};
    root.querySelectorAll(selector).forEach(input => {
      const key = input.getAttribute(attr);
      if (!key) return;
      if (key === 'visible') data[key] = input.value === 'true';
      else if (key === 'order') data[key] = Number(input.value) || 0;
      else data[key] = input.value;
    });
    return data;
  }

  function parseMetadata(value) {
    if (!String(value || '').trim()) return {};
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('Métadonnées JSON invalides.');
    }
  }

  function readSectionPayload(sectionId) {
    const card = document.querySelector(`[data-section-card="${sectionId}"]`);
    const payload = readFields(card, '[data-section-field]', 'data-section-field');
    payload.visible = getSection(sectionId)?.visible ?? true;
    if ('metadata' in payload) payload.metadata = parseMetadata(payload.metadata);
    payload.buttons = [...card.querySelectorAll('[data-button-row]')].map(row => readFields(row, '[data-button-field]', 'data-button-field'))
      .filter(button => button.label && button.url);
    return payload;
  }

  function readBlockPayload(blockId) {
    const card = document.querySelector(`[data-block-card="${blockId}"]`);
    const payload = readFields(card, '[data-block-field]', 'data-block-field');
    payload.visible = getBlock(blockId)?.visible ?? true;
    if ('metadata' in payload) payload.metadata = parseMetadata(payload.metadata);
    return payload;
  }

  function getSection(sectionId) {
    return state.currentPayload?.sections?.find(section => section.id === sectionId);
  }

  function getBlock(blockId) {
    for (const section of state.currentPayload?.sections || []) {
      const block = (section.blocks || []).find(item => item.id === blockId);
      if (block) return block;
    }
    return null;
  }

  async function savePage() {
    const payload = readFields(document, '[data-page-field]', 'data-page-field');
    const saved = await API.adminCmsUpdatePage(state.currentSlug, payload);
    state.currentPayload.page = saved;
    state.pages = await API.adminCmsListPages();
    renderRail();
    renderPageEditor();
    setStatus('Page sauvegardée dans MongoDB.', 'success');
  }

  async function saveSection(sectionId) {
    const payload = readSectionPayload(sectionId);
    await API.adminCmsUpdateSection(sectionId, payload);
    await reloadCurrentPage('Section sauvegardée dans MongoDB.');
  }

  async function toggleSection(sectionId) {
    const section = getSection(sectionId);
    await API.adminCmsUpdateSection(sectionId, { visible: !section.visible });
    await reloadCurrentPage(section.visible ? 'Section masquée côté public.' : 'Section réaffichée côté public.');
  }

  async function deleteSection(sectionId) {
    const section = getSection(sectionId);
    const ok = await Admin.confirm(`Supprimer la section "${escapeHtml(sectionLabel(section))}" et tous ses blocs ?`);
    if (!ok) return;
    await API.adminCmsDeleteSection(sectionId);
    await reloadCurrentPage('Section supprimée.');
  }

  async function saveSectionsOrder() {
    const items = [...document.querySelectorAll('[data-section-card]')].map(card => {
      const id = card.getAttribute('data-section-card');
      const orderInput = card.querySelector('[data-section-field="order"]');
      return { id, order: Number(orderInput?.value) || 0 };
    });
    await API.adminCmsReorderSections(items);
    await reloadCurrentPage('Ordre des sections sauvegardé.');
  }

  async function addSection() {
    const root = document.querySelector('[data-new-section]');
    const payload = readFields(root, '[data-new-section-field]', 'data-new-section-field');
    payload.pageSlug = state.currentSlug;
    payload.visible = true;
    if (!payload.sectionKey || !payload.title) {
      setStatus('La clé et le titre de la section sont obligatoires.', 'error');
      return;
    }
    await API.adminCmsCreateSection(payload);
    await reloadCurrentPage('Nouvelle section ajoutée.');
  }

  async function saveBlock(blockId) {
    await API.adminCmsUpdateBlock(blockId, readBlockPayload(blockId));
    await reloadCurrentPage('Bloc sauvegardé dans MongoDB.');
  }

  async function toggleBlock(blockId) {
    const block = getBlock(blockId);
    await API.adminCmsUpdateBlock(blockId, { visible: !block.visible });
    await reloadCurrentPage(block.visible ? 'Bloc masqué côté public.' : 'Bloc réaffiché côté public.');
  }

  async function deleteBlock(blockId) {
    const block = getBlock(blockId);
    const ok = await Admin.confirm(`Supprimer le bloc "${escapeHtml(block?.title || 'sans titre')}" ?`);
    if (!ok) return;
    await API.adminCmsDeleteBlock(blockId);
    await reloadCurrentPage('Bloc supprimé.');
  }

  async function addBlock(sectionId) {
    const section = getSection(sectionId);
    const root = document.querySelector(`[data-new-block="${sectionId}"]`);
    const payload = readFields(root, '[data-new-block-field]', 'data-new-block-field');
    payload.pageSlug = section.pageSlug;
    payload.sectionKey = section.sectionKey;
    payload.visible = true;
    if (!payload.title) {
      setStatus('Le titre du bloc est obligatoire.', 'error');
      return;
    }
    await API.adminCmsCreateBlock(payload);
    await reloadCurrentPage('Nouveau bloc ajouté.');
  }

  async function reloadCurrentPage(successMessage = '') {
    if (state.mode === 'global') {
      await loadAdminData();
      renderGlobalEditor();
    } else {
      state.currentPayload = await API.adminCmsGetPage(state.currentSlug);
      renderPageEditor();
    }
    if (successMessage) setStatus(successMessage, 'success');
  }

  async function saveGlobalSettings() {
    const payload = {};
    document.querySelectorAll('[data-setting-key]').forEach(input => {
      payload[input.getAttribute('data-setting-key')] = input.value;
    });
    await API.adminSaveSettings(payload);
    state.settings = { ...state.settings, ...payload };
    updateSidebarLogo();
    setStatus('Paramètres globaux sauvegardés.', 'success');
  }

  async function uploadLogo() {
    const fileInput = document.getElementById('cmsLogoFile');
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus('Choisissez un fichier image avant d’uploader.', 'error');
      return;
    }
    const fd = new FormData();
    fd.append('logo', file);
    const token = localStorage.getItem('am_token');
    const res = await fetch(API.url('/settings/admin/upload-logo'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Upload impossible.');
    state.settings.logo_path = data.logo_path;
    renderGlobalEditor();
    setStatus('Logo mis à jour.', 'success');
  }

  function readNavigationPayload(id) {
    const row = document.querySelector(`[data-navigation-row="${id}"]`);
    return readFields(row, '[data-nav-field]', 'data-nav-field');
  }

  async function saveNavigation(id) {
    await API.adminCmsUpdateNavigationItem(id, readNavigationPayload(id));
    state.navigation = await API.adminCmsGetNavigation();
    renderGlobalEditor();
    setStatus('Lien de navigation sauvegardé.', 'success');
  }

  async function addNavigation() {
    await API.adminCmsCreateNavigationItem({
      label: 'Nouveau lien',
      url: '#',
      order: (state.navigation.length + 1) * 10,
      visible: true,
      target: '_self',
      type: 'main',
    });
    state.navigation = await API.adminCmsGetNavigation();
    renderGlobalEditor();
    setStatus('Lien de navigation ajouté.', 'success');
  }

  async function deleteNavigation(id) {
    const ok = await Admin.confirm('Supprimer ce lien de navigation ?');
    if (!ok) return;
    await API.adminCmsDeleteNavigationItem(id);
    state.navigation = await API.adminCmsGetNavigation();
    renderGlobalEditor();
    setStatus('Lien supprimé.', 'success');
  }

  function readFooterPayload(id) {
    const row = document.querySelector(`[data-footer-row="${id}"]`);
    const payload = readFields(row, '[data-footer-field]', 'data-footer-field');
    payload.links = [...row.querySelectorAll('[data-footer-link-row]')].map(linkRow => readFields(linkRow, '[data-footer-link-field]', 'data-footer-link-field'))
      .filter(link => link.label && link.url);
    return payload;
  }

  async function saveFooter(id) {
    await API.adminCmsUpdateFooterColumn(id, readFooterPayload(id));
    state.footer = await API.adminCmsGetFooter();
    renderGlobalEditor();
    setStatus('Colonne footer sauvegardée.', 'success');
  }

  async function addFooter() {
    await API.adminCmsCreateFooterColumn({
      columnKey: `colonne-${Date.now()}`,
      title: 'Nouvelle colonne',
      content: '',
      links: [],
      order: (state.footer.length + 1) * 10,
      visible: true,
    });
    state.footer = await API.adminCmsGetFooter();
    renderGlobalEditor();
    setStatus('Colonne footer ajoutée.', 'success');
  }

  async function deleteFooter(id) {
    const ok = await Admin.confirm('Supprimer cette colonne du footer ?');
    if (!ok) return;
    await API.adminCmsDeleteFooterColumn(id);
    state.footer = await API.adminCmsGetFooter();
    renderGlobalEditor();
    setStatus('Colonne footer supprimée.', 'success');
  }

  function readMediaPayload(id) {
    const row = document.querySelector(`[data-media-row="${id}"]`);
    return readFields(row, '[data-media-field]', 'data-media-field');
  }

  async function saveMedia(id) {
    await API.adminCmsUpdateMedia(id, readMediaPayload(id));
    state.media = await API.adminCmsGetMedia();
    renderGlobalEditor();
    setStatus('Média sauvegardé.', 'success');
  }

  async function addMedia() {
    await API.adminCmsCreateMedia({
      filename: `media-${Date.now()}`,
      url: '',
      type: 'image',
      mimeType: '',
      alt: '',
      caption: '',
      size: 0,
    });
    state.media = await API.adminCmsGetMedia();
    renderGlobalEditor();
    setStatus('Média ajouté. Renseignez son URL puis sauvegardez.', 'success');
  }

  async function deleteMedia(id) {
    const ok = await Admin.confirm('Supprimer ce média CMS structuré ?');
    if (!ok) return;
    await API.adminCmsDeleteMedia(id);
    state.media = await API.adminCmsGetMedia();
    renderGlobalEditor();
    setStatus('Média supprimé.', 'success');
  }

  function bindEvents() {
    document.addEventListener('click', async event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      try {
        if (action === 'select-page') await selectPage(target.getAttribute('data-slug'));
        if (action === 'select-global') selectGlobal();
        if (action === 'reload-current') await reloadCurrentPage();
        if (action === 'save-page') await savePage();
        if (action === 'save-section') await saveSection(target.getAttribute('data-section-id'));
        if (action === 'toggle-section') await toggleSection(target.getAttribute('data-section-id'));
        if (action === 'delete-section') await deleteSection(target.getAttribute('data-section-id'));
        if (action === 'save-sections-order') await saveSectionsOrder();
        if (action === 'add-section') await addSection();
        if (action === 'add-button') {
          const sectionId = target.getAttribute('data-section-id');
          document.querySelector(`[data-buttons-list="${sectionId}"]`).insertAdjacentHTML('beforeend', renderButtonRow(sectionId));
        }
        if (action === 'remove-button') target.closest('[data-button-row]')?.remove();
        if (action === 'save-block') await saveBlock(target.getAttribute('data-block-id'));
        if (action === 'toggle-block') await toggleBlock(target.getAttribute('data-block-id'));
        if (action === 'delete-block') await deleteBlock(target.getAttribute('data-block-id'));
        if (action === 'add-block') await addBlock(target.getAttribute('data-section-id'));
        if (action === 'save-global-settings') await saveGlobalSettings();
        if (action === 'upload-logo') await uploadLogo();
        if (action === 'save-navigation') await saveNavigation(target.getAttribute('data-navigation-id'));
        if (action === 'add-navigation') await addNavigation();
        if (action === 'delete-navigation') await deleteNavigation(target.getAttribute('data-navigation-id'));
        if (action === 'save-footer') await saveFooter(target.getAttribute('data-footer-id'));
        if (action === 'add-footer') await addFooter();
        if (action === 'delete-footer') await deleteFooter(target.getAttribute('data-footer-id'));
        if (action === 'save-media') await saveMedia(target.getAttribute('data-media-id'));
        if (action === 'add-media') await addMedia();
        if (action === 'delete-media') await deleteMedia(target.getAttribute('data-media-id'));
        if (action === 'add-footer-link') {
          const footerId = target.getAttribute('data-footer-id');
          document.querySelector(`[data-footer-links="${footerId}"]`).insertAdjacentHTML('beforeend', renderFooterLinkRow(footerId));
        }
        if (action === 'remove-footer-link') target.closest('[data-footer-link-row]')?.remove();
      } catch (error) {
        setStatus(error.message || 'Action impossible.', 'error');
        Admin.showToast(error.message || 'Action impossible.', 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    Admin.init();
    if (!Admin.isAuthenticated()) return;
    bindEvents();
    try {
      await loadAdminData();
      await selectPage('home');
    } catch (error) {
      showError(error.message || 'Impossible de charger le CMS.');
    }
  });
})();
