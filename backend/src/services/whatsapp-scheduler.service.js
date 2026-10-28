/**
 * WhatsApp Background Scheduler (src/services/whatsapp-scheduler.service.js)
 * Automatically checks reminder schedules (scheduled morning/day window
 * and evening before-midnight pending revisions check) while respecting
 * quiet hours and preventing duplicate notifications.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';
import { whatsappService } from './whatsapp.service.js';
import { pushService } from './push.service.js';
import { getCurrentTimeInTimezone, isWithinQuietHours } from '../utils/whatsapp-helpers.js';
import { getTodayDateString } from '../utils/dates.js';

export class WhatsAppScheduler {
  constructor() {
    this.timer = null;
    this.intervalMs = 60 * 1000; // Check every 60 seconds
    this.isRunning = false;
    this.lastRuns = new Map(); // tracks last run minute to avoid duplicate execution: "date:window:time"
  }

  /**
   * Calculates the optimal evening before-midnight reminder time.
   * Schedules it 1 hour before quiet hours begin (e.g. 21:00 if quiet hours start at 22:00).
   */
  getEveningReminderTime(quietStart = '22:00') {
    const parts = (quietStart || '22:00').split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      let hour = parts[0] - 1;
      if (hour < 0) hour = 23;
      return `${String(hour).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
    }
    return '21:00';
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // Unref timer so it doesn't block node process exit in tests
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  getState() {
    return {
      running: this.isRunning,
      intervalMs: this.intervalMs,
      lastRunsCount: this.lastRuns.size
    };
  }

  async tick() {
    try {
      const settings = await supabaseRepository.getSettings();
      if (!settings || !settings.whatsappNotifications) {
        return;
      }

      const tz = settings.timeZone || 'Asia/Kolkata';
      const currentTime = getCurrentTimeInTimezone(tz);
      const todayDate = getTodayDateString();

      const scheduledTime = settings.reminderTime || '09:00';
      const quietStart = settings.quietHoursStart || '22:00';
      const eveningTime = this.getEveningReminderTime(quietStart);

      // 1. Scheduled milestone reminder check
      if (currentTime === scheduledTime) {
        const runKey = `${todayDate}:scheduled:${currentTime}`;
        if (!this.lastRuns.has(runKey)) {
          this.lastRuns.set(runKey, new Date().toISOString());
          await Promise.allSettled([
            whatsappService.processMilestoneReminders({
              window: 'scheduled',
              targetDate: todayDate
            }),
            pushService.processMilestonePushReminders(todayDate)
          ]);
        }
      }

      // 2. Evening before-midnight check for still-pending revisions
      if (currentTime === eveningTime) {
        const runKey = `${todayDate}:before_midnight:${currentTime}`;
        if (!this.lastRuns.has(runKey)) {
          this.lastRuns.set(runKey, new Date().toISOString());
          await Promise.allSettled([
            whatsappService.processMilestoneReminders({
              window: 'before_midnight',
              targetDate: todayDate
            }),
            pushService.processMilestonePushReminders(todayDate)
          ]);
        }
      }

      // Cleanup old run keys older than 2 days
      if (this.lastRuns.size > 50) {
        this.lastRuns.clear();
      }
    } catch {
      // Background scheduler errors are caught and swallowed to keep server stable
    }
  }

  /**
   * Allows manual triggering of a notification window for testing or on-demand dispatch.
   */
  async triggerNow({ window = 'scheduled', force = false } = {}) {
    return await whatsappService.processMilestoneReminders({
      window,
      force
    });
  }
}

export const whatsappScheduler = new WhatsAppScheduler();
