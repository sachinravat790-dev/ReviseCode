/**
 * Web Push Notification Service (src/services/push.service.js)
 * Implements native browser and phone lock-screen push notifications
 * using the VAPID Web Push protocol for spaced repetition revisions.
 */

import webpush from 'web-push';
import { config } from '../config/env.js';
import { supabaseRepository } from '../repositories/supabase.repository.js';
import { getTodayDateString } from '../utils/dates.js';

// Initialize VAPID details for Web Push
try {
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey
    );
  }
} catch (err) {
  console.warn('Could not initialize VAPID credentials:', err.message);
}

export const pushService = {
  getPublicKey() {
    return config.vapidPublicKey;
  },

  /**
   * Dispatches a native push notification to a specific subscriber.
   */
  async sendNotification(sub, payload) {
    if (!sub || !sub.endpoint) return { success: false, reason: 'invalid_subscription' };

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    const notificationPayload = JSON.stringify(payload || {
      title: '🧠 ReviseCode Active Recall',
      body: 'You have a spaced repetition milestone due today!',
      url: '/revision-center.html'
    });

    try {
      await webpush.sendNotification(pushSubscription, notificationPayload);
      return { success: true };
    } catch (err) {
      // 410 Gone or 404 Not Found indicates the client unsubscribed or expired
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseRepository.deletePushSubscription(sub.endpoint);
        return { success: false, expired: true };
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Sends an immediate test notification to verify delivery on the user's phone.
   */
  async sendTestNotification(sub) {
    return await this.sendNotification(sub, {
      title: '🎉 Push Notifications Active!',
      body: 'ReviseCode is connected. Spaced repetition alerts will arrive directly on your phone lock screen on Day 3, 7, 12, 20, and 30.',
      url: '/revision-center.html'
    });
  },

  /**
   * Sweeps pending/due revisions and dispatches push notifications to subscribed users.
   */
  async processMilestonePushReminders(targetDate = null) {
    const dateStr = targetDate || getTodayDateString();

    const [dueRevisions, overdueRevisions] = await Promise.all([
      supabaseRepository.getAllRevisions({ status: 'due' }),
      supabaseRepository.getAllRevisions({ status: 'overdue' })
    ]);

    const candidateMap = new Map();
    [...dueRevisions, ...overdueRevisions].forEach(rev => {
      if (rev && rev.id && !rev.completedAt) {
        candidateMap.set(rev.id, rev);
      }
    });

    const candidates = Array.from(candidateMap.values());
    let sentCount = 0;

    for (const rev of candidates) {
      let question = null;
      try {
        question = await supabaseRepository.getQuestionById(rev.questionId);
      } catch {}

      const targetUserId = rev.userId || question?.userId || null;
      const subs = await supabaseRepository.getPushSubscriptions(targetUserId);

      if (!subs || subs.length === 0) continue;

      const title = `🎯 ReviseCode Day ${rev.milestoneDay} Revision`;
      const body = `Time to revise: ${question?.title || 'Problem'} (${question?.difficulty || 'Medium'} • ${question?.platform || 'LeetCode'}). Tap to review now!`;
      const url = `/revision-center.html?review=${rev.id}`;

      for (const sub of subs) {
        const res = await this.sendNotification(sub, { title, body, url });
        if (res.success) sentCount += 1;
      }
    }

    return {
      date: dateStr,
      candidates: candidates.length,
      sentCount
    };
  }
};
