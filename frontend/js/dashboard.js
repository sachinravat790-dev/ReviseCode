/**
 * ReviseCode Dashboard Controller (js/dashboard.js)
 * Connects dashboard metrics, queues, and activity feeds with backend APIs.
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { AuthService } from './auth.js';
import { formatDate, formatRelativeTime, renderEmptyState } from './app.js';
import { showToast } from './navigation.js';

const DASHBOARD_CACHE_KEY = 'revisecode_cached_dashboard_snapshot';

function applyDashboardMetrics(stats, questionsCount = null) {
  const totalQuestionsEl = document.getElementById('metricTotalQuestions');
  const dueTodayEl = document.getElementById('metricDueToday');
  const overdueEl = document.getElementById('metricOverdue');
  const completionRateEl = document.getElementById('metricCompletionRate');
  const streakCountEl = document.getElementById('dashboardStreakCount');

  const totalQuestions = stats.totalQuestions ?? questionsCount ?? (totalQuestionsEl && totalQuestionsEl.textContent !== '--' ? parseInt(totalQuestionsEl.textContent, 10) : 0);

  if (totalQuestionsEl && totalQuestions !== undefined && totalQuestions !== null) totalQuestionsEl.textContent = totalQuestions;
  if (dueTodayEl && stats.dueToday !== undefined) dueTodayEl.textContent = stats.dueToday;
  if (overdueEl && stats.overdue !== undefined) overdueEl.textContent = stats.overdue;
  if (completionRateEl && stats.completionRate !== undefined) completionRateEl.textContent = `${stats.completionRate}%`;
  if (streakCountEl && stats.streak !== undefined) streakCountEl.textContent = `${stats.streak} Days`;

  return totalQuestions;
}

export async function renderDashboard() {
  const profile = StorageManager.getProfile();
  const currentUser = AuthService.getCurrentUser() || profile;

  // 1. Welcome Header & Name
  const welcomeEl = document.getElementById('dashboardWelcomeName');
  if (welcomeEl) {
    const firstName = currentUser?.name ? currentUser.name.trim().split(' ')[0] : 'Learner';
    welcomeEl.textContent = firstName;
  }

  // 2. Instant Stale-While-Revalidate (0ms Render) from local cache
  try {
    const rawCached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (rawCached) {
      const cached = JSON.parse(rawCached);
      if (cached && cached.stats) {
        const cachedTotal = applyDashboardMetrics(cached.stats, cached.totalQuestions);
        if (cached.dueMilestones) renderQueue(cached.dueMilestones);
        if (cached.subjectProgress) renderSubjectProgress(cached.subjectProgress, cachedTotal || 1);
        if (cached.recentQuestions) renderRecentQuestions(cached.recentQuestions);
        if (cached.recentActivity) {
          renderRecentActivity(cached.recentActivity);
          renderWeeklyChart(cached.recentActivity);
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    }
  } catch (_) {}

  // 3. Load Stats, Queue, Progress, Questions, and Activity in parallel from backend
  try {
    const [statsResult, todayResult, progressResult, questionsResult, activityResult] = await Promise.allSettled([
      api.get('/dashboard/stats'),
      api.get('/revisions/today'),
      api.get('/dashboard/progress'),
      api.get('/questions', { limit: 4 }),
      api.get('/dashboard/activity', { limit: 4 })
    ]);

    const stats = (statsResult.status === 'fulfilled' && statsResult.value?.data) ? statsResult.value.data : {
      totalQuestions: 0,
      dueToday: 0,
      overdue: 0,
      completed: 0,
      completionRate: 100
    };

    const todayData = todayResult.status === 'fulfilled' ? todayResult.value?.data : null;
    const dueMilestones = Array.isArray(todayData) ? todayData : (todayData?.items || []);

    const progressData = progressResult.status === 'fulfilled' ? progressResult.value?.data : null;
    const subjectProgress = progressData?.items || (Array.isArray(progressData) ? progressData : []);

    const questionsData = questionsResult.status === 'fulfilled' ? questionsResult.value?.data : null;
    const recentQuestions = questionsData?.items || (Array.isArray(questionsData) ? questionsData : []);

    const activityData = activityResult.status === 'fulfilled' ? activityResult.value?.data : null;
    const recentActivity = activityData?.items || (Array.isArray(activityData) ? activityData : []);

    // Check if critical calls failed and notify user
    const failedList = [
      { name: 'Stats', result: statsResult },
      { name: 'Revisions', result: todayResult },
      { name: 'Progress', result: progressResult },
      { name: 'Questions', result: questionsResult },
      { name: 'Activity', result: activityResult }
    ].filter(item => item.result.status === 'rejected');

    if (failedList.length === 5) {
      showToast('Offline Mode', 'Cannot connect to backend API server. Showing cached interface.', 'warning');
    } else if (failedList.length > 0) {
      console.warn('Dashboard partial widget warning:', failedList.map(f => `${f.name}: ${f.result.reason?.message}`).join('; '));
    }

    const totalQuestions = applyDashboardMetrics(stats, questionsData?.pagination?.total || recentQuestions.length || 0);

    // Render Revision Queue
    renderQueue(dueMilestones);

    // Render Subject Progress
    renderSubjectProgress(subjectProgress, totalQuestions || 1);

    // Render Recently Added Questions
    renderRecentQuestions(recentQuestions);

    // Render Recent Revision Activity
    renderRecentActivity(recentActivity);

    // Render Weekly Activity Bar Chart
    renderWeeklyChart(recentActivity);

    // Save fresh snapshot to cache for subsequent instant loads
    try {
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
        stats: {
          totalQuestions,
          dueToday: stats.dueToday ?? 0,
          overdue: stats.overdue ?? 0,
          completionRate: stats.completionRate ?? 100,
          streak: stats.streak ?? 0
        },
        totalQuestions,
        dueMilestones,
        subjectProgress,
        recentQuestions,
        recentActivity,
        updatedAt: Date.now()
      }));
    } catch (_) {}

  } catch (err) {
    console.error('Failed to load dashboard data from backend:', err);
    showToast('Dashboard Notice', err.message, 'warning');
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderQueue(dueMilestones) {
  const queueContainer = document.getElementById('dashboardQueueList');
  if (!queueContainer) return;

  if (dueMilestones.length === 0) {
    renderEmptyState(queueContainer, {
      icon: 'check-circle',
      title: 'Queue is Clear for Today!',
      desc: 'You have no revisions due today. Great job keeping your memory sharp.',
      actionText: 'Explore Questions',
      actionHref: 'questions.html'
    });
    return;
  }

  queueContainer.innerHTML = dueMilestones.map(m => {
    const day = m.milestoneDay || m.day;
    const diffBadge = `<span class="badge badge-due">Due Today</span>`;
    return `
      <div class="queue-item">
        <div class="queue-item-left">
          <span class="platform-pill platform-leetcode">${m.platform || 'LeetCode'} ${m.problemNumber || ''}</span>
          <div class="queue-item-info">
            <a href="question-detail.html?id=${m.questionId}" class="queue-item-title">
              ${m.questionTitle}
              <span class="badge badge-${(m.difficulty || 'medium').toLowerCase()}">${m.difficulty || 'Medium'}</span>
            </a>
            <div class="queue-item-meta">
              <span>Milestone: Day ${day}</span>
              <span>•</span>
              <span>${m.subject || 'DSA'}</span>
              <span>•</span>
              ${diffBadge}
            </div>
          </div>
        </div>
        <div class="queue-item-actions">
          <a href="revision-center.html?review=${m.id}" class="btn btn-primary btn-sm">
            <i data-lucide="play"></i> Revise Now
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderSubjectProgress(subjectProgress, totalQuestions) {
  const container = document.getElementById('dashboardSubjectProgress');
  if (!container) return;

  if (subjectProgress.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No subjects tracked yet.</p>`;
    return;
  }

  container.innerHTML = subjectProgress.slice(0, 5).map(s => {
    const pct = s.percentage ?? (totalQuestions > 0 ? Math.round((s.questionCount / totalQuestions) * 100) : 0);
    return `
      <div class="subject-progress-item">
        <div class="subject-progress-header">
          <span class="subject-progress-name">${s.name}</span>
          <span class="subject-progress-count">${s.questionCount} questions (${pct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background-color: ${s.color || '#7c3aed'};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentQuestions(questions) {
  const container = document.getElementById('dashboardRecentQuestions');
  if (!container) return;

  if (questions.length === 0) {
    renderEmptyState(container, {
      icon: 'book-open',
      title: 'No Questions Saved Yet',
      desc: 'Start by saving your first coding solution.',
      actionText: 'Add Question',
      actionHref: 'add-question.html'
    });
    return;
  }

  container.innerHTML = questions.map(q => `
    <div class="queue-item" style="padding: 10px 14px;">
      <div class="queue-item-left">
        <span class="platform-pill platform-leetcode">${q.platform} ${q.problemNumber || ''}</span>
        <div class="queue-item-info">
          <a href="question-detail.html?id=${q.id}" class="queue-item-title" style="font-size: 13px;">${q.title}</a>
          <div class="queue-item-meta">
            <span>${q.subject} • ${q.topic || 'General'}</span>
            <span>•</span>
            <span>Added ${formatRelativeTime(q.createdAt || q.dateSolved)}</span>
          </div>
        </div>
      </div>
      <a href="question-detail.html?id=${q.id}" class="btn btn-ghost btn-sm" aria-label="View details">
        <i data-lucide="chevron-right"></i>
      </a>
    </div>
  `).join('');
}

function renderRecentActivity(sessions) {
  const container = document.getElementById('dashboardRecentActivity');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">No completed revisions recorded yet.</p>`;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const rating = s.recallRating || 'easy';
    const ratingBadge = rating === 'easy' ? 'badge-easy' : (rating === 'difficult' ? 'badge-medium' : 'badge-hard');
    return `
      <div class="queue-item" style="padding: 10px 14px;">
        <div class="queue-item-left">
          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 12px; background: rgba(16, 185, 129, 0.2); color: var(--success); border: none;">
            <i data-lucide="check" style="width: 16px; height: 16px;"></i>
          </div>
          <div class="queue-item-info">
            <div class="queue-item-title" style="font-size: 13px;">${s.questionTitle}</div>
            <div class="queue-item-meta">
              <span>Day ${s.milestoneDay} Milestone</span>
              <span>•</span>
              <span class="badge ${ratingBadge}">${rating.toUpperCase()}</span>
              <span>•</span>
              <span>${formatRelativeTime(s.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderWeeklyChart(sessions) {
  const chart = document.querySelector('.activity-bar-chart');
  if (!chart) return;

  const columns = chart.querySelectorAll('.bar-column');
  if (!Array.isArray(sessions) || sessions.length === 0) {
    columns.forEach(col => {
      const fill = col.querySelector('.bar-fill');
      if (fill) {
        fill.style.height = '0%';
        fill.setAttribute('title', '0 revisions completed');
      }
    });
    return;
  }

  // Day indices 0 (Sun) to 6 (Sat)
  const dayCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
  sessions.forEach(s => {
    if (s.timestamp) {
      const d = new Date(s.timestamp).getDay();
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    }
  });

  // Map Mon-Sun columns
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const maxCount = Math.max(...Object.values(dayCounts), 3);

  columns.forEach((col, idx) => {
    const dayKey = dayOrder[idx];
    const count = dayCounts[dayKey] || 0;
    const fill = col.querySelector('.bar-fill');
    if (fill) {
      const pct = count > 0 ? Math.max(25, Math.round((count / maxCount) * 100)) : 10;
      fill.style.height = `${pct}%`;
      fill.setAttribute('title', `${count} revisions completed`);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboardWelcomeName')) {
    renderDashboard();
  }
});
