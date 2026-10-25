/**
 * ReviseCode Revision Calendar Controller (js/calendar.js)
 * Connects calendar view with backend revision milestone schedules.
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { formatDate } from './app.js';
import { openRecallModal } from './revision.js';

let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let allMilestones = [];

export async function initCalendar() {
  await loadCalendarData();

  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  const todayBtn = document.getElementById('calTodayBtn');

  if (prevBtn) {
    prevBtn.onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    };
  }

  if (todayBtn) {
    todayBtn.onclick = () => {
      currentDate = new Date();
      selectedDateStr = new Date().toISOString().split('T')[0];
      renderCalendar();
    };
  }
}

async function loadCalendarData() {
  try {
    const res = await api.get('/revisions');
    allMilestones = Array.isArray(res.data) ? res.data : (res.data?.items || []);
  } catch (err) {
    console.warn('Could not load revisions for calendar from API:', err.message);
    try {
      allMilestones = StorageManager.getMilestones() || [];
    } catch (_) {
      allMilestones = [];
    }
  }
  renderCalendar();
}

function renderCalendar() {
  const monthTitle = document.getElementById('calMonthTitle');
  const daysGrid = document.getElementById('calDaysGrid');
  if (!daysGrid) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (monthTitle) {
    monthTitle.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // First day of current month
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  let cellsHtml = '';

  // 1. Previous month filler days
  for (let x = firstDayIndex; x > 0; x--) {
    const d = prevMonthTotalDays - x + 1;
    cellsHtml += `<div class="calendar-day-cell other-month"><span class="day-number">${d}</span></div>`;
  }

  // 2. Current month days
  for (let d = 1; d <= totalDays; d++) {
    const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayMilestones = allMilestones.filter(m => (m.dueDate || m.targetDate) === currentDayStr);

    const isToday = currentDayStr === todayStr;
    const isSelected = currentDayStr === selectedDateStr;

    let dotsHtml = '';
    if (dayMilestones.length > 0) {
      dotsHtml = `<div class="day-events-dots">`;
      dayMilestones.slice(0, 3).forEach(m => {
        dotsHtml += `<div class="event-dot ${m.status}" title="${m.questionTitle} (${m.status})"></div>`;
      });
      if (dayMilestones.length > 3) {
        dotsHtml += `<span style="font-size: 9px; color: var(--text-muted);">+${dayMilestones.length - 3}</span>`;
      }
      dotsHtml += `</div>`;
    }

    cellsHtml += `
      <div class="calendar-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${currentDayStr}">
        <span class="day-number">${d}</span>
        ${dotsHtml}
      </div>
    `;
  }

  // 3. Next month filler days
  const totalCellsSoFar = firstDayIndex + totalDays;
  const nextDays = totalCellsSoFar > 35 ? (42 - totalCellsSoFar) : (35 - totalCellsSoFar);
  for (let j = 1; j <= nextDays; j++) {
    cellsHtml += `<div class="calendar-day-cell other-month"><span class="day-number">${j}</span></div>`;
  }

  daysGrid.innerHTML = cellsHtml;

  // Attach click listener to day cells
  daysGrid.querySelectorAll('.calendar-day-cell:not(.other-month)').forEach(cell => {
    cell.onclick = () => {
      daysGrid.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('is-selected'));
      cell.classList.add('is-selected');
      selectedDateStr = cell.getAttribute('data-date');
      renderAgenda(selectedDateStr, allMilestones);
    };
  });

  renderAgenda(selectedDateStr, allMilestones);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderAgenda(dateStr, milestones) {
  const agendaDateTitle = document.getElementById('agendaDateTitle');
  const agendaList = document.getElementById('agendaItemsList');
  if (!agendaList) return;

  if (agendaDateTitle) {
    agendaDateTitle.textContent = formatDate(dateStr);
  }

  const dayMilestones = milestones.filter(m => (m.dueDate || m.targetDate) === dateStr);

  if (dayMilestones.length === 0) {
    agendaList.innerHTML = `
      <div style="text-align: center; padding: 32px 12px; color: var(--text-muted); font-size: 13px;">
        <i data-lucide="calendar-check" style="width: 28px; height: 28px; margin: 0 auto 8px; opacity: 0.5;"></i>
        <p>No revision milestones scheduled for this date.</p>
      </div>
    `;
  } else {
    agendaList.innerHTML = dayMilestones.map(m => {
      const day = m.milestoneDay || m.day;
      return `
        <div class="agenda-item">
          <div class="agenda-item-header">
            <span class="platform-pill platform-leetcode">${m.platform || 'LeetCode'} ${m.problemNumber || ''}</span>
            <span class="badge badge-${m.status}">${m.status.toUpperCase()}</span>
          </div>
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); margin: 4px 0;">
            ${m.questionTitle}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
            <span>Milestone: Day ${day}</span>
            <span>${m.subject || 'DSA'}</span>
          </div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            ${m.status !== 'completed' ? `
              <button class="btn btn-primary btn-sm agenda-revise-btn" data-id="${m.id}" style="width: 100%;">
                <i data-lucide="play"></i> Revise
              </button>
            ` : `
              <a href="question-detail.html?id=${m.questionId}" class="btn btn-secondary btn-sm" style="width: 100%;">
                View Details
              </a>
            `}
          </div>
        </div>
      `;
    }).join('');

    agendaList.querySelectorAll('.agenda-revise-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const ms = milestones.find(item => item.id === id);
        if (ms) openRecallModal(ms);
      };
    });
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calDaysGrid')) {
    initCalendar();
  }
});
