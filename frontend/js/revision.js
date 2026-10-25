/**
 * ReviseCode Revision Center Controller (js/revision.js)
 * Connects spaced repetition revision workflows with backend APIs.
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { formatDate, getDaysDiff, renderEmptyState } from './app.js';
import { showToast } from './navigation.js';

let activeTab = 'due'; // 'due' | 'overdue' | 'upcoming' | 'completed' | 'all'
let allMilestones = [];
let activeReviewMilestone = null;
let activeReviewQuestion = null;
let selectedRecallRating = null;

export async function initRevisionCenter() {
  setupTabs();
  await loadRevisions();

  // Check if opened with ?review=milestoneId parameter
  const params = new URLSearchParams(window.location.search);
  const reviewId = params.get('review');
  if (reviewId) {
    const ms = allMilestones.find(m => m.id === reviewId);
    if (ms) {
      await openRecallModal(ms);
    }
  }
}

async function loadRevisions() {
  const container = document.getElementById('revisionMilestonesList');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
      <p>Loading revisions...</p>
    </div>
  `;

  try {
    const res = await api.get('/revisions');
    allMilestones = Array.isArray(res.data) ? res.data : (res.data?.items || []);
    updateRevisionCountBadges();
    renderMilestoneList();
  } catch (err) {
    console.error('Failed to load revisions from API:', err);
    try {
      const localMilestones = StorageManager.getMilestones();
      if (localMilestones && localMilestones.length > 0) {
        allMilestones = localMilestones;
        updateRevisionCountBadges();
        renderMilestoneList();
        showToast('Offline Mode', 'Showing locally cached revisions.', 'info');
        return;
      }
    } catch (_) {}

    container.innerHTML = `
      <div style="padding: 24px; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); text-align: center;">
        <h4 style="margin-bottom: 8px;">Failed to load revisions</h4>
        <p style="font-size: 13px; margin-bottom: 16px;">${err.message}</p>
        <button id="retryRevisionsBtn" class="btn btn-secondary btn-sm">
          <i data-lucide="refresh-cw"></i> Retry
        </button>
      </div>
    `;
    document.getElementById('retryRevisionsBtn')?.addEventListener('click', loadRevisions);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function updateRevisionCountBadges() {
  const due = allMilestones.filter(m => m.status === 'due').length;
  const overdue = allMilestones.filter(m => m.status === 'overdue').length;
  const upcoming = allMilestones.filter(m => m.status === 'upcoming').length;
  const completed = allMilestones.filter(m => m.status === 'completed').length;

  const badgeDue = document.getElementById('countTabDue');
  const badgeOverdue = document.getElementById('countTabOverdue');
  const badgeUpcoming = document.getElementById('countTabUpcoming');
  const badgeCompleted = document.getElementById('countTabCompleted');

  if (badgeDue) badgeDue.textContent = due;
  if (badgeOverdue) badgeOverdue.textContent = overdue;
  if (badgeUpcoming) badgeUpcoming.textContent = upcoming;
  if (badgeCompleted) badgeCompleted.textContent = completed;
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.revision-tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      renderMilestoneList();
    };
  });
}

function renderMilestoneList() {
  const container = document.getElementById('revisionMilestonesList');
  if (!container) return;

  let filtered = [];
  if (activeTab === 'due') {
    filtered = allMilestones.filter(m => m.status === 'due');
  } else if (activeTab === 'overdue') {
    filtered = allMilestones.filter(m => m.status === 'overdue');
  } else if (activeTab === 'upcoming') {
    filtered = allMilestones.filter(m => m.status === 'upcoming');
  } else if (activeTab === 'completed') {
    filtered = allMilestones.filter(m => m.status === 'completed');
  } else {
    filtered = allMilestones;
  }

  // Sort by target/due date ascending
  filtered.sort((a, b) => new Date(a.dueDate || a.targetDate) - new Date(b.dueDate || b.targetDate));

  if (filtered.length === 0) {
    let emptyMsg = 'No revisions in this category.';
    if (activeTab === 'due') emptyMsg = 'All caught up! No revisions due today.';
    if (activeTab === 'overdue') emptyMsg = 'Awesome! You have zero overdue revisions.';
    if (activeTab === 'completed') emptyMsg = 'No completed revisions yet. Complete a review to build your streak!';

    renderEmptyState(container, {
      icon: 'check-circle-2',
      title: emptyMsg,
      desc: 'Check other tabs or explore your saved questions list.',
      actionText: 'Explore Questions',
      actionHref: 'questions.html'
    });
    return;
  }

  container.innerHTML = filtered.map(m => {
    const due = m.dueDate || m.targetDate;
    const day = m.milestoneDay || m.day;
    const diff = getDaysDiff(due);

    let diffBadge = '';
    if (m.status === 'due') {
      diffBadge = `<span class="badge badge-due">Due Today</span>`;
    } else if (m.status === 'overdue') {
      diffBadge = `<span class="badge badge-overdue">${Math.abs(diff)} days overdue</span>`;
    } else if (m.status === 'completed') {
      diffBadge = `<span class="badge badge-completed">Completed on ${formatDate(m.completedAt)} (${(m.recallRating || 'OK').toUpperCase()})</span>`;
    } else {
      diffBadge = `<span class="badge badge-upcoming">In ${diff} days (${formatDate(due)})</span>`;
    }

    return `
      <div class="queue-item" style="padding: 14px 18px;">
        <div class="queue-item-left">
          <span class="platform-pill platform-leetcode">${m.platform || 'LeetCode'} ${m.problemNumber || ''}</span>
          <div class="queue-item-info">
            <a href="question-detail.html?id=${m.questionId}" class="queue-item-title">
              ${m.questionTitle}
              <span class="badge badge-${(m.difficulty || 'medium').toLowerCase()}">${m.difficulty || 'Medium'}</span>
            </a>
            <div class="queue-item-meta">
              <span><strong>Milestone: Day ${day}</strong></span>
              <span>•</span>
              <span>${m.subject || 'DSA'}</span>
              <span>•</span>
              ${diffBadge}
            </div>
          </div>
        </div>
        <div class="queue-item-actions">
          ${m.status !== 'completed' ? `
            <button class="btn btn-primary btn-sm start-recall-btn" data-id="${m.id}">
              <i data-lucide="play"></i> Start Revision
            </button>
            <button class="btn btn-ghost btn-sm reschedule-btn" data-id="${m.id}" data-date="${due}" title="Reschedule Date">
              <i data-lucide="calendar"></i>
            </button>
          ` : `
            <a href="question-detail.html?id=${m.questionId}" class="btn btn-secondary btn-sm">
              <i data-lucide="eye"></i> View Question
            </a>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Attach handlers
  container.querySelectorAll('.start-recall-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const ms = allMilestones.find(m => m.id === id);
      if (ms) await openRecallModal(ms);
    };
  });

  container.querySelectorAll('.reschedule-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const curDate = btn.getAttribute('data-date');
      openRescheduleModal(id, curDate);
    };
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Interactive Recall Modal Flow
export async function openRecallModal(milestone) {
  activeReviewMilestone = milestone;
  selectedRecallRating = null;

  // Try fetching question details from backend
  try {
    const qRes = await api.get(`/questions/${milestone.questionId}`);
    activeReviewQuestion = qRes.data;
  } catch (err) {
    const localQ = StorageManager.getQuestionById(milestone.questionId);
    activeReviewQuestion = localQ || {
      title: milestone.questionTitle,
      summary: 'Recall the algorithm and data structures used for this problem.',
      approach: 'Try recalling the solution from memory.',
      codeSolution: '// Code solution'
    };
  }

  let modal = document.getElementById('recallModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recallModal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const q = activeReviewQuestion || {};
  const day = milestone.milestoneDay || milestone.day;

  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 680px;">
      <div class="modal-header">
        <div>
          <span class="badge badge-due" style="margin-bottom: 4px;">Milestone Day ${day} Revision</span>
          <h3 class="modal-title">${milestone.questionTitle}</h3>
        </div>
        <button class="modal-close" id="recallModalClose"><i data-lucide="x"></i></button>
      </div>

      <div class="modal-body">
        <!-- Step 1: Memory Recall Attempt -->
        <div class="recall-prompt-box">
          <h5 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Problem Statement:</h5>
          <p style="color: var(--text-primary); font-size: 14px; line-height: 1.6;">${q.summary || q.description || 'Recall the algorithm, time complexity, and data structures used for this problem.'}</p>
        </div>

        <!-- Hidden Solution Container -->
        <div id="solutionHiddenBox" class="recall-solution-hidden">
          <i data-lucide="eye-off" style="width: 32px; height: 32px; color: var(--text-muted); margin: 0 auto 12px;"></i>
          <h4 style="margin-bottom: 6px; font-size: 15px;">Attempt before revealing</h4>
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">Try to explain the time/space complexity and write the approach in your mind.</p>
          <button class="btn btn-secondary" id="revealSolutionBtn">
            <i data-lucide="eye"></i> Reveal Saved Solution
          </button>
        </div>

        <!-- Revealed Solution Section -->
        <div id="solutionRevealedBox" class="recall-solution-revealed" style="display: none;">
          <div style="background-color: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h5 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Saved Approach:</h5>
            <p style="font-size: 14px; color: var(--text-primary);">${q.approach || 'No saved approach.'}</p>
            <div style="display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); margin-top: 10px; font-family: var(--font-family-mono);">
              <span>Time: <strong>${q.timeComplexity || 'O(n)'}</strong></span>
              <span>Space: <strong>${q.spaceComplexity || 'O(1)'}</strong></span>
            </div>
          </div>

          <div class="code-container">
            <div class="code-header">
              <span class="code-lang-label">${q.programmingLanguage || q.codeLanguage || 'Solution'}</span>
            </div>
            <pre class="code-pre"><code>${q.codeSolution || q.code || '// Solution'}</code></pre>
          </div>

          <!-- Step 2: Rate Recall -->
          <div style="margin-top: 20px;">
            <h5 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; text-align: center;">How was your recall?</h5>
            <div class="recall-rating-group">
              <div class="rating-btn rating-btn-easy" data-rating="easy">
                <i data-lucide="smile"></i>
                <span class="rating-label">Easy</span>
                <span class="rating-hint">Remembered clearly</span>
              </div>
              <div class="rating-btn rating-btn-difficult" data-rating="difficult">
                <i data-lucide="meh"></i>
                <span class="rating-label">Difficult</span>
                <span class="rating-hint">Took effort to recall</span>
              </div>
              <div class="rating-btn rating-btn-forgot" data-rating="forgot">
                <i data-lucide="frown"></i>
                <span class="rating-label">Forgot</span>
                <span class="rating-hint">Had to check solution</span>
              </div>
            </div>

            <!-- Notes -->
            <div class="form-group" style="margin-top: 12px; margin-bottom: 0;">
              <label class="form-label">Revision Session Notes (optional):</label>
              <input type="text" id="recallSessionNotes" class="form-control" placeholder="e.g. Reviewed edge cases and negative power...">
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="recallCancelBtn">Close</button>
        <button class="btn btn-success" id="markCompleteBtn" disabled>
          <i data-lucide="check-circle-2"></i> Mark Milestone Complete
        </button>
      </div>
    </div>
  `;

  modal.classList.add('is-open');

  const close = () => {
    modal.classList.remove('is-open');
  };

  modal.querySelector('#recallModalClose').onclick = close;
  modal.querySelector('#recallCancelBtn').onclick = close;

  const revealBtn = modal.querySelector('#revealSolutionBtn');
  const hiddenBox = modal.querySelector('#solutionHiddenBox');
  const revealedBox = modal.querySelector('#solutionRevealedBox');
  const completeBtn = modal.querySelector('#markCompleteBtn');

  revealBtn.onclick = () => {
    hiddenBox.style.display = 'none';
    revealedBox.style.display = 'block';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  // Rating selection
  modal.querySelectorAll('.rating-btn').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRecallRating = btn.getAttribute('data-rating');
      completeBtn.removeAttribute('disabled');
    };
  });

  // Mark Complete Action
  completeBtn.onclick = async () => {
    if (!selectedRecallRating) {
      showToast('Rating Required', 'Please select recall rating: Easy, Difficult, or Forgot', 'warning');
      return;
    }

    const notes = modal.querySelector('#recallSessionNotes')?.value || '';
    completeBtn.disabled = true;
    completeBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Completing...';

    try {
      await api.post(`/revisions/${milestone.id}/complete`, {
        recallRating: selectedRecallRating,
        notes
      });

      close();
      showToast('Revision Completed!', `Day ${day} milestone recorded successfully. Keep it up!`, 'success');
      await loadRevisions();
    } catch (err) {
      completeBtn.disabled = false;
      completeBtn.innerHTML = '<i data-lucide="check-circle-2"></i> Mark Milestone Complete';
      showToast('Error', err.message, 'error');
    }
  };

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Reschedule Dialog
function openRescheduleModal(milestoneId, currentDate) {
  let modal = document.getElementById('rescheduleModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rescheduleModal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 440px;">
      <div class="modal-header">
        <h3 class="modal-title">Reschedule Revision</h3>
        <button class="modal-close" id="rescheduleCloseBtn"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
          Select a new target date for this milestone. Other milestones will remain on their original scheduled dates.
        </p>
        <div class="form-group">
          <label class="form-label">New Target Date:</label>
          <input type="date" id="newTargetDateInput" class="form-control" value="${currentDate}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="rescheduleCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="confirmRescheduleBtn">Save New Date</button>
      </div>
    </div>
  `;

  modal.classList.add('is-open');

  const close = () => modal.classList.remove('is-open');
  modal.querySelector('#rescheduleCloseBtn').onclick = close;
  modal.querySelector('#rescheduleCancelBtn').onclick = close;

  const confirmBtn = modal.querySelector('#confirmRescheduleBtn');
  confirmBtn.onclick = async () => {
    const newDate = modal.querySelector('#newTargetDateInput').value;
    if (!newDate) {
      showToast('Date Required', 'Please select a valid date', 'error');
      return;
    }

    const originalBtnText = confirmBtn.innerHTML;
    try {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner-sm"></span> Rescheduling...';

      await api.post(`/revisions/${milestoneId}/reschedule`, { newDueDate: newDate });
      close();
      showToast('Rescheduled', `Milestone target date updated to ${formatDate(newDate)}.`, 'success');
      await loadRevisions();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalBtnText;
    }
  };

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('revisionMilestonesList')) {
    initRevisionCenter();
  }
});
