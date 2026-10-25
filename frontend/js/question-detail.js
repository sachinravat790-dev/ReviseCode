/**
 * ReviseCode Question Detail Controller (js/question-detail.js)
 * Connects frontend question detail view with backend API.
 */

import { api } from './api.js';
import { formatDate, formatRelativeTime, copyToClipboard } from './app.js';
import { showToast, showConfirmModal } from './navigation.js';

let currentQuestion = null;

export async function initQuestionDetail() {
  const params = new URLSearchParams(window.location.search);
  const qId = params.get('id');

  if (!qId) {
    window.location.href = 'questions.html';
    return;
  }

  await loadQuestionData(qId);
}

/**
 * Fetch question details and associated sessions from backend
 */
async function loadQuestionData(id) {
  try {
    const res = await api.get(`/questions/${id}`);
    currentQuestion = res.data;

    if (!currentQuestion) {
      showToast('Not Found', 'Question not found or has been deleted.', 'error');
      setTimeout(() => { window.location.href = 'questions.html'; }, 1200);
      return;
    }

    // Try fetching sessions activity from dashboard activity
    let sessions = [];
    try {
      const activityRes = await api.get('/dashboard/activity', { limit: 100 });
      const allSessions = activityRes.data?.items || (Array.isArray(activityRes.data) ? activityRes.data : []);
      sessions = allSessions.filter(s => s.questionId === id);
    } catch (e) {
      // Activity fetch optional
    }

    renderQuestionDetail(currentQuestion, sessions);
  } catch (err) {
    console.error('Failed to load question details:', err);
    showToast('Error', `Could not load question: ${err.message}`, 'error');
    const titleEl = document.getElementById('detailTitle');
    if (titleEl) {
      titleEl.textContent = 'Question not found';
    }
  }
}

function renderQuestionDetail(q, sessions = []) {
  const milestones = q.milestones || [];

  // Metadata
  const titleEl = document.getElementById('detailTitle');
  const platformEl = document.getElementById('detailPlatform');
  const diffBadgeEl = document.getElementById('detailDifficultyBadge');
  const subjectEl = document.getElementById('detailSubject');
  const topicEl = document.getElementById('detailTopic');
  const externalLinkEl = document.getElementById('detailExternalLink');
  const tagsContainer = document.getElementById('detailTagsContainer');

  if (titleEl) titleEl.textContent = q.title;
  if (platformEl) platformEl.textContent = `${q.platform} ${q.problemNumber || ''}`;
  if (diffBadgeEl) {
    diffBadgeEl.textContent = q.difficulty;
    diffBadgeEl.className = `badge badge-${q.difficulty.toLowerCase()}`;
  }
  if (subjectEl) subjectEl.textContent = q.subject;
  if (topicEl) topicEl.textContent = q.topic || 'General';

  const extUrl = q.problemUrl || q.url;
  if (externalLinkEl) {
    if (extUrl) {
      externalLinkEl.href = extUrl;
      externalLinkEl.style.display = 'inline-flex';
    } else {
      externalLinkEl.style.display = 'none';
    }
  }

  if (tagsContainer && q.tags) {
    tagsContainer.innerHTML = q.tags.map(t => `<span class="badge" style="background: var(--bg-surface-elevated);">#${t}</span>`).join(' ');
  }

  // Complexity
  const timeEl = document.getElementById('detailTimeComplexity');
  const spaceEl = document.getElementById('detailSpaceComplexity');
  if (timeEl) timeEl.textContent = q.timeComplexity || 'O(n)';
  if (spaceEl) spaceEl.textContent = q.spaceComplexity || 'O(1)';

  // Summary, Approach & Notes
  const summaryEl = document.getElementById('detailSummary');
  const approachEl = document.getElementById('detailApproach');
  const notesEl = document.getElementById('detailNotes');

  if (summaryEl) summaryEl.textContent = q.summary || q.description || 'No summary provided.';
  if (approachEl) approachEl.textContent = q.approach || 'No detailed approach documented.';
  if (notesEl) notesEl.textContent = q.notes || 'No personal notes added yet.';

  // Code Solution
  const codePre = document.getElementById('detailCodePre');
  const codeLang = document.getElementById('detailCodeLang');
  const codeContent = q.codeSolution || q.code;
  if (codePre) {
    codePre.textContent = codeContent || '// No code solution provided';
  }
  if (codeLang) {
    codeLang.textContent = q.programmingLanguage || q.codeLanguage || 'code';
  }

  // Copy Code Button
  const copyBtn = document.getElementById('copyCodeBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      copyToClipboard(codeContent || '', 'Solution code copied to clipboard!');
    };
  }

  // Attachments
  const attachmentsContainer = document.getElementById('detailAttachmentsGrid');
  if (attachmentsContainer) {
    if (!q.attachments || q.attachments.length === 0) {
      attachmentsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No handwritten notes or screenshots uploaded.</p>`;
    } else {
      attachmentsContainer.innerHTML = q.attachments.map(att => `
        <div class="attachment-thumbnail" data-src="${att.url}">
          <img src="${att.url}" alt="${att.name || 'Attachment'}">
          <div class="attachment-info-bar">
            <span class="text-truncate">${att.name || 'Image'}</span>
            <span>${att.size || ''}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // Milestones Timeline
  const timelineContainer = document.getElementById('detailMilestonesTimeline');
  if (timelineContainer) {
    if (milestones.length === 0) {
      timelineContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No milestones scheduled.</p>`;
    } else {
      timelineContainer.innerHTML = milestones.map(m => {
        const day = m.milestoneDay || m.day;
        const due = m.dueDate || m.targetDate;
        return `
          <div class="timeline-item ${m.status}">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div>
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">
                  Milestone: Day ${day}
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                  Target: ${formatDate(due)}
                  ${m.completedAt ? ` • Completed on ${formatDate(m.completedAt)} (${m.recallRating ? m.recallRating.toUpperCase() : 'OK'})` : ''}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-${m.status}">${m.status.toUpperCase()}</span>
                ${m.status !== 'completed' ? `
                  <a href="revision-center.html?review=${m.id}" class="btn btn-primary btn-sm">
                    Revise
                  </a>
                ` : `
                  <span style="color: var(--success); font-size: 12px; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="check" style="width: 14px;"></i> Done
                  </span>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Revision Sessions History
  const sessionsContainer = document.getElementById('detailSessionsHistory');
  if (sessionsContainer) {
    if (sessions.length === 0) {
      sessionsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No previous revision sessions recorded.</p>`;
    } else {
      sessionsContainer.innerHTML = sessions.map(s => `
        <div class="queue-item" style="padding: 10px 14px; margin-bottom: 8px;">
          <div class="queue-item-left">
            <div class="queue-item-info">
              <div class="queue-item-title" style="font-size: 13px;">
                Day ${s.milestoneDay} Milestone Review
                <span class="badge ${s.recallRating === 'easy' ? 'badge-easy' : (s.recallRating === 'difficult' ? 'badge-medium' : 'badge-hard')}">${(s.recallRating || 'OK').toUpperCase()}</span>
              </div>
              <div class="queue-item-meta">
                <span>${formatRelativeTime(s.timestamp)}</span>
                ${s.notes ? `<span>• "${s.notes}"</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // Bookmark Button Action
  const bookmarkBtn = document.getElementById('detailBookmarkBtn');
  const isBookmarked = q.bookmarked || q.isBookmarked;
  if (bookmarkBtn) {
    bookmarkBtn.classList.toggle('bookmarked', isBookmarked);
    bookmarkBtn.onclick = async () => {
      try {
        const res = await api.patch(`/questions/${q.id}/bookmark`);
        const status = res.data.bookmarked;
        bookmarkBtn.classList.toggle('bookmarked', status);
        showToast('Bookmark', status ? 'Question bookmarked' : 'Bookmark removed', 'info');
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    };
  }

  // Delete Button Action
  const deleteBtn = document.getElementById('detailDeleteBtn');
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      showConfirmModal({
        title: 'Delete Question',
        message: `Are you sure you want to delete "${q.title}"? This will permanently remove its scheduled revision milestones.`,
        confirmText: 'Delete',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete(`/questions/${q.id}`);
            showToast('Deleted', `"${q.title}" deleted.`, 'info');
            setTimeout(() => { window.location.href = 'questions.html'; }, 800);
          } catch (err) {
            showToast('Delete Failed', err.message, 'error');
          }
        }
      });
    };
  }

  // Edit Button Action
  const editBtn = document.getElementById('detailEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      window.location.href = `add-question.html?edit=${q.id}`;
    };
  }

  // Quick Start Revision Button
  const startRevBtn = document.getElementById('detailStartRevisionBtn');
  if (startRevBtn) {
    const pending = milestones.find(m => m.status === 'due' || m.status === 'overdue') || milestones.find(m => m.status !== 'completed');
    if (pending) {
      startRevBtn.href = `revision-center.html?review=${pending.id}`;
    } else {
      startRevBtn.href = `revision-center.html`;
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('detailTitle')) {
    initQuestionDetail();
  }
});
