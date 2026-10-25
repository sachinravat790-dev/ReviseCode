/**
 * ReviseCode Profile Controller (js/profile.js)
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { formatDate } from './app.js';
import { showToast } from './navigation.js';

export function initProfile() {
  renderProfile();

  const editBtn = document.getElementById('editProfileBtn');
  const modal = document.getElementById('editProfileModal');
  const form = document.getElementById('editProfileForm');

  if (editBtn && modal) {
    editBtn.onclick = () => {
      const p = StorageManager.getProfile();
      document.getElementById('editNameInput').value = p.name || '';
      document.getElementById('editRoleInput').value = p.role || '';
      document.getElementById('editInterestsInput').value = (p.interests || []).join(', ');
      modal.classList.add('is-open');
    };
  }

  const closeBtn = document.getElementById('profileModalClose');
  const cancelBtn = document.getElementById('profileModalCancel');
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('is-open');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('is-open');

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('editNameInput').value.trim();
      const role = document.getElementById('editRoleInput').value.trim();
      const interestsStr = document.getElementById('editInterestsInput').value.trim();

      StorageManager.saveProfile({
        name,
        role,
        interests: interestsStr ? interestsStr.split(',').map(s => s.trim()) : []
      });

      modal.classList.remove('is-open');
      showToast('Profile Updated', 'Your profile details have been saved.', 'success');
      renderProfile();
    };
  }
}

async function renderProfile() {
  const profile = StorageManager.getProfile();
  let totalQuestions = 0;
  let completedSessions = 0;
  let streakDays = profile.streakDays || 5;

  try {
    const [statsRes, activityRes] = await Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/activity', { limit: 100 })
    ]);
    const stats = statsRes.data || {};
    const sessions = activityRes.data?.items || [];
    totalQuestions = stats.totalQuestions ?? 0;
    completedSessions = sessions.length;
    streakDays = stats.completed > 0 ? stats.completed : (profile.streakDays || 5);
  } catch (err) {
    const metrics = StorageManager.getDashboardMetrics();
    totalQuestions = metrics.totalQuestions;
    completedSessions = metrics.completedSessionsCount;
    streakDays = metrics.streakDays;
  }

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const roleEl = document.getElementById('profileRole');
  const dateEl = document.getElementById('profileDateJoined');
  const avatarEl = document.getElementById('profileAvatar');
  const interestsContainer = document.getElementById('profileInterestsContainer');

  const statSaved = document.getElementById('profileStatSaved');
  const statCompleted = document.getElementById('profileStatCompleted');
  const statStreak = document.getElementById('profileStatStreak');

  if (nameEl) nameEl.textContent = profile.name || 'Sachin Kumar';
  if (emailEl) emailEl.textContent = profile.email || 'sachin@example.com';
  if (roleEl) roleEl.textContent = profile.role || 'Software Engineer';
  if (dateEl) dateEl.textContent = formatDate(profile.dateJoined || '2026-09-15');
  if (avatarEl) avatarEl.textContent = profile.avatar || 'SK';

  if (statSaved) statSaved.textContent = totalQuestions;
  if (statCompleted) statCompleted.textContent = completedSessions;
  if (statStreak) statStreak.textContent = `${streakDays} Days`;

  if (interestsContainer) {
    interestsContainer.innerHTML = (profile.interests || ['DSA', 'System Design']).map(tag => `
      <span class="badge" style="background: var(--bg-surface-elevated); padding: 6px 12px; font-size: 13px;">${tag}</span>
    `).join('');
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profileName')) {
    initProfile();
  }
});
