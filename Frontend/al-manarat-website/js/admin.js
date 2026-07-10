// ════════════════════════════════════════════════
//  Al Manarat — Admin JS (js/admin.js)
//  Logique commune du dashboard admin
// ════════════════════════════════════════════════

const ADMIN_BASE_PATH = window.location.pathname.startsWith('/admin-site') ? '/admin-site' : '/admin';

function adminPath(pathname = 'dashboard.html') {
  const clean = String(pathname)
    .replace(/^\/?(admin-site|admin)\//, '')
    .replace(/^\/+/, '');
  return `${ADMIN_BASE_PATH}/${clean || 'dashboard.html'}`;
}

const Admin = {

  // ── Auth ───────────────────────────────────────
  getToken() { return localStorage.getItem('am_token'); },

  getUser() {
    try {
      const token = this.getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch { return null; }
  },

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch { return false; }
  },

  checkAuth() {
    if (!this.isAuthenticated()) {
      localStorage.removeItem('am_token');
      window.location.href = adminPath('login.html');
      return false;
    }
    return true;
  },

  logout() {
    localStorage.removeItem('am_token');
    window.location.href = adminPath('login.html');
  },

  // ── Toast Notifications ─────────────────────────
  showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || '💬'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ── Confirm Dialog ──────────────────────────────
  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-title">⚠️ Confirmation</div>
          <div class="modal-body">${message}</div>
          <div class="modal-footer">
            <button class="btn btn-outline btn-sm" id="cancelBtn">Annuler</button>
            <button class="btn btn-primary btn-sm" id="confirmBtn" style="background:linear-gradient(135deg,#ef4444,#b91c1c)">Confirmer</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#cancelBtn').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#confirmBtn').onclick = () => { overlay.remove(); resolve(true); };
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
  },

  // ── Date Formatting ─────────────────────────────
  formatDate(date, opts = {}) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', ...opts
    });
  },

  formatDateShort(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR');
  },

  timeAgo(date) {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)   return 'À l\'instant';
    if (mins  < 60)  return `Il y a ${mins} min`;
    if (hours < 24)  return `Il y a ${hours}h`;
    if (days  < 7)   return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    return this.formatDateShort(date);
  },

  // ── Status Badges ───────────────────────────────
  getStatusBadge(status) {
    const labels = {
      new:         { text: 'Nouvelle',   cls: 'status-new' },
      in_progress: { text: 'En cours',   cls: 'status-in_progress' },
      accepted:    { text: 'Acceptée',   cls: 'status-accepted' },
      refused:     { text: 'Refusée',    cls: 'status-refused' },
      incomplete:  { text: 'À compléter',cls: 'status-incomplete' },
      published:   { text: 'Publié',     cls: 'status-published' },
      draft:       { text: 'Brouillon',  cls: 'status-draft' },
      upcoming:    { text: 'À venir',    cls: 'status-upcoming' },
      past:        { text: 'Passé',      cls: 'status-past' },
    };
    const s = labels[status] || { text: status, cls: 'status-draft' };
    return `<span class="badge ${s.cls}">${s.text}</span>`;
  },

  // ── Sidebar Setup ───────────────────────────────
  setupSidebar() {
    // Mark active link
    const current = window.location.pathname.replace(/^\/admin-site\//, '/admin/');
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = (link.getAttribute('href') || '').replace(/^\/admin-site\//, '/admin/');
      if (href === current) link.classList.add('active');
    });

    // Set user info
    const user = this.getUser();
    if (user) {
      const nameEl = document.getElementById('sidebarUsername');
      const roleEl = document.getElementById('sidebarRole');
      const avatarEl = document.getElementById('sidebarAvatar');
      if (nameEl) nameEl.textContent = user.username;
      if (roleEl) roleEl.textContent = user.role === 'superadmin' ? 'Super Admin' : 'Admin';
      if (avatarEl) avatarEl.textContent = (user.username || 'A')[0].toUpperCase();
    }

    // Burger menu (mobile)
    const burger = document.getElementById('adminBurger');
    const sidebar = document.querySelector('.admin-sidebar');
    if (burger && sidebar) {
      burger.addEventListener('click', () => sidebar.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && e.target !== burger) {
          sidebar.classList.remove('open');
        }
      });
    }
  },

  // ── Fetch unread counts for badge ──────────────
  async loadBadgeCounts() {
    try {
      const stats = await window.API.getStats();
      const appBadge = document.getElementById('badgeCandidatures');
      const msgBadge = document.getElementById('badgeMessages');
      if (appBadge && stats.new_applications > 0) {
        appBadge.textContent = stats.new_applications;
        appBadge.style.display = 'inline';
      }
      if (msgBadge && stats.contacts_unread > 0) {
        msgBadge.textContent = stats.contacts_unread;
        msgBadge.style.display = 'inline';
      }
    } catch {}
  },

  // ── HTML escape ─────────────────────────────────
  escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // ── Init ────────────────────────────────────────
  init() {
    if (!this.checkAuth()) return;
    this.setupSidebar();
    this.loadBadgeCounts();

    // Logout button
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      btn.addEventListener('click', () => this.logout());
    });

    // Style: add slide-out animation
    const style = document.createElement('style');
    style.textContent = `@keyframes slideOutRight { to { transform:translateX(110%); opacity:0; } }`;
    document.head.appendChild(style);
  }
};

window.Admin = Admin;
window.AdminPath = adminPath;
