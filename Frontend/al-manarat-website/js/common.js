// ════════════════════════════════════════════════
//  Al Manarat — Script commun pages publiques
//  Charge : logo dynamique, réseaux sociaux SVG, footer
// ════════════════════════════════════════════════
'use strict';

const SCHOOL_ACCESS_PATH = '/acces-scolaire';
const CMS_ICON_MAP = {
  activity: '🏃',
  award: '🏅',
  book: '📚',
  'book-open': '📖',
  calendar: '📅',
  compass: '✦',
  file: '📄',
  gem: '◆',
  'graduation-cap': '🎓',
  map: '🗺️',
  mosque: '🕌',
  sprout: '🌱',
  sparkles: '✨',
  target: '✓',
};

function isValidHttpUrl(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeGestSchoolUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();

  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? '' : trimmed;
  }

  if (!isValidHttpUrl(trimmed)) return '';
  return new URL(trimmed).href;
}

function injectSchoolAccessLink() {
  document.querySelectorAll('.nav-links').forEach(nav => {
    if (nav.querySelector('[data-school-access-link]')) return;

    const link = document.createElement('a');
    link.href = SCHOOL_ACCESS_PATH;
    link.className = 'nav-link nav-school-access';
    link.dataset.schoolAccessLink = 'true';
    link.textContent = 'Espace Scolaire';

    const admissionsCta = nav.querySelector('.nav-cta');
    if (admissionsCta) {
      nav.insertBefore(link, admissionsCta);
    } else {
      nav.appendChild(link);
    }
  });
}

function setCmsText(id, value) {
  const el = document.getElementById(id);
  if (!el || typeof value !== 'string') return;

  const text = value.trim();
  if (text) el.textContent = text;
}

function getTeamInitials(member) {
  const explicit = typeof member.initials === 'string' ? member.initials.trim() : '';
  if (explicit) return explicit.slice(0, 3).toUpperCase();

  const name = typeof member.name === 'string' ? member.name.trim() : '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AM';
}

function getSafeHexColor(value, fallback = '#059669') {
  const color = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function resolveCmsIcon(value, fallback = '✨') {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key) return fallback;
  return CMS_ICON_MAP[key] || key;
}

function getCurrentCmsPageSlug() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const normalized = pathname.endsWith('/index.html') ? '/index.html' : pathname;

  if (normalized === '/' || normalized === '/index.html') return 'home';
  if (normalized.endsWith('/a-propos.html')) return 'about';
  if (normalized.endsWith('/scolarite.html')) return 'schooling';
  if (normalized.endsWith('/admissions.html')) return 'admissions';
  if (normalized.endsWith('/contact.html')) return 'contact';
  if (normalized === SCHOOL_ACCESS_PATH || normalized.endsWith('/acces-scolaire.html')) return 'school-access';
  if (normalized.endsWith('/actualites.html')) return 'news';
  if (normalized.endsWith('/evenements.html')) return 'events';
  if (normalized.endsWith('/galerie.html')) return 'gallery';

  return '';
}

function setFirstText(selectors, value) {
  if (!value || typeof value !== 'string') return;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      el.textContent = value.trim();
      return;
    }
  }
}

function setMetaContent(name, value) {
  if (!value || typeof value !== 'string') return;
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el) el.setAttribute('content', value.trim());
}

function getSectionMap(payload) {
  const map = new Map();
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  sections.forEach(section => {
    if (section?.sectionKey) map.set(section.sectionKey, section);
  });
  return map;
}

function splitParagraphs(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

function splitLines(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function getVisibleBlocks(section) {
  return (Array.isArray(section?.blocks) ? section.blocks : [])
    .filter(block => block && block.visible !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function getSectionRoot(key) {
  return document.querySelector(`[data-cms-section="${key}"]`);
}

function setText(el, value) {
  if (!el || typeof value !== 'string') return;
  const text = value.trim();
  if (text) el.textContent = text;
}

function setSectionText(root, section, options = {}) {
  if (!root || !section) return;
  setText(root.querySelector(options.titleSelector || '.section-title, h2, h1'), section.title);
  setText(root.querySelector(options.subtitleSelector || '.section-desc, .section-subtitle, p'), section.subtitle);
  if (section.body) {
    const bodyEl = root.querySelector(options.bodySelector || '[data-cms-body], .section-body, .about-text, .cta-text p, .access-help, p');
    setText(bodyEl, section.body);
  }
}

function createTextBlock(tagName, className, value) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  el.textContent = String(value || '').trim();
  return el;
}

function createLinkButton(button, index = 0) {
  const link = document.createElement('a');
  const style = String(button?.style || button?.variant || '').toLowerCase();
  link.href = button?.url || '#';
  link.target = button?.target || '_self';
  link.className = style === 'secondary' || index > 0 ? 'btn-secondary' : 'btn-primary';
  link.textContent = button?.label || (index > 0 ? 'En savoir plus' : 'Découvrir');
  return link;
}

function renderButtons(container, buttons) {
  if (!container || !Array.isArray(buttons) || !buttons.length) return;
  const visibleButtons = buttons
    .filter(button => button && button.visible !== false && button.label)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  if (!visibleButtons.length) return;
  container.replaceChildren(...visibleButtons.map((button, index) => createLinkButton(button, index)));
}

function createFeatureList(value) {
  const list = document.createElement('ul');
  list.className = 'program-features';
  splitLines(value).forEach(line => {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  });
  return list;
}

function renderCards(container, blocks, factory) {
  if (!container || !blocks.length) return;
  container.replaceChildren(...blocks.map(factory));
}

function renderAboutValueBlocks(section) {
  const container = document.querySelector('[data-cms-section="about"] .about-values');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, (block, index) => {
    const card = document.createElement('div');
    card.className = 'value-card reveal visible';

    const icon = document.createElement('div');
    icon.className = 'value-icon';
    icon.textContent = resolveCmsIcon(block.icon || block.metadata?.icon, ['📚', '🕌', '🌍'][index % 3]);

    const title = createTextBlock('h4', '', block.title || 'Valeur');
    const body = createTextBlock('p', '', block.body || block.subtitle || '');
    card.append(icon, title, body);
    return card;
  });
}

function renderFoundationBlocks(section) {
  const container = document.querySelector('[data-cms-section="foundations"] .values-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const card = document.createElement('div');
    card.className = 'value-card reveal visible';

    const icon = document.createElement('div');
    icon.className = 'value-icon';
    icon.textContent = resolveCmsIcon(block.icon || block.metadata?.icon, '✨');

    const title = createTextBlock('h3', '', block.title || 'Fondement');
    const body = createTextBlock('p', '', block.body || block.subtitle || '');
    card.append(icon, title, body);
    return card;
  });
}

function renderProgramBlocks(section) {
  const container = document.querySelector('[data-cms-section="programs"] .programs-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, (block, index) => {
    const card = document.createElement('div');
    card.className = `program-card reveal visible${block.metadata?.featured ? ' featured' : ''}`;
    card.style.setProperty('--card-color', getSafeHexColor(block.metadata?.color, ['#16a34a', '#d97706', '#7c3aed', '#0891b2'][index % 4]));

    const header = document.createElement('div');
    header.className = 'program-header';
    const icon = document.createElement('div');
    icon.className = 'program-icon';
    icon.textContent = resolveCmsIcon(block.icon || block.metadata?.icon, '📚');
    const title = createTextBlock('h3', '', block.title || 'Parcours');
    header.append(icon, title);

    const subtitle = createTextBlock('p', 'program-desc', block.subtitle || '');
    const list = createFeatureList(block.body || '');
    card.append(header, subtitle);
    if (list.childElementCount) card.appendChild(list);
    return card;
  });
}

function renderActivityBlocks(section) {
  const container = document.querySelector('[data-cms-section="school-life"] .activities-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, (block, index) => {
    const card = document.createElement('div');
    card.className = `activity-card reveal visible${index === 0 ? ' large' : ''}`;
    const icon = document.createElement('div');
    icon.className = 'activity-icon-card';
    icon.textContent = resolveCmsIcon(block.icon || block.metadata?.icon, '✨');
    const title = createTextBlock('h3', '', block.title || 'Activité');
    const body = createTextBlock('p', '', block.body || block.subtitle || '');
    card.append(icon, title, body);
    return card;
  });
}

function renderHomeEventBlocks(section) {
  const container = document.querySelector('[data-cms-section="agenda"] .events-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const card = document.createElement('article');
    card.className = 'event-card reveal visible';
    const date = createTextBlock('div', 'event-date', block.metadata?.date || block.subtitle || '');
    const title = createTextBlock('h3', '', block.title || 'Événement');
    const body = createTextBlock('p', '', block.body || '');
    card.append(date, title, body);
    return card;
  });
}

function renderGalleryPreviewBlocks(section) {
  const container = document.querySelector('[data-cms-section="gallery-preview"] .gallery-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const card = document.createElement('article');
    card.className = 'gallery-card reveal visible';
    const image = document.createElement('div');
    image.className = 'gallery-image';
    image.textContent = resolveCmsIcon(block.icon || block.metadata?.icon, '🖼️');
    const title = createTextBlock('h3', '', block.title || 'Galerie');
    const body = createTextBlock('p', '', block.body || block.subtitle || '');
    card.append(image, title, body);
    return card;
  });
}

function renderTestimonialsBlocks(section) {
  const container = document.getElementById('testimonialsTrack');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const card = document.createElement('div');
    card.className = 'testimonial-card';
    const quote = createTextBlock('p', 'testimonial-text', block.body || block.subtitle || '');
    const author = createTextBlock('h4', '', block.title || 'Témoignage');
    const role = createTextBlock('span', '', block.metadata?.role || '');
    const meta = document.createElement('div');
    meta.className = 'testimonial-author';
    meta.append(author, role);
    card.append(quote, meta);
    return card;
  });
}

function renderTimelineBlocks(section) {
  const container = document.querySelector('[data-cms-section="process"] .timeline');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, (block, index) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const number = createTextBlock('div', 'timeline-num', block.metadata?.step || String(index + 1));
    const content = document.createElement('div');
    content.className = 'timeline-content';
    content.append(createTextBlock('h4', '', block.title || `Étape ${index + 1}`), createTextBlock('p', '', block.body || block.subtitle || ''));
    item.append(number, content);
    return item;
  });
}

function renderDocumentBlocks(section) {
  const container = document.querySelector('[data-cms-section="required-documents"] .docs-list');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const item = document.createElement('div');
    item.className = 'doc-item';
    const icon = createTextBlock('span', 'doc-icon', resolveCmsIcon(block.icon || block.metadata?.icon, '📄'));
    const text = createTextBlock('span', '', block.title || block.body || 'Document');
    item.append(icon, text);
    return item;
  });
}

function renderCursusBlocks(section) {
  const container = document.querySelector('[data-cms-section="orientation"] .cursus-grid, [data-cms-section="curriculum"] .cursus-grid');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const card = document.createElement('article');
    card.className = 'cursus-card reveal visible';
    const icon = createTextBlock('div', 'cursus-icon', resolveCmsIcon(block.icon || block.metadata?.icon, '🎓'));
    const title = createTextBlock('h3', '', block.title || 'Cursus');
    const body = createTextBlock('p', '', block.body || block.subtitle || '');
    card.append(icon, title, body);
    return card;
  });
}

function renderFaqBlocks(section) {
  const container = document.querySelector('[data-cms-section="faq"] .faq-list');
  const blocks = getVisibleBlocks(section);
  if (!container || !blocks.length) return;

  renderCards(container, blocks, block => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    const question = document.createElement('div');
    question.className = 'faq-q';
    question.textContent = block.title || 'Question';
    const arrow = createTextBlock('span', 'arrow', '▾');
    question.appendChild(arrow);
    const answer = document.createElement('div');
    answer.className = 'faq-a';
    answer.appendChild(createTextBlock('div', 'faq-a-inner', block.body || block.subtitle || ''));
    question.addEventListener('click', () => {
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open');
    });
    item.append(question, answer);
    return item;
  });
}

function renderTeamBlocks(blocks) {
  const grid = document.getElementById('teamGrid');
  if (!grid || !Array.isArray(blocks) || !blocks.length) return;

  const fragment = document.createDocumentFragment();
  blocks.forEach(block => {
    const card = document.createElement('div');
    card.className = 'team-card visible';

    const avatar = document.createElement('div');
    avatar.className = 'team-avatar';
    avatar.style.background = `linear-gradient(135deg, ${getSafeHexColor(block.metadata?.color)}, #065f46)`;
    avatar.textContent = String(block.metadata?.initials || getTeamInitials({ name: block.title })).slice(0, 3);

    const title = document.createElement('h3');
    title.textContent = block.title || 'Membre de l’équipe';

    const role = document.createElement('p');
    role.textContent = block.subtitle || 'Équipe pédagogique';

    card.append(avatar, title, role);
    fragment.appendChild(card);
  });

  grid.replaceChildren(fragment);
}

function renderGenericBlocks(root, section) {
  const blocks = getVisibleBlocks(section);
  if (!root || !blocks.length) return;

  root.querySelectorAll('[data-cms-generated-blocks]').forEach(el => el.remove());
  const list = document.createElement('div');
  list.className = 'cms-public-block-list';
  list.dataset.cmsGeneratedBlocks = 'true';

  blocks.forEach(block => {
    const card = document.createElement('article');
    card.className = 'cms-public-block-card';
    if (block.icon) card.appendChild(createTextBlock('div', 'cms-public-block-icon', resolveCmsIcon(block.icon)));
    if (block.title) card.appendChild(createTextBlock('h3', '', block.title));
    if (block.subtitle) card.appendChild(createTextBlock('p', 'cms-public-block-subtitle', block.subtitle));
    if (block.body) card.appendChild(createTextBlock('p', '', block.body));
    list.appendChild(card);
  });

  root.appendChild(list);
}

function applyCmsNavigation(items) {
  if (!Array.isArray(items) || !items.length) return;
  const visibleItems = items.filter(item => item?.visible !== false && item.label && item.url);
  if (!visibleItems.length) return;

  const pathname = window.location.pathname;
  document.querySelectorAll('.nav-links').forEach(nav => {
    const fragment = document.createDocumentFragment();

    visibleItems.forEach(item => {
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.label;
      link.target = item.target || '_self';
      link.className = item.label.toLowerCase().includes('admission') ? 'nav-cta' : 'nav-link';
      if (item.url === SCHOOL_ACCESS_PATH) {
        link.className = 'nav-link nav-school-access';
        link.dataset.schoolAccessLink = 'true';
      }
      if (item.url && pathname.endsWith(item.url.replace(/^\//, ''))) {
        link.classList.add('active');
      }
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        document.body.style.overflow = '';
      });
      fragment.appendChild(link);
    });

    nav.replaceChildren(fragment);
  });
}

function applyCmsFooter(columns) {
  if (!Array.isArray(columns) || !columns.length) return;
  const byKey = new Map(columns.map(column => [column.columnKey, column]));
  const brand = byKey.get('brand');
  const contact = byKey.get('contact');

  setCmsText('footerTagline', brand?.content);

  if (contact?.content) {
    const parts = splitParagraphs(contact.content.replace(/\n/g, '\n\n'));
    setCmsText('f-address', parts[0]);
    setCmsText('f-phone', parts[1]);
    setCmsText('f-email', parts[2]);
  }
}

function applyCmsVisibility(sectionMap) {
  document.querySelectorAll('[data-cms-section]').forEach(el => {
    const key = el.dataset.cmsSection;
    if (key && !sectionMap.has(key)) el.hidden = true;
  });

  sectionMap.forEach(section => {
    const el = document.querySelector(`[data-cms-section="${section.sectionKey}"]`);
    if (el) el.hidden = section.visible === false;
  });
}

function applyHomeCms(sectionMap) {
  const hero = sectionMap.get('hero');
  if (hero) {
    setFirstText(['.hero-main', '#heroMain'], hero.title);
    setFirstText(['.hero-sub', '#heroDesc'], hero.subtitle);
    setFirstText(['.hero-description'], hero.body);
    renderButtons(document.querySelector('.hero-actions'), hero.buttons);
  }

  const about = sectionMap.get('about');
  if (about) {
    const root = getSectionRoot('about');
    setSectionText(root, about, { subtitleSelector: '.section-desc, .about-lead', bodySelector: '.about-text' });
    renderAboutValueBlocks(about);
    renderButtons(root?.querySelector('.about-actions'), about.buttons);
  }

  ['programs', 'school-life', 'agenda', 'gallery-preview', 'testimonials', 'admissions-cta', 'contact'].forEach(key => {
    const section = sectionMap.get(key);
    if (!section) return;
    const root = getSectionRoot(key) ||
      document.getElementById(key === 'school-life' ? 'activities' : key === 'agenda' ? 'events' : key === 'gallery-preview' ? 'gallery' : key);
    if (!root) return;
    setSectionText(root, section);
  });

  renderProgramBlocks(sectionMap.get('programs'));
  renderActivityBlocks(sectionMap.get('school-life'));
  renderHomeEventBlocks(sectionMap.get('agenda'));
  renderGalleryPreviewBlocks(sectionMap.get('gallery-preview'));
  renderTestimonialsBlocks(sectionMap.get('testimonials'));
  const admissionsCta = sectionMap.get('admissions-cta');
  if (admissionsCta) renderButtons(getSectionRoot('admissions-cta')?.querySelector('.cta-actions'), admissionsCta.buttons);
}

function applyAboutCms(sectionMap) {
  const header = sectionMap.get('header');
  if (header) {
    setFirstText(['.page-hero h1'], header.title);
    setFirstText(['.page-hero p'], header.subtitle || header.body);
  }

  const history = sectionMap.get('history');
  if (history) {
    const paragraphs = splitParagraphs(history.body);
    setFirstText(['[data-cms-section="history"] .section-label'], history.title);
    setFirstText(['[data-cms-section="history"] .section-title'], history.subtitle);
    setCmsText('aboutHistory1', paragraphs[0]);
    setCmsText('aboutHistory2', paragraphs[1]);
    setCmsText('aboutHistory3', paragraphs[2]);
  }

  const foundations = sectionMap.get('foundations');
  if (foundations) {
    setFirstText(['[data-cms-section="foundations"] .section-title'], foundations.title);
    setFirstText(['[data-cms-section="foundations"] .section-desc'], foundations.subtitle);
    renderFoundationBlocks(foundations);
  }

  const team = sectionMap.get('team');
  if (team) {
    setFirstText(['[data-cms-section="team"] .section-title'], team.title);
    setFirstText(['[data-cms-section="team"] .section-desc'], team.subtitle);
    renderTeamBlocks(team.blocks);
  }
}

function applyPageHeaderCms(sectionMap) {
  const header = sectionMap.get('header');
  if (!header) return;
  setFirstText(['.page-hero h1', '#accessTitle'], header.title);
  setFirstText(['.page-hero p', '#accessHelpText'], header.body || header.subtitle);
}

function applySchoolingCms(sectionMap) {
  applyPageHeaderCms(sectionMap);
  const header = sectionMap.get('header');
  if (header?.body) setCmsText('scoIntro', header.body);

  const curriculum = sectionMap.get('curriculum');
  if (curriculum) {
    setSectionText(getSectionRoot('curriculum'), curriculum);
    renderCursusBlocks(curriculum);
  }

  const orientation = sectionMap.get('orientation');
  if (orientation) {
    setSectionText(getSectionRoot('orientation'), orientation);
    renderCursusBlocks(orientation);
  }

  const faq = sectionMap.get('faq');
  if (faq) {
    setSectionText(getSectionRoot('faq'), faq);
    renderFaqBlocks(faq);
  }
}

function applyAdmissionsCms(sectionMap) {
  applyPageHeaderCms(sectionMap);
  const header = sectionMap.get('header');
  if (header?.body) setCmsText('admIntro', header.body);

  const process = sectionMap.get('process');
  if (process) {
    setSectionText(getSectionRoot('process'), process);
    renderTimelineBlocks(process);
  }

  const documents = sectionMap.get('required-documents');
  if (documents) {
    setSectionText(getSectionRoot('required-documents'), documents);
    renderDocumentBlocks(documents);
  }

  const formIntro = sectionMap.get('application-form-intro');
  if (formIntro) {
    setSectionText(getSectionRoot('application-form-intro'), formIntro);
  }
}

function applyContactCms(sectionMap) {
  applyPageHeaderCms(sectionMap);
  const info = sectionMap.get('contact-info');
  if (info) setSectionText(getSectionRoot('contact-info'), info);

  const intro = sectionMap.get('contact-form-intro');
  if (intro) {
    setSectionText(getSectionRoot('contact-form-intro'), intro);
  }
}

function applySchoolAccessCms(sectionMap) {
  applyPageHeaderCms(sectionMap);
  const intro = sectionMap.get('access-intro');
  if (intro) {
    setSectionText(getSectionRoot('access-intro'), intro);
    if (intro.body) setCmsText('accessHelpText', intro.body);
    renderGenericBlocks(getSectionRoot('access-intro'), intro);
  }

  const linkSection = sectionMap.get('gestschool-link');
  if (linkSection) {
    const button = Array.isArray(linkSection.buttons) ? linkSection.buttons.find(item => item?.visible !== false) : null;
    const link = document.getElementById('gestschoolLoginLink');
    if (link && button?.label) link.textContent = button.label;
    if (link && button?.url) link.href = button.url;
    if (linkSection.body) setCmsText('accessHelpText', linkSection.body);
  }
}

function applyGenericCms(sectionMap) {
  applyPageHeaderCms(sectionMap);
  const intro = sectionMap.get('intro');
  if (intro) {
    const root = getSectionRoot('intro');
    setSectionText(root, intro);
    renderGenericBlocks(root, intro);
  }
}

function applyStructuredCmsPage(payload) {
  if (!payload?.page) return;
  const sectionMap = getSectionMap(payload);

  if (payload.page.metaTitle) document.title = payload.page.metaTitle;
  setMetaContent('description', payload.page.metaDescription);
  applyCmsVisibility(sectionMap);

  switch (payload.page.slug) {
    case 'home':
      applyHomeCms(sectionMap);
      break;
    case 'about':
      applyAboutCms(sectionMap);
      break;
    case 'schooling':
      applySchoolingCms(sectionMap);
      break;
    case 'admissions':
      applyAdmissionsCms(sectionMap);
      break;
    case 'contact':
      applyContactCms(sectionMap);
      break;
    case 'school-access':
      applySchoolAccessCms(sectionMap);
      break;
    default:
      applyGenericCms(sectionMap);
  }
}

/**
 * Initialise les éléments communs de chaque page publique.
 * À appeler au DOMContentLoaded de chaque page.
 */
async function initPublicPage() {
  injectSchoolAccessLink();

  let s = {};
  try {
    s = await API.getPublicSettings();
  } catch (e) {
    console.warn('[initPublicPage] settings globaux indisponibles :', e.message);
  }

  // ── Logo dynamique ──────────────────────────────
  if (s.logo_path) {
    document.querySelectorAll(
      '.nav-logo-img, .footer-logo-img, .sidebar-brand-logo'
    ).forEach(img => {
      img.src = s.logo_path;
      img.style.display = '';
    });
  }

  // ── Icônes réseaux sociaux ───────────────────────
  // Injecte dans .footer-social-slot (footer de toutes pages)
  if (window.SocialIcons) {
    SocialIcons.render(s, 'footer-social-slot', '');
    // Injecte dans .page-social-slot (section contact)
    SocialIcons.render(s, 'page-social-slot', 'lg');
    // Section Hero contact (index.html)
    const heroSocial = document.getElementById('heroContactSocial');
    if (heroSocial) {
      heroSocial.innerHTML = SocialIcons.renderHTML(s, '');
    }
  }

  // ── Footer textes dynamiques ─────────────────────
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };

  setEl('footerTagline',   s.footer_tagline);
  setEl('footerCopyright', s.footer_copyright);
  setEl('f-address', s.school_address);
  setEl('f-phone',   s.school_phone);
  setEl('f-email',   s.school_email);
  setEl('f-hours',   s.school_hours);
  setEl('info-address', s.school_address);
  setEl('info-phone', s.school_phone);
  setEl('info-phone2', s.school_phone2);
  setEl('info-email', s.school_email);
  setEl('info-email2', s.school_email2);
  setEl('info-hours', s.school_hours);

  const pageSlug = getCurrentCmsPageSlug();
  if (pageSlug && window.API) {
    const [navigationResult, footerResult, pageResult] = await Promise.allSettled([
      API.getCmsNavigation(),
      API.getCmsFooter(),
      API.getCmsPage(pageSlug),
    ]);

    if (navigationResult.status === 'fulfilled') applyCmsNavigation(navigationResult.value);
    if (footerResult.status === 'fulfilled') applyCmsFooter(footerResult.value);
    if (pageResult.status === 'fulfilled') applyStructuredCmsPage(pageResult.value);
  }

  return s;
}

window.initPublicPage = initPublicPage;
window.AlManaratPublic = {
  injectSchoolAccessLink,
  normalizeGestSchoolUrl,
  applyStructuredCmsPage,
};
