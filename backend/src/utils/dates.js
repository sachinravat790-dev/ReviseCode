/**
 * Date manipulation and spaced repetition milestone utilities.
 * Uses consistent YYYY-MM-DD date-only strings to prevent timezone drift.
 */

export const MANDATORY_MILESTONES = [3, 7, 12, 20, 30];

/**
 * Returns today's date formatted as YYYY-MM-DD in the specified timezone (default: Asia/Kolkata)
 */
export function getTodayDateString(timeZone = 'Asia/Kolkata') {
  try {
    const cleanTz = (timeZone || '').split(' ')[0] || 'Asia/Kolkata';
    return new Intl.DateTimeFormat('en-CA', { timeZone: cleanTz }).format(new Date());
  } catch (e) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Formats a date string or Date object as YYYY-MM-DD
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return typeof dateStr === 'string' ? dateStr.split('T')[0] : new Date(dateStr).toISOString().split('T')[0];
}

/**
 * Parses a YYYY-MM-DD string into a Date object at UTC midnight to avoid local timezone shifts
 */
export function parseDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Adds an integer number of calendar days to a YYYY-MM-DD string
 */
export function addDays(baseDateStr, days) {
  const d = parseDateOnly(baseDateStr);
  d.setUTCDate(d.getUTCDate() + days);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference (target - today)
 * negative = in past (overdue if incomplete)
 * 0 = today (due)
 * positive = in future (upcoming)
 */
export function getDaysDiff(targetDateStr) {
  const today = parseDateOnly(getTodayDateString());
  const target = parseDateOnly(targetDateStr);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes dynamic status for a milestone based on due date and completion state
 */
export function computeRevisionStatus(dueDateStr, completedAt) {
  if (completedAt) {
    return 'completed';
  }
  const diff = getDaysDiff(dueDateStr);
  if (diff < 0) {
    return 'overdue';
  }
  if (diff === 0) {
    return 'due';
  }
  return 'upcoming';
}

/**
 * Generates initial milestones array for a question
 */
export function generateMandatoryMilestones(baseDateStr, intervals = MANDATORY_MILESTONES) {
  const base = baseDateStr || getTodayDateString();
  return intervals.map(dayOffset => {
    const dueDate = addDays(base, dayOffset);
    return {
      milestoneDay: dayOffset,
      dueDate,
      status: computeRevisionStatus(dueDate, null),
      completedAt: null,
      recallRating: null,
      notes: ''
    };
  });
}
