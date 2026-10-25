/**
 * ReviseCode Questions Controller (js/questions.js)
 * Connects frontend questions view with backend Express API.
 */

import { api } from './api.js';
import { formatDate, renderEmptyState } from './app.js';
import { showToast, showConfirmModal } from './navigation.js';

let allQuestions = [];
let allMilestones = [];
let currentViewMode = 'grid'; // 'grid' | 'list'
let isLoading = false;

export async function initQuestions() {
  setupFilterEventListeners();
  await loadSubjectsDropdown();
  await fetchQuestionsAndMilestones();
}

/**
 * Fetch subjects from backend to populate filter dropdown
 */
async function loadSubjectsDropdown() {
  const subjectSelect = document.getElementById('filterSubject');
  if (!subjectSelect) return;

  try {
    const res = await api.get('/subjects');
    const subjects = res.data || [];

    // Reset dropdown preserving "All Subjects"
    subjectSelect.innerHTML = '<option value="all">All Subjects</option>';
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      subjectSelect.appendChild(opt);
    });

    // Check query params for preset filter e.g. ?subject=DSA
    const params = new URLSearchParams(window.location.search);
    const subParam = params.get('subject');
    if (subParam) {
      subjectSelect.value = subParam;
    }
  } catch (err) {
    console.warn('Could not load subjects for dropdown:', err.message);
  }
}

/**
 * Fetch questions and revision milestones concurrently from backend
 */
async function fetchQuestionsAndMilestones() {
  const gridContainer = document.getElementById('questionsGridContainer');
  const countBadge = document.getElementById('questionsCountBadge');

  isLoading = true;
  if (countBadge) countBadge.textContent = 'Loading...';

  // Render loading skeleton state
  if (gridContainer) {
    gridContainer.style.display = 'grid';
    gridContainer.innerHTML = Array(3).fill(0).map(() => `
      <div class="question-card skeleton-card" style="opacity: 0.6; min-height: 180px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="height: 20px; width: 45%; background: var(--bg-surface-elevated); border-radius: 4px; margin-bottom: 12px;"></div>
          <div style="height: 24px; width: 75%; background: var(--bg-surface-elevated); border-radius: 4px; margin-bottom: 12px;"></div>
          <div style="height: 16px; width: 30%; background: var(--bg-surface-elevated); border-radius: 4px;"></div>
        </div>
        <div style="height: 32px; background: var(--bg-surface-elevated); border-radius: 4px;"></div>
      </div>
    `).join('');
  }

  try {
    const [questionsResult, revisionsResult] = await Promise.allSettled([
      api.get('/questions'),
      api.get('/revisions')
    ]);

    if (questionsResult.status === 'rejected') {
      throw questionsResult.reason;
    }

    allQuestions = questionsResult.value.data?.items || (Array.isArray(questionsResult.value.data) ? questionsResult.value.data : []);
    allMilestones = revisionsResult.status === 'fulfilled' 
      ? (Array.isArray(revisionsResult.value.data) ? revisionsResult.value.data : (revisionsResult.value.data?.items || []))
      : [];
    isLoading = false;

    applyFilters();
  } catch (err) {
    isLoading = false;
    console.error('Failed to load questions from backend:', err);
    if (countBadge) countBadge.textContent = 'Error';

    if (gridContainer) {
      gridContainer.style.display = 'block';
      gridContainer.innerHTML = `
        <div style="padding: 24px; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); text-align: center;">
          <h4 style="margin-bottom: 8px;">Failed to load questions</h4>
          <p style="font-size: 13px; margin-bottom: 16px;">${err.message}</p>
          <button id="retryQuestionsBtn" class="btn btn-secondary btn-sm">
            <i data-lucide="refresh-cw"></i> Retry Connection
          </button>
        </div>
      `;
      document.getElementById('retryQuestionsBtn')?.addEventListener('click', () => {
        fetchQuestionsAndMilestones();
      });
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }
}

/**
 * Filter and sort event listeners
 */
function setupFilterEventListeners() {
  const searchInput = document.getElementById('questionsSearchInput');
  const subjectSelect = document.getElementById('filterSubject');
  const difficultySelect = document.getElementById('filterDifficulty');
  const sortSelect = document.getElementById('sortQuestions');
  const gridToggleBtn = document.getElementById('viewGridBtn');
  const listToggleBtn = document.getElementById('viewListBtn');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (subjectSelect) subjectSelect.addEventListener('change', applyFilters);
  if (difficultySelect) difficultySelect.addEventListener('change', applyFilters);
  if (sortSelect) sortSelect.addEventListener('change', applyFilters);

  if (gridToggleBtn && listToggleBtn) {
    gridToggleBtn.onclick = () => {
      currentViewMode = 'grid';
      gridToggleBtn.classList.add('active');
      listToggleBtn.classList.remove('active');
      applyFilters();
    };
    listToggleBtn.onclick = () => {
      currentViewMode = 'list';
      listToggleBtn.classList.add('active');
      gridToggleBtn.classList.remove('active');
      applyFilters();
    };
  }
}

function applyFilters() {
  if (isLoading) return;

  const searchInput = document.getElementById('questionsSearchInput');
  const subjectSelect = document.getElementById('filterSubject');
  const difficultySelect = document.getElementById('filterDifficulty');
  const sortSelect = document.getElementById('sortQuestions');

  const q = (searchInput?.value || '').toLowerCase().trim();
  const subj = subjectSelect?.value || 'all';
  const diff = difficultySelect?.value || 'all';
  const sort = sortSelect?.value || 'newest';

  let filtered = allQuestions.filter(item => {
    const matchesSearch = !q || 
      item.title.toLowerCase().includes(q) || 
      (item.problemNumber && String(item.problemNumber).includes(q)) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(q))) ||
      (item.topic && item.topic.toLowerCase().includes(q));

    const matchesSubj = subj === 'all' || 
      (item.subject && item.subject.toLowerCase() === subj.toLowerCase());
    const matchesDiff = diff === 'all' || 
      (item.difficulty && item.difficulty.toLowerCase() === diff.toLowerCase());

    return matchesSearch && matchesSubj && matchesDiff;
  });

  filtered.sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt || b.dateSolved) - new Date(a.createdAt || a.dateSolved);
    if (sort === 'oldest') return new Date(a.createdAt || a.dateSolved) - new Date(b.createdAt || b.dateSolved);
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'difficulty') {
      const order = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
      return (order[a.difficulty] || 2) - (order[b.difficulty] || 2);
    }
    return 0;
  });

  renderQuestions(filtered, allMilestones);
}

function getNextRevisionInfo(questionId, milestones) {
  const qMilestones = milestones.filter(m => m.questionId === questionId && m.status !== 'completed');
  if (qMilestones.length === 0) return { label: 'All milestones completed', status: 'completed' };
  
  qMilestones.sort((a, b) => new Date(a.dueDate || a.targetDate) - new Date(b.dueDate || b.targetDate));
  const next = qMilestones[0];
  const due = next.dueDate || next.targetDate;
  const day = next.milestoneDay || next.day;
  return {
    label: `Day ${day} (${formatDate(due)})`,
    status: next.status,
    milestoneId: next.id
  };
}

function renderQuestions(questions, milestones) {
  const gridContainer = document.getElementById('questionsGridContainer');
  const listContainer = document.getElementById('questionsListContainer');
  const countBadge = document.getElementById('questionsCountBadge');

  if (countBadge) countBadge.textContent = `${questions.length} questions`;

  if (questions.length === 0) {
    if (gridContainer) {
      gridContainer.style.display = 'block';
      renderEmptyState(gridContainer, {
        icon: 'code',
        title: 'No Questions Found',
        desc: 'Try adjusting your search filters or add a new question.',
        actionText: 'Add New Question',
        actionHref: 'add-question.html'
      });
    }
    if (listContainer) listContainer.style.display = 'none';
    return;
  }

  if (currentViewMode === 'grid') {
    if (listContainer) listContainer.style.display = 'none';
    if (gridContainer) {
      gridContainer.style.display = 'grid';
      gridContainer.innerHTML = questions.map(q => {
        const nextRev = getNextRevisionInfo(q.id, milestones);
        const isBookmarked = q.bookmarked || q.isBookmarked;
        return `
          <div class="question-card" data-id="${q.id}">
            <div>
              <div class="question-card-header">
                <div class="question-platform-id">
                  <span class="platform-pill platform-leetcode">${q.platform} ${q.problemNumber || ''}</span>
                  <span class="badge badge-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                </div>
                <button class="question-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-id="${q.id}" aria-label="Toggle bookmark">
                  <i data-lucide="bookmark" style="${isBookmarked ? 'fill: currentColor;' : ''}"></i>
                </button>
              </div>

              <h4 class="question-card-title">
                <a href="question-detail.html?id=${q.id}">${q.title}</a>
              </h4>

              <div class="question-topic-pill">
                ${q.subject} • ${q.topic || 'General'}
              </div>

              ${q.tags && q.tags.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
                  ${q.tags.slice(0, 3).map(t => `<span class="badge" style="background: var(--bg-surface-elevated); font-size: 11px;">#${t}</span>`).join('')}
                </div>
              ` : ''}
            </div>

            <div>
              <div class="question-card-meta">
                <span>Next: ${nextRev.label}</span>
                <span class="badge badge-${nextRev.status}">${nextRev.status.toUpperCase()}</span>
              </div>

              <div class="question-card-actions">
                <a href="question-detail.html?id=${q.id}" class="btn btn-secondary btn-sm" style="flex: 1;">
                  View Solution
                </a>
                <a href="revision-center.html?review=${nextRev.milestoneId || ''}" class="btn btn-primary btn-sm" title="Revise">
                  <i data-lucide="repeat"></i>
                </a>
                <button class="btn btn-ghost btn-sm delete-q-btn text-danger" data-id="${q.id}" data-title="${q.title}" title="Delete">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } else {
    // List Mode
    if (gridContainer) gridContainer.style.display = 'none';
    if (listContainer) {
      listContainer.style.display = 'block';
      listContainer.innerHTML = `
        <table class="questions-table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Subject & Topic</th>
              <th>Difficulty</th>
              <th>Solved On</th>
              <th>Next Revision</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${questions.map(q => {
              const nextRev = getNextRevisionInfo(q.id, milestones);
              const isBookmarked = q.bookmarked || q.isBookmarked;
              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <button class="question-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-id="${q.id}" style="padding: 0;">
                        <i data-lucide="bookmark" style="width: 16px; ${isBookmarked ? 'fill: currentColor;' : ''}"></i>
                      </button>
                      <div>
                        <a href="question-detail.html?id=${q.id}" style="font-weight: 600; color: var(--text-primary);">${q.title}</a>
                        <div style="font-size: 11px; color: var(--text-muted);">${q.platform} ${q.problemNumber || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>${q.subject} • ${q.topic || 'General'}</td>
                  <td><span class="badge badge-${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
                  <td>${formatDate(q.dateSolved || q.createdAt)}</td>
                  <td><span class="badge badge-${nextRev.status}">${nextRev.label}</span></td>
                  <td style="text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 4px;">
                      <a href="question-detail.html?id=${q.id}" class="btn btn-secondary btn-sm">View</a>
                      <button class="btn btn-ghost btn-sm delete-q-btn text-danger" data-id="${q.id}" data-title="${q.title}"><i data-lucide="trash-2"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }

  attachCardActionHandlers();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Handle bookmark toggling and deletion via backend API
 */
function attachCardActionHandlers() {
  // Bookmark toggle
  document.querySelectorAll('.question-bookmark-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      if (btn.dataset.loading === 'true') return;
      btn.dataset.loading = 'true';
      const id = btn.getAttribute('data-id');
      try {
        const res = await api.patch(`/questions/${id}/bookmark`);
        const isBookmarked = res.data.bookmarked;
        btn.classList.toggle('bookmarked', isBookmarked);
        const icon = btn.querySelector('svg, i');
        if (icon) {
          icon.style.fill = isBookmarked ? 'currentColor' : '';
        }
        showToast('Bookmark', isBookmarked ? 'Question bookmarked' : 'Bookmark removed', 'info');

        const qItem = allQuestions.find(q => q.id === id);
        if (qItem) {
          qItem.bookmarked = isBookmarked;
          qItem.isBookmarked = isBookmarked;
        }
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        delete btn.dataset.loading;
      }
    };
  });

  // Delete question
  document.querySelectorAll('.delete-q-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');

      showConfirmModal({
        title: 'Delete Question',
        message: `Are you sure you want to delete "${title}"? All scheduled revision milestones and notes will be permanently removed.`,
        confirmText: 'Delete Question',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/questions/${id}`);
            showToast('Deleted', `"${title}" and its revision milestones have been deleted.`, 'info');
            await fetchQuestionsAndMilestones();
          } catch (err) {
            showToast('Delete Failed', err.message, 'error');
          }
        }
      });
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('questionsGridContainer')) {
    initQuestions();
  }
});
