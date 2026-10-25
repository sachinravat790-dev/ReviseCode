/**
 * ReviseCode Settings Controller (js/settings.js)
 * Connects settings view with backend GET/PUT /api/settings.
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { applyTheme } from './theme.js';
import { showToast, showConfirmModal } from './navigation.js';
import { AuthService } from './auth.js';

export async function initSettings() {
  await loadSettings();

  // Tab switching inside Settings page
  const settingsNavBtns = document.querySelectorAll('.settings-nav-btn');
  const sections = document.querySelectorAll('.settings-section');

  settingsNavBtns.forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-target');
      settingsNavBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.style.display = 'none');

      btn.classList.add('active');
      const activeSection = document.getElementById(target);
      if (activeSection) activeSection.style.display = 'block';
    };
  });

  // Profile Form
  const profileForm = document.getElementById('settingsProfileForm');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('setProfileName').value.trim();
      const role = document.getElementById('setProfileRole').value.trim();
      const interestsStr = document.getElementById('setProfileInterests').value.trim();

      StorageManager.saveProfile({
        name,
        role,
        interests: interestsStr ? interestsStr.split(',').map(s => s.trim()) : []
      });

      // Update sidebar username
      const sidebarName = document.querySelector('.sidebar-footer .user-name');
      if (sidebarName) sidebarName.textContent = name;

      showToast('Saved', 'Profile information updated successfully.', 'success');
    };
  }

  // Appearance Theme Switcher
  const themeDarkRadio = document.getElementById('themeRadioDark');
  const themeLightRadio = document.getElementById('themeRadioLight');

  if (themeDarkRadio && themeLightRadio) {
    const curTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (curTheme === 'light') {
      themeLightRadio.checked = true;
    } else {
      themeDarkRadio.checked = true;
    }

    themeDarkRadio.onchange = () => { if (themeDarkRadio.checked) applyTheme('dark'); };
    themeLightRadio.onchange = () => { if (themeLightRadio.checked) applyTheme('light'); };
  }

  // Revision Preferences Form
  const revPrefForm = document.getElementById('revisionPrefsForm');
  if (revPrefForm) {
    let isSavingPrefs = false;
    revPrefForm.onsubmit = async (e) => {
      e.preventDefault();
      if (isSavingPrefs) return;

      const studyGoal = parseInt(document.getElementById('setDailyGoal').value) || 3;
      const customEnabled = document.getElementById('setEnableCustomIntervals').checked;
      const submitBtn = revPrefForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Preferences';

      try {
        isSavingPrefs = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        }

        await api.put('/settings', {
          studyGoalQuestions: studyGoal,
          customIntervalsEnabled: customEnabled
        });
        showToast('Preferences Saved', 'Revision milestone settings updated.', 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        isSavingPrefs = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    };
  }

  // Gemini API Configuration Section
  const geminiStatusCard = document.getElementById('settingsGeminiStatusCard');
  const geminiForm = document.getElementById('settingsGeminiForm');
  const geminiInput = document.getElementById('settingsGeminiKeyInput');
  const geminiToggleBtn = document.getElementById('settingsToggleKeyVisibility');
  const geminiTestBtn = document.getElementById('settingsTestGeminiBtn');
  const geminiRemoveBtn = document.getElementById('settingsRemoveGeminiBtn');
  const geminiFeedback = document.getElementById('settingsGeminiFeedback');
  const geminiMaskedLabel = document.getElementById('settingsGeminiKeyMasked');

  async function loadGeminiStatus() {
    try {
      const res = await api.get('/assistant/status');
      const data = res.data || {};
      const isConfigured = Boolean(data.configured);

      if (geminiStatusCard) {
        if (isConfigured) {
          geminiStatusCard.style.background = 'rgba(16, 185, 129, 0.12)';
          geminiStatusCard.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          geminiStatusCard.style.color = '#10b981';
          geminiStatusCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 4px;">
              <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>
              Google Gemini Connected & Active
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
              Active Model: <strong>${data.activeModel || 'gemini-2.5-flash'}</strong> &bull; Masked Key: <code>${data.apiKeyMasked}</code>
            </div>
          `;
        } else {
          geminiStatusCard.style.background = 'rgba(245, 158, 11, 0.12)';
          geminiStatusCard.style.border = '1px solid rgba(245, 158, 11, 0.3)';
          geminiStatusCard.style.color = '#f59e0b';
          geminiStatusCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 4px;">
              <i data-lucide="info" style="width: 18px; height: 18px;"></i>
              Operating in Grounded Workspace Mode
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
              Gemini API key is unconfigured. Assistant answers tracking queries using Supabase records.
            </div>
          `;
        }
      }

      if (geminiMaskedLabel) {
        geminiMaskedLabel.textContent = isConfigured ? `Active: ${data.apiKeyMasked}` : 'Not configured';
      }

      if (geminiRemoveBtn) {
        geminiRemoveBtn.style.display = isConfigured ? 'inline-flex' : 'none';
      }

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } catch (err) {
      console.warn('Failed to fetch Gemini status:', err);
    }
  }

  if (geminiStatusCard) {
    loadGeminiStatus();
  }

  if (geminiToggleBtn && geminiInput) {
    geminiToggleBtn.onclick = () => {
      const isPass = geminiInput.type === 'password';
      geminiInput.type = isPass ? 'text' : 'password';
      geminiToggleBtn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" style="width: 16px; height: 16px;"></i>`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    };
  }

  if (geminiTestBtn) {
    geminiTestBtn.onclick = async () => {
      const inputVal = geminiInput ? geminiInput.value.trim() : '';
      geminiTestBtn.disabled = true;
      geminiTestBtn.innerHTML = '<span class="spinner-sm"></span> Testing...';
      if (geminiFeedback) {
        geminiFeedback.style.display = 'block';
        geminiFeedback.style.background = 'var(--bg-surface-elevated)';
        geminiFeedback.style.color = 'var(--text-secondary)';
        geminiFeedback.textContent = 'Contacting Google Gemini API...';
      }

      try {
        const res = await api.post('/assistant/test', {
          apiKey: inputVal || undefined
        });

        if (res.data.success) {
          geminiFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
          geminiFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          geminiFeedback.style.color = '#10b981';
          geminiFeedback.innerHTML = `<strong>✓ Connection Succeeded!</strong> Model: <em>${res.data.model}</em><br><span style="font-size: 11px;">Response: "${res.data.reply || 'OK'}"</span>`;
        } else {
          geminiFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
          geminiFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          geminiFeedback.style.color = '#ef4444';
          geminiFeedback.innerHTML = `<strong>✕ Connection Failed:</strong> ${res.data.message}`;
        }
      } catch (err) {
        if (geminiFeedback) {
          geminiFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
          geminiFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          geminiFeedback.style.color = '#ef4444';
          geminiFeedback.innerHTML = `<strong>✕ Network Error:</strong> ${err.message}`;
        }
      } finally {
        geminiTestBtn.disabled = false;
        geminiTestBtn.innerHTML = '<i data-lucide="activity"></i> Test Connection';
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    };
  }

  if (geminiForm) {
    geminiForm.onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('settingsSaveGeminiBtn');
      const inputVal = geminiInput ? geminiInput.value.trim() : '';

      if (!inputVal) {
        showToast('Input Required', 'Please enter a Gemini API Key to connect.', 'warning');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-sm"></span> Connecting...';
      }

      try {
        const res = await api.post('/assistant/configure', {
          apiKey: inputVal,
          persist: true
        });

        if (res.data.success) {
          showToast('Gemini Connected', 'Google Gemini API key verified and connected successfully!', 'success');
          if (geminiInput) geminiInput.value = '';
          await loadGeminiStatus();
        } else {
          showToast('Configuration Warning', res.data.message || 'Key saved but live test failed.', 'warning');
          await loadGeminiStatus();
        }
      } catch (err) {
        showToast('Error', err.message || 'Failed to save key', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="check"></i> Test & Save Key';
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    };
  }

  if (geminiRemoveBtn) {
    geminiRemoveBtn.onclick = () => {
      showConfirmModal({
        title: 'Disconnect Gemini API',
        message: 'Are you sure you want to remove the Gemini API Key? The assistant will switch back to local Grounded Workspace Mode.',
        confirmText: 'Disconnect',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete('/assistant/configure');
            showToast('Disconnected', 'Gemini key removed. Reverted to Grounded Workspace Mode.', 'info');
            if (geminiInput) geminiInput.value = '';
            await loadGeminiStatus();
          } catch (err) {
            showToast('Error', err.message, 'error');
          }
        }
      });
    };
  }

  // Data Export Button
  const exportBtn = document.getElementById('exportDataBtn');
  if (exportBtn) {
    let isExporting = false;
    exportBtn.onclick = async () => {
      if (isExporting) return;
      const originalText = exportBtn.innerHTML;

      try {
        isExporting = true;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<span class="spinner-sm"></span> Exporting...';

        const [questionsRes, revisionsRes, subjectsRes] = await Promise.all([
          api.get('/questions'),
          api.get('/revisions'),
          api.get('/subjects')
        ]);
        const backupData = {
          exportDate: new Date().toISOString(),
          storageNote: 'ReviseCode In-Memory Database Export',
          questions: questionsRes.data?.items || (Array.isArray(questionsRes.data) ? questionsRes.data : []),
          revisions: Array.isArray(revisionsRes.data) ? revisionsRes.data : (revisionsRes.data?.items || []),
          subjects: Array.isArray(subjectsRes.data) ? subjectsRes.data : (subjectsRes.data?.items || [])
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `revisecode_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Export Complete', 'Downloaded complete ReviseCode JSON database.', 'success');
      } catch (err) {
        showToast('Export Failed', err.message, 'error');
      } finally {
        isExporting = false;
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalText;
      }
    };
  }

  // Reset Demo Data Button
  const resetDemoBtn = document.getElementById('resetDemoDataBtn');
  if (resetDemoBtn) {
    resetDemoBtn.onclick = () => {
      showConfirmModal({
        title: 'Reset Demo Data',
        message: 'This will reset all local storage records back to the default demonstration seed dataset. Are you sure?',
        confirmText: 'Reset Demo Data',
        isDanger: true,
        onConfirm: () => {
          StorageManager.resetToSeed();
          showToast('Data Reset', 'Demo data reinitialized successfully.', 'success');
          setTimeout(() => window.location.reload(), 1000);
        }
      });
    };
  }

  // Sign out button
  const signOutBtn = document.getElementById('settingsSignOutBtn');
  if (signOutBtn) {
    signOutBtn.onclick = () => {
      showConfirmModal({
        title: 'Sign Out',
        message: 'Are you sure you want to end your current session?',
        confirmText: 'Sign Out',
        isDanger: true,
        onConfirm: () => AuthService.logout()
      });
    };
  }

  // Delete account button
  const deleteAcctBtn = document.getElementById('deleteAccountBtn');
  if (deleteAcctBtn) {
    deleteAcctBtn.onclick = () => {
      showConfirmModal({
        title: 'Delete Account',
        message: 'In Demo Mode, this will clear all local session storage and return to the login screen.',
        confirmText: 'Delete Account',
        isDanger: true,
        onConfirm: () => {
          localStorage.clear();
          sessionStorage.clear();
          showToast('Account Deleted', 'Local records cleared.', 'info');
          setTimeout(() => { window.location.href = 'login.html'; }, 1000);
        }
      });
    };
  }
}

async function loadSettings() {
  const profile = StorageManager.getProfile();

  const nameInput = document.getElementById('setProfileName');
  const roleInput = document.getElementById('setProfileRole');
  const emailInput = document.getElementById('setProfileEmail');
  const interestsInput = document.getElementById('setProfileInterests');

  if (nameInput) nameInput.value = profile.name || '';
  if (roleInput) roleInput.value = profile.role || '';
  if (emailInput) emailInput.value = profile.email || 'sachin@example.com';
  if (interestsInput) interestsInput.value = (profile.interests || []).join(', ');

  try {
    const res = await api.get('/settings');
    const settings = res.data || {};
    const goalInput = document.getElementById('setDailyGoal');
    const customIntervalCheck = document.getElementById('setEnableCustomIntervals');
    if (goalInput) goalInput.value = settings.studyGoalQuestions || 3;
    if (customIntervalCheck) customIntervalCheck.checked = settings.customIntervalsEnabled === true;
  } catch (err) {
    console.warn('Could not load backend settings:', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('settingsProfileForm')) {
    initSettings();
  }
});
