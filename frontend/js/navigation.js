/**
 * ReviseCode App Navigation & Shell Manager (js/navigation.js)
 * Handles sidebar responsiveness, active navigation links, notifications pill, dropdowns, and search modal.
 */

import './icons.js';
import { api } from './api.js';
import { StorageManager } from './storage.js';
import { AuthService } from './auth.js';

// Global Toast Notifications
export function showToast(title, message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : (type === 'warning' ? 'alert-triangle' : 'info'));

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close notification">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (typeof toast.remove === 'function') toast.remove();
    }, 300);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
  }
  setTimeout(dismiss, duration);
}

// Global Reusable Confirmation Modal
export function showConfirmModal({ title, message, confirmText = 'Confirm', isDanger = false, onConfirm }) {
  let backdrop = document.getElementById('globalConfirmModal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'globalConfirmModal';
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modalCloseBtn" aria-label="Close modal">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); line-height: 1.6;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modalConfirmBtn">${confirmText}</button>
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  backdrop.classList.add('is-open');

  const close = () => {
    backdrop.classList.remove('is-open');
  };

  backdrop.querySelector('#modalCloseBtn').onclick = close;
  backdrop.querySelector('#modalCancelBtn').onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  backdrop.querySelector('#modalConfirmBtn').onclick = () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  };
}

// Global Quick Search Dialog
export function openSearchModal() {
  let modal = document.getElementById('globalSearchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalSearchModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <div class="input-icon-wrapper" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="globalSearchInput" class="form-control" placeholder="Search questions, topics, subjects, notes..." autofocus>
          </div>
          <button class="modal-close" id="searchCloseBtn" style="margin-left: 12px;"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body" id="searchResultsArea" style="max-height: 380px; overflow-y: auto;">
          <p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 0;">Type 2 or more characters to search saved questions...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#globalSearchInput');
    const results = modal.querySelector('#searchResultsArea');
    let searchDebounce = null;

    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (searchDebounce) clearTimeout(searchDebounce);

      if (q.length < 2) {
        results.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 0;">Type 2 or more characters to search saved questions...</p>`;
        return;
      }

      results.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 0;">Searching questions...</p>`;

      searchDebounce = setTimeout(async () => {
        try {
          const res = await api.get('/questions', { search: q });
          const filtered = res.data?.items || [];

          if (filtered.length === 0) {
            results.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 0;">No matching questions found.</p>`;
            return;
          }

          results.innerHTML = filtered.map(item => `
            <a href="question-detail.html?id=${item.id}" class="queue-item" style="margin-bottom: 8px; text-decoration: none;">
              <div class="queue-item-left">
                <span class="platform-pill platform-leetcode">${item.platform} ${item.problemNumber || ''}</span>
                <div class="queue-item-info">
                  <div class="queue-item-title">${item.title}</div>
                  <div class="queue-item-meta">
                    <span>${item.subject || 'DSA'} • ${item.topic || 'General'}</span>
                    <span class="badge badge-${(item.difficulty || 'medium').toLowerCase()}">${item.difficulty || 'Medium'}</span>
                  </div>
                </div>
              </div>
              <i data-lucide="chevron-right" style="color: var(--text-muted); width: 16px;"></i>
            </a>
          `).join('');

          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        } catch (err) {
          // Fallback to local storage if network error
          const questions = StorageManager.getQuestions();
          const filtered = questions.filter(item => 
            item.title.toLowerCase().includes(q) ||
            (item.problemNumber && String(item.problemNumber).includes(q)) ||
            (item.subject && item.subject.toLowerCase().includes(q)) ||
            (item.topic && item.topic.toLowerCase().includes(q))
          );
          if (filtered.length === 0) {
            results.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 0;">No matching questions found.</p>`;
          } else {
            results.innerHTML = filtered.map(item => `
              <a href="question-detail.html?id=${item.id}" class="queue-item" style="margin-bottom: 8px; text-decoration: none;">
                <div class="queue-item-left">
                  <span class="platform-pill platform-leetcode">${item.platform} ${item.problemNumber || ''}</span>
                  <div class="queue-item-info">
                    <div class="queue-item-title">${item.title}</div>
                    <div class="queue-item-meta">
                      <span>${item.subject} • ${item.topic}</span>
                      <span class="badge badge-${item.difficulty.toLowerCase()}">${item.difficulty}</span>
                    </div>
                  </div>
                </div>
                <i data-lucide="chevron-right" style="color: var(--text-muted); width: 16px;"></i>
              </a>
            `).join('');
          }
        }
      }, 250);
    });

    modal.querySelector('#searchCloseBtn').onclick = () => modal.classList.remove('is-open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('is-open'); };
  }

  modal.classList.add('is-open');
  const input = modal.querySelector('#globalSearchInput');
  setTimeout(() => input.focus(), 100);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Initialize Navigation & Shell Interactions
export function initNavigation() {
  // Check authentication for protected application pages (supports clean URLs and .html extensions)
  const path = (typeof window !== 'undefined' && window.location?.pathname) ? window.location.pathname.toLowerCase() : '';
  const rawFile = path.split('/').pop() || 'index';
  const cleanFile = rawFile.replace(/\.html$/, '');
  const isPublicPage = cleanFile === '' || 
                       cleanFile === 'index' || 
                       cleanFile === 'login' || 
                       cleanFile === 'register' || 
                       cleanFile === 'forgot-password';

  if (!isPublicPage && !AuthService.isAuthenticated()) {
    // If incoming OAuth callback hash is present on a protected page, handle it before redirecting
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
      AuthService.handleOAuthCallback().then(result => {
        if (result && result.success) {
          window.location.reload();
        } else {
          window.location.replace('login.html');
        }
      }).catch(() => {
        window.location.replace('login.html');
      });
      return;
    }
    window.location.replace('login.html');
    return;
  }

  // Mobile Sidebar Drawer
  const menuToggle = document.getElementById('menuToggleBtn');
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
      if (overlay) overlay.classList.toggle('active');
    });
  }

  if (overlay && sidebar) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('active');
    });
  }

  // Handle viewport resize to reset drawer state and overlay on desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      if (sidebar && sidebar.classList.contains('is-open')) {
        sidebar.classList.remove('is-open');
      }
      if (overlay && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
      }
    }
  });

  // Ensure native browser context menu is always enabled and never obstructed
  window.addEventListener('contextmenu', (e) => {
    // Explicitly guarantee native contextmenu is allowed to bubble and open
    if (e.defaultPrevented) {
      // If any child unexpectedly cancelled, allow the native context menu
      return true;
    }
  }, { passive: true, capture: false });

  // Active link detection (handles both standard .html and clean URLs)
  const rawPath = window.location.pathname.split('/').pop() || 'dashboard.html';
  const currentPath = rawPath.endsWith('.html') ? rawPath : (rawPath ? `${rawPath}.html` : 'dashboard.html');
  let targetNavHref = currentPath;
  if (currentPath === '' || currentPath === 'index.html') {
    targetNavHref = 'dashboard.html';
  } else if (currentPath === 'add-question.html' || currentPath === 'question-detail.html') {
    targetNavHref = 'questions.html';
  } else if (currentPath === 'profile.html') {
    targetNavHref = 'settings.html';
  }

  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === targetNavHref) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Synchronize dynamic user profile in sidebar & topbar
  try {
    const userSession = AuthService.getCurrentUser();
    const storedProfile = StorageManager.getProfile();
    const fullName = userSession?.name || storedProfile?.name || 'Learner';
    const role = storedProfile?.role || 'Learner';
    const initials = userSession?.avatar || storedProfile?.avatar || fullName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

    document.querySelectorAll('.sidebar-footer .user-avatar, #userProfileMenuBtn').forEach(el => {
      el.textContent = initials;
    });

    const sidebarName = document.querySelector('.sidebar-footer .user-name');
    if (sidebarName) sidebarName.textContent = fullName;

    const sidebarRole = document.querySelector('.sidebar-footer .user-role');
    if (sidebarRole) sidebarRole.textContent = role;

    const dashboardWelcome = document.getElementById('dashboardWelcomeName');
    if (dashboardWelcome) dashboardWelcome.textContent = fullName.split(' ')[0] || 'Learner';
  } catch (err) {
    console.debug('Error populating navigation profile:', err);
  }

  // Notifications Badge Counter from backend API
  const notifBadge = document.getElementById('topbarNotifBadge');
  if (notifBadge) {
    api.get('/notifications').then(res => {
      const items = res.data?.items || [];
      const unread = items.filter(n => !n.isRead).length;
      notifBadge.style.display = unread > 0 ? 'block' : 'none';
    }).catch(() => {
      const unread = StorageManager.getNotifications().filter(n => !n.isRead).length;
      notifBadge.style.display = unread > 0 ? 'block' : 'none';
    });
  }

  // Sidebar Due Badge Counter from backend API
  const dueBadge = document.getElementById('sidebarDueBadge');
  if (dueBadge) {
    api.get('/dashboard/stats').then(res => {
      const stats = res.data || {};
      const dueCount = (stats.dueToday || 0) + (stats.overdue || 0);
      if (dueCount > 0) {
        dueBadge.textContent = `${dueCount} Due`;
        dueBadge.style.display = 'inline-block';
      } else {
        dueBadge.style.display = 'none';
      }
    }).catch(() => {
      const dueCount = StorageManager.getMilestones().filter(m => m.status === 'due' || m.status === 'overdue').length;
      if (dueCount > 0) {
        dueBadge.textContent = `${dueCount} Due`;
        dueBadge.style.display = 'inline-block';
      } else {
        dueBadge.style.display = 'none';
      }
    });
  }

  // User Profile Dropdown
  const userBtn = document.getElementById('userProfileMenuBtn');
  const userDropdown = document.getElementById('userProfileDropdown');
  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', () => {
      userDropdown.classList.remove('is-open');
    });
  }

  // Logout Triggers
  const handleLogout = (e) => {
    e.preventDefault();
    showConfirmModal({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of ReviseCode?',
      confirmText: 'Sign Out',
      isDanger: true,
      onConfirm: () => AuthService.logout()
    });
  };

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
  if (dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', handleLogout);

  // Search Triggers
  document.querySelectorAll('.search-trigger').forEach(btn => {
    btn.addEventListener('click', openSearchModal);
  });

  // Global Keyboard shortcut: Command+K / Ctrl+K opens search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    }
  });

  // Re-run icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Auto init on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
  });
}
