/**
 * ReviseCode Subjects Controller (js/subjects.js)
 * Connects subjects management with backend Express API.
 */

import { api } from './api.js';
import { showToast, showConfirmModal } from './navigation.js';
import { renderEmptyState } from './app.js';

let currentSubjects = [];
let isLoading = false;

export function initSubjects() {
  const container = document.getElementById('subjectsGrid');
  if (!container) return;

  loadSubjects();

  // Search input
  const searchInput = document.getElementById('subjectsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = currentSubjects.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.topics && s.topics.some(t => t.toLowerCase().includes(q)))
      );
      renderSubjectsGrid(filtered);
    });
  }

  // Add Subject Button & Modal
  const addBtn = document.getElementById('addSubjectBtn');
  const modal = document.getElementById('subjectModal');
  const form = document.getElementById('subjectForm');
  const modalTitle = document.getElementById('subjectModalTitle');

  if (addBtn && modal) {
    addBtn.addEventListener('click', () => {
      form.reset();
      document.getElementById('subjectId').value = '';
      if (modalTitle) modalTitle.textContent = 'Add New Subject';
      modal.classList.add('is-open');
    });
  }

  const closeBtn = document.getElementById('subjectModalClose');
  const cancelBtn = document.getElementById('subjectModalCancel');
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('is-open');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('is-open');

  if (form) {
    let isSaving = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSaving) return;

      const id = document.getElementById('subjectId').value;
      const name = document.getElementById('subjectNameInput').value.trim();
      const color = document.getElementById('subjectColorInput').value || '#7c3aed';
      const icon = document.getElementById('subjectIconSelect').value || 'folder';
      const topicsStr = document.getElementById('subjectTopicsInput').value.trim();
      const topics = topicsStr ? topicsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

      if (!name) {
        showToast('Error', 'Subject name is required', 'error');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Subject';

      const payload = {
        name,
        color,
        icon,
        topics
      };

      try {
        isSaving = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-sm"></span> Saving...';
        }

        if (id) {
          await api.put(`/subjects/${id}`, payload);
          showToast('Success', `Subject "${name}" updated successfully!`, 'success');
        } else {
          await api.post('/subjects', payload);
          showToast('Success', `Subject "${name}" created successfully!`, 'success');
        }

        modal.classList.remove('is-open');
        await loadSubjects();
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        isSaving = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    });
  }
}

async function loadSubjects() {
  const container = document.getElementById('subjectsGrid');
  if (!container) return;

  isLoading = true;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
      <p>Loading subjects...</p>
    </div>
  `;

  try {
    const res = await api.get('/subjects');
    currentSubjects = res.data || [];
    isLoading = false;
    renderSubjectsGrid(currentSubjects);
  } catch (err) {
    isLoading = false;
    console.error('Failed to load subjects:', err);
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 24px; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); text-align: center;">
        <h4 style="margin-bottom: 8px;">Failed to load subjects</h4>
        <p style="font-size: 13px; margin-bottom: 16px;">${err.message}</p>
        <button id="retrySubjectsBtn" class="btn btn-secondary btn-sm">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    document.getElementById('retrySubjectsBtn')?.addEventListener('click', loadSubjects);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function renderSubjectsGrid(subjects) {
  const container = document.getElementById('subjectsGrid');
  if (!container) return;

  if (subjects.length === 0) {
    renderEmptyState(container, {
      icon: 'folder-plus',
      title: 'No Subjects Found',
      desc: 'Create a new subject to categorize your coding questions.',
      actionText: 'Add First Subject',
      onAction: () => {
        const modal = document.getElementById('subjectModal');
        if (modal) modal.classList.add('is-open');
      }
    });
    return;
  }

  container.innerHTML = subjects.map(s => `
    <div class="card card-interactive" style="border-top: 4px solid ${s.color};">
      <div class="card-header" style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: var(--radius-md); background-color: ${s.color}20; color: ${s.color}; display: flex; align-items: center; justify-content: center;">
            <i data-lucide="${s.icon || 'folder'}" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <h3 class="card-title" style="font-size: 1.125rem;">${s.name}</h3>
            <span style="font-size: 12px; color: var(--text-muted);">${s.questionCount || 0} Questions</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">Pending Revisions</span>
          <span class="badge ${(s.pendingCount || 0) > 0 ? 'badge-due' : 'badge-completed'}">${s.pendingCount || 0} Due</span>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px;">
          ${(s.topics || []).slice(0, 4).map(t => `<span class="badge" style="background: var(--bg-surface-elevated); font-size: 11px;">${t}</span>`).join('')}
          ${(s.topics || []).length > 4 ? `<span class="badge" style="background: var(--bg-surface-elevated); font-size: 11px;">+${s.topics.length - 4} more</span>` : ''}
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
        <a href="questions.html?subject=${encodeURIComponent(s.name)}" class="btn btn-secondary btn-sm">
          View Questions
        </a>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-ghost btn-sm edit-btn" data-id="${s.id}" title="Edit Subject">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn btn-ghost btn-sm text-danger delete-btn" data-id="${s.id}" data-name="${s.name}" title="Delete Subject">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach event handlers
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const subject = currentSubjects.find(s => s.id === id);
      if (subject) {
        document.getElementById('subjectId').value = subject.id;
        document.getElementById('subjectNameInput').value = subject.name;
        document.getElementById('subjectColorInput').value = subject.color;
        document.getElementById('subjectIconSelect').value = subject.icon || 'folder';
        document.getElementById('subjectTopicsInput').value = (subject.topics || []).join(', ');
        document.getElementById('subjectModalTitle').textContent = `Edit Subject: ${subject.name}`;
        document.getElementById('subjectModal').classList.add('is-open');
      }
    };
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      showConfirmModal({
        title: 'Delete Subject',
        message: `Are you sure you want to delete the subject "${name}"? Subjects with assigned questions cannot be deleted.`,
        confirmText: 'Delete',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/subjects/${id}`);
            showToast('Deleted', `Subject "${name}" deleted.`, 'info');
            await loadSubjects();
          } catch (err) {
            showToast('Cannot Delete', err.message, 'warning');
          }
        }
      });
    };
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSubjects();
});
