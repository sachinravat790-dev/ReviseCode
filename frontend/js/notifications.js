/**
 * ReviseCode Notifications Controller (js/notifications.js)
 * Connects notifications and delivery preferences with backend APIs.
 */

import { api } from './api.js';
import { formatRelativeTime, renderEmptyState } from './app.js';
import { showToast } from './navigation.js';
import { pushManager } from './push-notifications.js';

let activeCategory = 'all';
let allNotifications = [];

export async function initNotifications() {
  // 1. Immediately wire push manager & buttons without waiting for network requests
  const enablePushBtn = document.getElementById('btnEnablePush');
  if (enablePushBtn) {
    enablePushBtn.onclick = async () => {
      await pushManager.subscribe();
    };
  }

  const testPushBtn = document.getElementById('btnTestPush');
  if (testPushBtn) {
    testPushBtn.onclick = async () => {
      await pushManager.sendTest();
    };
  }

  try {
    await pushManager.init();
  } catch (e) {
    console.warn('Push manager init error:', e);
  }

  // 2. Load notifications and preferences in parallel
  loadNotificationsList().catch(e => console.warn('Notifications load error:', e));
  loadSettingsPreferences().catch(e => console.warn('Settings load error:', e));

  // Category filter tabs
  document.querySelectorAll('.notif-filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-category');
      renderNotificationsList();
    };
  });

  // Mark all read button
  const markAllBtn = document.getElementById('markAllNotifsReadBtn');
  if (markAllBtn) {
    markAllBtn.onclick = async () => {
      try {
        const unread = allNotifications.filter(n => !n.isRead);
        await Promise.all(unread.map(n => api.patch(`/notifications/${n.id}/read`)));
        showToast('Notifications', 'All notifications marked as read', 'success');
        await loadNotificationsList();
        const badge = document.getElementById('topbarNotifBadge');
        if (badge) badge.style.display = 'none';
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    };
  }

  // Notification Preferences Form
  const prefForm = document.getElementById('notifPreferencesForm');
  if (prefForm) {
    prefForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api.put('/settings', {
          inAppNotifications: document.getElementById('prefInApp') ? document.getElementById('prefInApp').checked : true,
          emailNotifications: document.getElementById('prefEmail') ? document.getElementById('prefEmail').checked : true,
          whatsAppNotifications: false,
          whatsappPhone: '',
          whatsappApiKey: '',
          reminderTime: document.getElementById('prefReminderTime') ? document.getElementById('prefReminderTime').value : '09:00',
          quietHoursStart: document.getElementById('prefQuietStart') ? document.getElementById('prefQuietStart').value : '22:00',
          quietHoursEnd: document.getElementById('prefQuietEnd') ? document.getElementById('prefQuietEnd').value : '08:00'
        });
        showToast('Saved', 'Notification delivery preferences updated.', 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    };
  }
}

async function loadSettingsPreferences() {
  try {
    const res = await api.get('/settings');
    const settings = res.data || {};
    if (document.getElementById('prefInApp')) document.getElementById('prefInApp').checked = settings.inAppNotifications !== false;
    if (document.getElementById('prefEmail')) document.getElementById('prefEmail').checked = settings.emailNotifications !== false;
    if (document.getElementById('prefReminderTime')) document.getElementById('prefReminderTime').value = settings.reminderTime || '09:00';
    if (document.getElementById('prefQuietStart')) document.getElementById('prefQuietStart').value = settings.quietHoursStart || '22:00';
    if (document.getElementById('prefQuietEnd')) document.getElementById('prefQuietEnd').value = settings.quietHoursEnd || '08:00';
  } catch (err) {
    console.warn('Could not load notification preferences:', err.message);
  }
}

async function loadNotificationsList() {
  try {
    const res = await api.get('/notifications');
    allNotifications = res.data?.items || (Array.isArray(res.data) ? res.data : []);
    renderNotificationsList();
  } catch (err) {
    console.warn('Could not load notifications from backend:', err.message);
  }
}

function renderNotificationsList() {
  const container = document.getElementById('notificationsListContainer');
  if (!container) return;

  let filtered = allNotifications;
  if (activeCategory !== 'all') {
    filtered = allNotifications.filter(n => (n.category || '').toLowerCase() === activeCategory.toLowerCase());
  }

  if (filtered.length === 0) {
    renderEmptyState(container, {
      icon: 'bell-off',
      title: 'No Notifications',
      desc: 'You have no alerts in this category.'
    });
    return;
  }

  container.innerHTML = filtered.map(n => {
    const iconName = n.type === 'overdue' ? 'alert-triangle' : (n.type === 'revision_completed' ? 'check-circle' : (n.type === 'ai_action' ? 'bot' : 'bell'));
    const isUnread = !n.isRead;

    return `
      <div class="queue-item" style="padding: 14px; border-left: 3px solid ${isUnread ? 'var(--primary)' : 'transparent'}; background-color: ${isUnread ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)'};">
        <div class="queue-item-left" style="align-items: flex-start;">
          <div class="user-avatar" style="width: 36px; height: 36px; background: ${isUnread ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-subtle-hover)'}; color: ${isUnread ? 'var(--primary)' : 'var(--text-muted)'}; border: none;">
            <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
          </div>
          <div class="queue-item-info">
            <div class="queue-item-title" style="font-size: 14px;">
              ${n.title}
              ${isUnread ? `<span class="badge badge-due" style="font-size: 10px; padding: 2px 6px;">New</span>` : ''}
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 3px 0 6px;">${n.message}</p>
            <div class="queue-item-meta">
              <span>${n.category}</span>
              <span>•</span>
              <span>${formatRelativeTime(n.createdAt)}</span>
            </div>
          </div>
        </div>

        <div class="queue-item-actions">
          ${n.questionId ? `
            <a href="question-detail.html?id=${n.questionId}" class="btn btn-secondary btn-sm" title="View Question">
              <i data-lucide="external-link"></i>
            </a>
          ` : ''}
          ${isUnread ? `
            <button class="btn btn-ghost btn-sm mark-read-btn" data-id="${n.id}" title="Mark as Read">
              <i data-lucide="check"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Attach mark as read listeners
  container.querySelectorAll('.mark-read-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      try {
        await api.patch(`/notifications/${id}/read`);
        await loadNotificationsList();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    };
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('notificationsListContainer')) {
      initNotifications();
    }
  });
} else {
  if (document.getElementById('notificationsListContainer')) {
    initNotifications();
  }
}
