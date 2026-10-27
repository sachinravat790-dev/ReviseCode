/**
 * WhatsApp Spaced-Repetition Notifications Test Suite (tests/whatsapp.test.js)
 * Verifies Cloud API test-mode simulation, quiet hours compliance,
 * reminder preference enforcement, duplicate suppression, delivery logging,
 * before-midnight checks, and in-app notification synchronization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { setupTestDatabase, getTestDatabase, request } from './test-helper.js';
import {
  sanitizePhoneNumber,
  validateInternationalPhoneNumber,
  getCurrentTimeInTimezone,
  isWithinQuietHours,
  formatWhatsAppReminderMessage
} from '../src/utils/whatsapp-helpers.js';
import { config, maskSensitive } from '../src/config/env.js';
import { whatsappService } from '../src/services/whatsapp.service.js';
import { whatsappScheduler } from '../src/services/whatsapp-scheduler.service.js';
import { supabaseRepository } from '../src/repositories/supabase.repository.js';
import { getTodayDateString, addDays } from '../src/utils/dates.js';

// Dedicated test recipient strictly for automated test isolation
const TEST_RECIPIENT = '919876543210';

test('WhatsApp Helper: sanitizePhoneNumber cleans formatting characters', () => {
  assert.equal(sanitizePhoneNumber('+91 98765-43210'), '919876543210');
  assert.equal(sanitizePhoneNumber('(123) 456-7890'), '1234567890');
  assert.equal(sanitizePhoneNumber('919876543210'), '919876543210');
  assert.equal(sanitizePhoneNumber(''), '');
  assert.equal(sanitizePhoneNumber(null), '');
});

test('WhatsApp Helper: validateInternationalPhoneNumber validates format and length', () => {
  assert.equal(validateInternationalPhoneNumber('+91 98765-43210').valid, true);
  assert.equal(validateInternationalPhoneNumber('+91 98765-43210').sanitized, '919876543210');

  // Too short (< 10 digits)
  assert.equal(validateInternationalPhoneNumber('12345').valid, false);
  assert.match(validateInternationalPhoneNumber('12345').reason, /too short/);

  // Missing / empty
  assert.equal(validateInternationalPhoneNumber('').valid, false);
  assert.equal(validateInternationalPhoneNumber(null).valid, false);
});

test('WhatsApp Helper: isWithinQuietHours correctly handles cross-midnight and same-day windows', () => {
  // Window: 22:00 to 08:00 (spans across midnight)
  assert.equal(isWithinQuietHours('22:00', '22:00', '08:00'), true);
  assert.equal(isWithinQuietHours('23:45', '22:00', '08:00'), true);
  assert.equal(isWithinQuietHours('03:30', '22:00', '08:00'), true);
  assert.equal(isWithinQuietHours('07:59', '22:00', '08:00'), true);
  assert.equal(isWithinQuietHours('08:00', '22:00', '08:00'), false);
  assert.equal(isWithinQuietHours('14:30', '22:00', '08:00'), false);
  assert.equal(isWithinQuietHours('21:59', '22:00', '08:00'), false);

  // Window: 01:00 to 06:00 (same-day window)
  assert.equal(isWithinQuietHours('03:00', '01:00', '06:00'), true);
  assert.equal(isWithinQuietHours('00:30', '01:00', '06:00'), false);
  assert.equal(isWithinQuietHours('06:00', '01:00', '06:00'), false);
  assert.equal(isWithinQuietHours('12:00', '01:00', '06:00'), false);

  // Missing or equal bounds
  assert.equal(isWithinQuietHours('12:00', null, '08:00'), false);
  assert.equal(isWithinQuietHours('12:00', '08:00', '08:00'), false);
});

test('WhatsApp Helper: getCurrentTimeInTimezone safely formats HH:mm', () => {
  const fixedDate = new Date('2026-10-24T05:30:00Z'); // 11:00 in Asia/Kolkata
  const kolkataTime = getCurrentTimeInTimezone('Asia/Kolkata (UTC+05:30)', fixedDate);
  assert.equal(kolkataTime, '11:00');

  const utcTime = getCurrentTimeInTimezone('UTC', fixedDate);
  assert.equal(utcTime, '05:30');
});

test('WhatsApp Helper: formatWhatsAppReminderMessage contains required spaced-repetition context for all intervals', () => {
  const intervals = [3, 7, 12, 20, 30];
  intervals.forEach(day => {
    const msg = formatWhatsAppReminderMessage({
      milestone: { id: `m_${day}`, milestoneDay: day, status: 'due', dueDate: '2026-10-24' },
      question: { title: 'Two Sum', platform: 'LeetCode', problemNumber: 1, difficulty: 'Easy', topic: 'Arrays' },
      window: 'scheduled',
      clientOrigin: 'http://localhost:3000'
    });

    assert.match(msg, /ReviseCode Active Recall Reminder/);
    assert.match(msg, new RegExp(`Day ${day} Review`));
    assert.match(msg, /Two Sum \(LeetCode #1\)/);
  });
});

test('Security: maskSensitive masks secret tokens and phone numbers', () => {
  assert.equal(maskSensitive('EAAGsomethingSecretToken12345'), 'EAAG****345');
  assert.equal(maskSensitive('919876543210'), '9198****210');
  assert.equal(maskSensitive('short'), '****');
  assert.equal(maskSensitive(''), '');
  assert.equal(maskSensitive(null), '');
});

test('GET /api/whatsapp/status returns masked config and user settings without claiming unverified live connection', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'GET',
    url: '/api/whatsapp/status'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const data = res.body.data;

  assert.equal(typeof data.configured, 'boolean');
  assert.equal(data.testMode, true); // Safe test mode active by default
  assert.equal(data.connected, false); // Never claims connected without verified live send
  assert.ok(data.userSettings);
  assert.equal(typeof data.userSettings.whatsappNotifications, 'boolean');

  // Verify secrets are never exposed in raw form
  assert.equal(data.whatsappApiToken, undefined);
  assert.ok(!JSON.stringify(res.body).includes('EAAG'));
});

test('POST /api/whatsapp/test rejects requests when recipient number is completely missing', async () => {
  setupTestDatabase();
  const origRecipient = config.whatsappRecipientPhoneNumber;
  config.whatsappRecipientPhoneNumber = '';

  try {
    const res = await request(app, {
      method: 'POST',
      url: '/api/whatsapp/test',
      body: {}
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /recipient phone number is not configured/i);
  } finally {
    config.whatsappRecipientPhoneNumber = origRecipient;
  }
});

test('POST /api/whatsapp/test rejects invalid recipient phone numbers', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'POST',
    url: '/api/whatsapp/test',
    body: {
      recipientPhone: '12345' // Too short
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /too short/i);
});

test('POST /api/whatsapp/test executes safe test simulation in test mode and logs delivery', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'POST',
    url: '/api/whatsapp/test',
    body: {
      recipientPhone: '+919876543210',
      customText: 'Test WhatsApp notification verification'
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.simulated, true);
  assert.equal(res.body.data.status, 'simulated_test_mode');
  assert.ok(res.body.data.whatsappMessageId.startsWith('sim_wamid_'));

  // Verify delivery was recorded in logs
  const logsRes = await request(app, {
    method: 'GET',
    url: '/api/whatsapp/logs'
  });

  assert.equal(logsRes.status, 200);
  assert.ok(logsRes.body.data.items.length >= 1);
  const latestLog = logsRes.body.data.items[0];
  assert.equal(latestLog.reminder_window, 'test');
  assert.equal(latestLog.status, 'simulated_test_mode');
  assert.equal(latestLog.recipient_phone, '919876543210');
});

test('Milestone Reminders: Skips dispatch when user_settings.whatsapp_notifications is false', async () => {
  setupTestDatabase();

  // Settings in mock DB has whatsapp_notifications: false by default
  const result = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    force: false,
    recipientPhone: TEST_RECIPIENT
  });

  assert.equal(result.sent, 0);
  assert.equal(result.reason, 'whatsapp_notifications_disabled');
});

test('Milestone Reminders: Skips dispatch when current time is in quiet hours', async () => {
  setupTestDatabase();

  // Enable notifications, but set quiet hours to cover 00:00 - 23:59 (entire day)
  await supabaseRepository.updateSettings({
    whatsappNotifications: true,
    quietHoursStart: '00:00',
    quietHoursEnd: '23:59'
  });

  const result = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    force: false,
    recipientPhone: TEST_RECIPIENT
  });

  assert.equal(result.sent, 0);
  assert.equal(result.reason, 'quiet_hours_active');
});

test('Milestone Reminders: Dispatches reminders when preferences allow and quiet hours are clear', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true,
    quietHoursStart: '02:00',
    quietHoursEnd: '03:00'
  });

  const targetDate = getTodayDateString();

  const result = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    targetDate,
    force: true, // Force bypasses quiet hours check for deterministic test
    recipientPhone: TEST_RECIPIENT
  });

  assert.ok(result.processed >= 1);
  assert.ok(result.sent >= 1);
  assert.equal(result.window, 'scheduled');

  // Verify in-app notifications were created synchronously
  const notifs = await supabaseRepository.getAllNotifications();
  assert.ok(notifs.some(n => n.category === 'Revisions'));

  // Verify logs contain the sent milestone
  const logs = await supabaseRepository.getWhatsAppLogs(10);
  assert.ok(logs.some(l => l.reminder_window === 'scheduled' && l.status === 'simulated_test_mode'));
});

test('Duplicate Prevention: Blocks duplicate reminders for same revision, window, and date', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true,
    quietHoursStart: '03:00',
    quietHoursEnd: '04:00'
  });

  const targetDate = getTodayDateString();

  // First run: dispatches
  const run1 = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    targetDate,
    force: true,
    recipientPhone: TEST_RECIPIENT
  });
  assert.ok(run1.sent >= 1);

  // Second run without force: must skip duplicate revisions
  const run2 = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    targetDate,
    force: false,
    recipientPhone: TEST_RECIPIENT
  });

  assert.equal(run2.sent, 0);
  assert.ok(run2.skipped >= 1);
  const dupSkipped = run2.details.find(d => d.status === 'skipped_duplicate');
  assert.ok(dupSkipped, 'Should detect and skip duplicate reminder');
});

test('Evening Before-Midnight Reminders: Dispatches under before_midnight window for pending items', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true
  });

  const targetDate = getTodayDateString();

  const eveningRun = await whatsappService.processMilestoneReminders({
    window: 'before_midnight',
    targetDate,
    force: true,
    recipientPhone: TEST_RECIPIENT
  });

  assert.ok(eveningRun.processed >= 1);
  assert.ok(eveningRun.sent >= 1);
  assert.equal(eveningRun.window, 'before_midnight');

  const logs = await supabaseRepository.getWhatsAppLogs(10);
  assert.ok(logs.some(l => l.reminder_window === 'before_midnight'));
});

test('Completed Revisions: Automatically skipped from reminder dispatches', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true
  });

  const db = getTestDatabase();
  // Mark all revisions in test db as completed
  db.revisions.forEach(r => {
    r.completed_at = '2026-10-24T12:00:00Z';
  });

  const result = await whatsappService.processMilestoneReminders({
    window: 'scheduled',
    force: true,
    recipientPhone: TEST_RECIPIENT
  });

  assert.equal(result.sent, 0);
  assert.ok(result.details.every(d => d.status === 'skipped_already_completed'));
});

test('POST /api/whatsapp/dispatch endpoint triggers reminders with parameters', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true
  });

  const res = await request(app, {
    method: 'POST',
    url: '/api/whatsapp/dispatch',
    body: {
      window: 'scheduled',
      force: true,
      recipientPhone: TEST_RECIPIENT
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.window, 'scheduled');
  assert.ok(res.body.data.processed >= 1);
});

test('WhatsAppScheduler: Calculates evening reminder time and manages timer lifecycle', () => {
  assert.equal(whatsappScheduler.getEveningReminderTime('22:00'), '21:00');
  assert.equal(whatsappScheduler.getEveningReminderTime('23:30'), '22:30');
  assert.equal(whatsappScheduler.getEveningReminderTime('00:00'), '23:00');

  whatsappScheduler.start();
  const state = whatsappScheduler.getState();
  assert.equal(state.running, true);

  whatsappScheduler.stop();
  const stoppedState = whatsappScheduler.getState();
  assert.equal(stoppedState.running, false);
});

test('User Settings: Saves and retrieves whatsappPhone properly', async () => {
  setupTestDatabase();

  await supabaseRepository.updateSettings({
    whatsappNotifications: true,
    whatsappPhone: '+91 98765-43210'
  });

  const settings = await supabaseRepository.getSettings();
  assert.equal(settings.whatsappNotifications, true);
  assert.equal(settings.whatsappPhone, '+91 98765-43210');
});

test('Milestone Reminders: Uses recipient phone saved in user_settings if not explicitly provided', async () => {
  setupTestDatabase();
  const origEnvPhone = config.whatsappRecipientPhoneNumber;
  config.whatsappRecipientPhoneNumber = ''; // Emulate empty env

  try {
    await supabaseRepository.updateSettings({
      whatsappNotifications: true,
      whatsappPhone: '+919876543210'
    });

    const result = await whatsappService.processMilestoneReminders({
      window: 'scheduled',
      force: true
    });

    assert.ok(result.processed >= 1);
    assert.ok(result.sent >= 1);
    assert.notEqual(result.reason, 'missing_recipient_phone_number');
  } finally {
    config.whatsappRecipientPhoneNumber = origEnvPhone;
  }
});
