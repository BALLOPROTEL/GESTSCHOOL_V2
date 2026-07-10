/* ════════════════════════════════════════════════
   Al Manarat — Icônes SVG Réseaux Sociaux
   Composant uniforme pour TOUTES les pages
   v2 — SVG logomarks propres, fill forcé sur paths
   ════════════════════════════════════════════════ */

const SocialIcons = (() => {

  /* ────────────────────────────────────────────────
     Icônes SVG : LOGOMARKS SEULS (sans fond circulaire)
     Source : Simple Icons / Font Awesome style
     viewBox="0 0 24 24" uniforme
  ──────────────────────────────────────────────── */
  const ICONS = {

    facebook: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z"/>
    </svg>`,

    whatsapp: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.129.332.202.043.073.043.423-.101.827z"/>
    </svg>`,

    youtube: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>`,

    instagram: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>`,

    twitter: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>`,

    tiktok: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>`,
  };

  /* ── Config réseaux (ordre d'affichage) ─────── */
  const NETWORKS = [
    { key: 'facebook_url',  label: 'Facebook',  icon: 'facebook',  bg: '#1877F2' },
    { key: 'whatsapp_url',  label: 'WhatsApp',  icon: 'whatsapp',  bg: '#25D366' },
    { key: 'youtube_url',   label: 'YouTube',   icon: 'youtube',   bg: '#FF0000' },
    { key: 'instagram_url', label: 'Instagram', icon: 'instagram', bg: 'instagram' },
    { key: 'twitter_url',   label: 'Twitter/X', icon: 'twitter',   bg: '#14171A' },
    { key: 'tiktok_url',    label: 'TikTok',    icon: 'tiktok',    bg: '#010101' },
  ];

  /* ── Styles CSS injectés une seule fois ─────── */
  function injectStyles() {
    if (document.getElementById('am-social-styles')) return;
    const s = document.createElement('style');
    s.id = 'am-social-styles';
    s.textContent = `
      /* ── Ligne d'icônes sociales Al Manarat ── */
      .am-social-row {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .am-social-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        text-decoration: none;
        flex-shrink: 0;
        transition: transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.20);
        overflow: visible !important;
        position: relative;
      }
      .am-social-btn:hover {
        transform: translateY(-3px) scale(1.12);
        box-shadow: 0 6px 20px rgba(0,0,0,0.30);
        opacity: 0.92;
      }
      /* SVG et TOUS ses enfants en blanc */
      .am-social-btn svg {
        display: block !important;
        width: 20px !important;
        height: 20px !important;
        flex-shrink: 0;
        fill: #ffffff !important;
        color: #ffffff !important;
        pointer-events: none;
      }
      .am-social-btn svg path,
      .am-social-btn svg polygon,
      .am-social-btn svg rect,
      .am-social-btn svg circle,
      .am-social-btn svg ellipse {
        fill: #ffffff !important;
      }
      /* Variante grande (section contact page) */
      .am-social-btn.lg {
        width: 48px;
        height: 48px;
      }
      .am-social-btn.lg svg { width: 24px !important; height: 24px !important; }
      /* Variante mini (admin aperçu) */
      .am-social-btn.sm {
        width: 32px;
        height: 32px;
      }
      .am-social-btn.sm svg { width: 16px !important; height: 16px !important; }
      /* Instagram dégradé */
      .am-social-btn.am-ig {
        background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%) !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Génère le HTML d'un bouton ─────────────── */
  function makeBtn(network, url, size) {
    const isIg = network.bg === 'instagram';
    const bgStyle = isIg ? '' : `background:${network.bg}`;
    const cls = [
      'am-social-btn',
      isIg ? 'am-ig' : '',
      size ? size : '',
    ].filter(Boolean).join(' ');

    return `<li><a
      href="${esc(url)}"
      target="_blank"
      rel="noopener noreferrer"
      class="${cls}"
      style="${bgStyle}"
      title="${network.label}"
      aria-label="${network.label}"
    >${ICONS[network.icon]}</a></li>`;
  }

  /* ── Génère la liste <ul> complète ──────────── */
  function buildList(settings, size) {
    const items = NETWORKS
      .filter(n => settings[n.key] && settings[n.key].trim())
      .map(n => makeBtn(n, settings[n.key], size));
    return items.length
      ? `<ul class="am-social-row">${items.join('')}</ul>`
      : '';
  }

  /* ───────────────────────────────────────────────
     API publique
  ─────────────────────────────────────────────── */

  /**
   * Injecte les icônes dans tous les éléments `.{slotClass}`
   * @param {object} settings  - Objet settings publics
   * @param {string} slotClass - Classe CSS des slots cibles
   * @param {string} size      - '' | 'lg' | 'sm'
   */
  function render(settings = {}, slotClass = 'footer-social-slot', size = '') {
    injectStyles();
    const html = buildList(settings, size);
    document.querySelectorAll(`.${slotClass}`).forEach(el => {
      el.innerHTML = html || '';
    });
    return html;
  }

  /**
   * Retourne le HTML brut (pour admin aperçu, innerHTML direct)
   */
  function renderHTML(settings = {}, size = '') {
    injectStyles();
    return buildList(settings, size);
  }

  /* Rétrocompat */
  function renderSocialButtons(settings = {}, variant = '') {
    const size = variant === 'page' ? 'lg' : variant === 'mini' ? 'sm' : '';
    return renderHTML(settings, size);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render, renderHTML, renderSocialButtons, NETWORKS };
})();

window.SocialIcons = SocialIcons;
