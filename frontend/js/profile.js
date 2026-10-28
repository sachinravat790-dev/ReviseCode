/**
 * ReviseCode Profile Controller (js/profile.js)
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { AuthService } from './auth.js';
import { formatDate } from './app.js';
import { showToast } from './navigation.js';

let currentAvatar = '';

/**
 * Center-crop image into a square 256x256 JPEG data URL
 */
function processAvatarImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file.'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const startX = Math.round((img.width - size) / 2);
        const startY = Math.round((img.height - size) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to decode image file.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function updateAvatarElement(el, avatarData, fallbackText = 'U') {
  if (!el) return;
  if (avatarData && (avatarData.startsWith('data:image') || avatarData.startsWith('http'))) {
    el.innerHTML = `<img src="${avatarData}" alt="Profile avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  } else {
    el.textContent = avatarData && avatarData.length <= 3 ? avatarData : fallbackText;
  }
}

export function initProfile() {
  renderProfile();

  const editBtn = document.getElementById('editProfileBtn');
  const modal = document.getElementById('editProfileModal');
  const form = document.getElementById('editProfileForm');

  const changeAvatarBtn = document.getElementById('changeAvatarBtn');
  const photoInput = document.getElementById('profilePhotoInput');
  const modalUploadBtn = document.getElementById('editModalUploadPhotoBtn');
  const modalRemoveBtn = document.getElementById('editModalRemovePhotoBtn');

  // Trigger file picker from camera icon on main card
  if (changeAvatarBtn && photoInput) {
    changeAvatarBtn.onclick = () => photoInput.click();
  }

  // Trigger file picker from modal button
  if (modalUploadBtn && photoInput) {
    modalUploadBtn.onclick = () => photoInput.click();
  }

  // Handle photo file selection & instant update
  if (photoInput) {
    photoInput.onchange = async () => {
      if (!photoInput.files || photoInput.files.length === 0) return;
      const file = photoInput.files[0];
      try {
        const compressedAvatar = await processAvatarImage(file);
        currentAvatar = compressedAvatar;

        // Persist to storage
        StorageManager.saveProfile({ avatar: compressedAvatar });

        // Synchronize active session user & persistent user avatar keys
        const sessionUser = AuthService.getCurrentUser();
        if (sessionUser) {
          sessionUser.avatar = compressedAvatar;
          localStorage.setItem('revisecode_user', JSON.stringify(sessionUser));
          if (sessionUser.email) {
            localStorage.setItem('revisecode_avatar_' + sessionUser.email.toLowerCase(), compressedAvatar);
          }
          if (sessionUser.id) {
            localStorage.setItem('revisecode_avatar_' + sessionUser.id, compressedAvatar);
          }
        }
        localStorage.setItem('revisecode_global_avatar', compressedAvatar);

        // Sync to backend database
        try {
          await api.put('/auth/profile', { avatar: compressedAvatar });
        } catch (e) {
          console.warn('Backend avatar sync deferred:', e.message);
        }

        showToast('Photo Updated', 'Profile picture updated successfully.', 'success');
        renderProfile();
      } catch (err) {
        showToast('Error', err.message || 'Could not process photo file.', 'error');
      }
      photoInput.value = '';
    };
  }

  // Remove photo and revert to initials
  if (modalRemoveBtn) {
    modalRemoveBtn.onclick = () => {
      const p = StorageManager.getProfile();
      const initials = p.name ? p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
      currentAvatar = initials;

      StorageManager.saveProfile({ avatar: initials });

      const sessionUser = AuthService.getCurrentUser();
      if (sessionUser) {
        sessionUser.avatar = initials;
        localStorage.setItem('revisecode_user', JSON.stringify(sessionUser));
      }

      showToast('Photo Removed', 'Reverted to letter avatar initials.', 'info');
      renderProfile();
    };
  }

  if (editBtn && modal) {
    editBtn.onclick = () => {
      const p = StorageManager.getProfile();
      document.getElementById('editNameInput').value = p.name || '';
      document.getElementById('editRoleInput').value = p.role || '';
      document.getElementById('editInterestsInput').value = (p.interests || []).join(', ');
      
      const modalAvatarPreview = document.getElementById('editModalAvatarPreview');
      updateAvatarElement(modalAvatarPreview, p.avatar, p.name ? p.name[0].toUpperCase() : 'U');

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

      const updateData = {
        name,
        role,
        interests: interestsStr ? interestsStr.split(',').map(s => s.trim()) : []
      };

      if (currentAvatar) {
        updateData.avatar = currentAvatar;
      }

      StorageManager.saveProfile(updateData);

      const sessionUser = AuthService.getCurrentUser();
      if (sessionUser) {
        sessionUser.name = name;
        if (currentAvatar) sessionUser.avatar = currentAvatar;
        localStorage.setItem('revisecode_user', JSON.stringify(sessionUser));
        if (currentAvatar && sessionUser.email) {
          localStorage.setItem('revisecode_avatar_' + sessionUser.email.toLowerCase(), currentAvatar);
        }
        if (currentAvatar && sessionUser.id) {
          localStorage.setItem('revisecode_avatar_' + sessionUser.id, currentAvatar);
        }
      }
      if (currentAvatar) localStorage.setItem('revisecode_global_avatar', currentAvatar);

      try {
        api.put('/auth/profile', { name, role, avatar: currentAvatar });
      } catch (_) {}

      modal.classList.remove('is-open');
      showToast('Profile Updated', 'Your profile details have been saved.', 'success');
      renderProfile();
    };
  }
}

async function renderProfile() {
  const profile = StorageManager.getProfile() || AuthService.getCurrentUser();
  currentAvatar = profile.avatar || '';

  let totalQuestions = 0;
  let completedSessions = 0;
  let streakDays = 0;

  try {
    const [statsRes, activityRes] = await Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/activity', { limit: 100 })
    ]);
    const stats = statsRes.data || {};
    const sessions = activityRes.data?.items || [];
    totalQuestions = stats.totalQuestions ?? 0;
    completedSessions = sessions.length;
    streakDays = stats.streak ?? 0;
  } catch (err) {
    const metrics = StorageManager.getDashboardMetrics();
    totalQuestions = metrics.totalQuestions;
    completedSessions = metrics.completedSessionsCount;
    streakDays = metrics.streakDays || 0;
  }

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const roleEl = document.getElementById('profileRole');
  const dateEl = document.getElementById('profileDateJoined');
  const avatarEl = document.getElementById('profileAvatar');
  const modalAvatarPreview = document.getElementById('editModalAvatarPreview');
  const interestsContainer = document.getElementById('profileInterestsContainer');

  const statSaved = document.getElementById('profileStatSaved');
  const statCompleted = document.getElementById('profileStatCompleted');
  const statStreak = document.getElementById('profileStatStreak');

  const initials = profile.name ? profile.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  if (nameEl) nameEl.textContent = profile.name || 'Learner';
  if (emailEl) emailEl.textContent = profile.email || '';
  if (roleEl) roleEl.textContent = profile.role || 'Learner';
  if (dateEl) dateEl.textContent = profile.dateJoined ? formatDate(profile.dateJoined) : 'Recently';

  updateAvatarElement(avatarEl, profile.avatar, initials);
  updateAvatarElement(modalAvatarPreview, profile.avatar, initials);

  // Synchronize navigation header and sidebar avatars
  document.querySelectorAll('.sidebar-footer .user-avatar, #userProfileMenuBtn').forEach(el => {
    updateAvatarElement(el, profile.avatar, initials);
  });

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
