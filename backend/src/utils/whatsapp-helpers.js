/**
 * WhatsApp Helper Utilities (src/utils/whatsapp-helpers.js)
 * Formats reminder messages, handles timezone calculations, and checks quiet hours.
 */

/**
 * Normalizes phone numbers to WhatsApp Cloud API format (digits only, e.g. 919876543210).
 */
export function sanitizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d]/g, '');
}

/**
 * Validates that a phone number meets WhatsApp Cloud API requirements:
 * strictly digits in international format including country code, length 10-15 digits.
 */
export function validateInternationalPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, reason: 'Recipient phone number is required.' };
  }
  const digits = sanitizePhoneNumber(phone);
  if (!digits) {
    return { valid: false, reason: 'Recipient phone number contains no digits.' };
  }
  if (digits.length < 10) {
    return { valid: false, reason: 'Recipient phone number is too short (minimum 10 digits with country code).' };
  }
  if (digits.length > 15) {
    return { valid: false, reason: 'Recipient phone number is too long (maximum 15 digits per ITU E.164).' };
  }
  return { valid: true, sanitized: digits };
}

/**
 * Returns current time formatted as HH:mm in the specified timezone.
 * Handles both IANA timezone strings ('Asia/Kolkata') and composite strings ('Asia/Kolkata (UTC+05:30)').
 */
export function getCurrentTimeInTimezone(timeZoneStr = 'Asia/Kolkata', date = new Date()) {
  const cleanTz = (timeZoneStr || '').split(' ')[0] || 'Asia/Kolkata';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: cleanTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Evaluates whether a given HH:mm time is within the configured quiet hours window.
 * Supports windows that cross midnight (e.g. 22:00 to 08:00) as well as same-day windows (e.g. 01:00 to 06:00).
 */
export function isWithinQuietHours(currentTime, quietStart = '22:00', quietEnd = '08:00') {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;

  const current = String(currentTime).trim();
  const start = String(quietStart).trim();
  const end = String(quietEnd).trim();

  // Full-day quiet hours edge cases (00:00 to 23:59 or 24:00)
  if (start === '00:00' && (end === '23:59' || end === '24:00')) {
    return true;
  }

  if (start < end) {
    // Normal same-day window (e.g. 01:00 to 06:00)
    return current >= start && current < end;
  } else {
    // Window spans across midnight (e.g. 22:00 to 08:00)
    return current >= start || current < end;
  }
}

/**
 * Builds the notification body text for WhatsApp spaced repetition reminders.
 */
export function formatWhatsAppReminderMessage({ milestone, question = {}, window = 'scheduled', clientOrigin = 'http://localhost:3000' } = {}) {
  const title = question.title || 'Revision Problem';
  const platform = question.platform || 'LeetCode';
  const problemNum = question.problemNumber ? ` #${question.problemNumber}` : '';
  const day = milestone?.milestoneDay || 3;
  const status = milestone?.status || 'due';
  const difficulty = question.difficulty || 'Medium';
  const topic = question.topic || 'General';

  const isOverdue = status === 'overdue';
  const isEvening = window === 'before_midnight';

  const header = isOverdue
    ? '⚠️ *ReviseCode Overdue Revision Reminder*'
    : (isEvening
        ? '🌙 *ReviseCode Evening Revision Reminder (Before Midnight)*'
        : '🧠 *ReviseCode Active Recall Reminder*');

  const statusLine = isOverdue
    ? `🔴 Overdue (Due date: ${milestone?.dueDate})`
    : (isEvening ? `⏰ Due Today (Pending completion before midnight)` : `🟡 Due Today (${milestone?.dueDate})`);

  const reviewUrl = `${clientOrigin}/revision-center.html?review=${milestone?.id || ''}`;

  return `${header}

Hi there! You have a spaced-repetition active recall review waiting:

📌 *Problem*: ${title} (${platform}${problemNum})
🎯 *Milestone*: Day ${day} Review
⚡ *Difficulty*: ${difficulty} | *Topic*: ${topic}
📅 *Status*: ${statusLine}

💡 *Active Recall Strategy*: Try to recall the algorithmic approach, time/space complexity, and edge cases before checking the solution.

🔗 *Review Now*: ${reviewUrl}`;
}
