/**
 * ReviseCode Analytics Controller (js/analytics.js)
 * Connects analytics view with backend aggregated metrics.
 */

import { api } from './api.js';

export async function initAnalytics() {
  await loadAnalytics();

  const timeFilter = document.getElementById('analyticsTimeRange');
  const subjectFilter = document.getElementById('analyticsSubjectFilter');

  if (subjectFilter) {
    try {
      const res = await api.get('/subjects');
      const subjects = res.data || [];
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        subjectFilter.appendChild(opt);
      });
    } catch (e) {}
  }

  if (timeFilter) timeFilter.onchange = loadAnalytics;
  if (subjectFilter) subjectFilter.onchange = loadAnalytics;
}

async function loadAnalytics() {
  try {
    const [statsRes, progressRes, activityRes, questionsRes] = await Promise.allSettled([
      api.get('/dashboard/stats'),
      api.get('/dashboard/progress'),
      api.get('/dashboard/activity', { limit: 50 }),
      api.get('/questions')
    ]);

    const stats = statsRes.status === 'fulfilled' ? (statsRes.value.data || {}) : {};
    const subjectProgress = progressRes.status === 'fulfilled' 
      ? (progressRes.value.data?.items || (Array.isArray(progressRes.value.data) ? progressRes.value.data : [])) 
      : [];
    const sessions = activityRes.status === 'fulfilled'
      ? (activityRes.value.data?.items || (Array.isArray(activityRes.value.data) ? activityRes.value.data : []))
      : [];
    const questions = questionsRes.status === 'fulfilled'
      ? (questionsRes.value.data?.items || (Array.isArray(questionsRes.value.data) ? questionsRes.value.data : []))
      : [];

    renderAnalytics(stats, subjectProgress, sessions, questions);
  } catch (err) {
    console.warn('Could not load analytics from backend:', err.message);
  }
}

function renderAnalytics(stats, subjectProgress, sessions, questions) {
  // Summary Metrics
  const totalQEl = document.getElementById('statTotalQuestions');
  const totalSessEl = document.getElementById('statTotalSessions');
  const onTimeEl = document.getElementById('statOnTimeRate');
  const overdueEl = document.getElementById('statOverdueCount');

  if (totalQEl) totalQEl.textContent = stats.totalQuestions ?? questions.length;
  if (totalSessEl) totalSessEl.textContent = sessions.length;
  if (onTimeEl) onTimeEl.textContent = `${stats.completionRate ?? 100}%`;
  if (overdueEl) overdueEl.textContent = stats.overdue ?? 0;

  // Recall Quality Breakdown: Easy, Difficult, Forgot
  const easyCount = sessions.filter(s => s.recallRating === 'easy').length;
  const diffCount = sessions.filter(s => s.recallRating === 'difficult').length;
  const forgotCount = sessions.filter(s => s.recallRating === 'forgot').length;
  const totalRecall = sessions.length || 1;

  const easyPct = Math.round((easyCount / totalRecall) * 100);
  const diffPct = Math.round((diffCount / totalRecall) * 100);
  const forgotPct = Math.max(0, 100 - easyPct - diffPct);

  const easyPctEl = document.getElementById('recallEasyPct');
  const diffPctEl = document.getElementById('recallDifficultPct');
  const forgotPctEl = document.getElementById('recallForgotPct');

  if (easyPctEl) easyPctEl.textContent = `${easyPct}% (${easyCount})`;
  if (diffPctEl) diffPctEl.textContent = `${diffPct}% (${diffCount})`;
  if (forgotPctEl) forgotPctEl.textContent = `${forgotPct}% (${forgotCount})`;

  const easyBar = document.getElementById('barRecallEasy');
  const diffBar = document.getElementById('barRecallDiff');
  const forgotBar = document.getElementById('barRecallForgot');

  if (easyBar) easyBar.style.width = `${easyPct}%`;
  if (diffBar) diffBar.style.width = `${diffPct}%`;
  if (forgotBar) forgotBar.style.width = `${forgotPct}%`;

  // Subject Progress Bars
  const subjContainer = document.getElementById('analyticsSubjectBars');
  if (subjContainer) {
    const totalCount = stats.totalQuestions || questions.length || 1;
    subjContainer.innerHTML = subjectProgress.map(s => {
      const pct = s.percentage ?? Math.round((s.questionCount / totalCount) * 100);
      return `
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span style="font-weight: 500;">${s.name}</span>
            <span style="color: var(--text-muted);">${s.questionCount} Questions (${pct}%)</span>
          </div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-fill" style="width: ${pct}%; background-color: ${s.color || '#7c3aed'};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Forgotten Questions List (Focus Areas)
  const forgottenContainer = document.getElementById('analyticsForgottenList');
  if (forgottenContainer) {
    const forgottenSessions = sessions.filter(s => s.recallRating === 'forgot');
    if (forgottenSessions.length === 0) {
      forgottenContainer.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted); font-size: 13px;">
          <i data-lucide="award" style="width: 28px; height: 28px; color: var(--success); margin: 0 auto 8px;"></i>
          <p>No questions currently marked as forgotten. Keep up the high retention!</p>
        </div>
      `;
    } else {
      forgottenContainer.innerHTML = forgottenSessions.map(s => `
        <div class="forgotten-item">
          <div class="forgotten-item-left">
            <span class="badge badge-hard">Forgot</span>
            <span style="font-weight: 600; font-size: 13px;">${s.questionTitle}</span>
          </div>
          <a href="question-detail.html?id=${s.questionId}" class="btn btn-primary btn-sm">Reinforce</a>
        </div>
      `).join('');
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('statTotalQuestions')) {
    initAnalytics();
  }
});
