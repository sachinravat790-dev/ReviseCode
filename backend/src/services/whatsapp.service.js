/**
 * WhatsApp Business Platform Service (src/services/whatsapp.service.js)
 * Implements official WhatsApp Cloud API integration, message formatting,
 * duplicate prevention, quiet hours compliance, test mode simulation,
 * and delivery logging for spaced-repetition milestones.
 */

import { config, isWhatsAppConfigured, maskSensitive } from '../config/env.js';
import { supabaseRepository } from '../repositories/supabase.repository.js';
import { getTodayDateString } from '../utils/dates.js';
import {
  sanitizePhoneNumber,
  validateInternationalPhoneNumber,
  getCurrentTimeInTimezone,
  isWithinQuietHours,
  formatWhatsAppReminderMessage
} from '../utils/whatsapp-helpers.js';

export const whatsappService = {
  /**
   * Diagnostic and configuration status.
   * Masks all sensitive tokens and phone numbers to prevent secret leakage.
   * Strictly adheres to the rule: never claims connected until a real API send succeeds.
   */
  async getStatus() {
    let settings = null;
    let inQuietHours = false;
    let currentTime = '00:00';
    let hasSentLiveMessage = false;

    try {
      settings = await supabaseRepository.getSettings();
      if (settings) {
        currentTime = getCurrentTimeInTimezone(settings.timeZone || 'Asia/Kolkata');
        inQuietHours = isWithinQuietHours(currentTime, settings.quietHoursStart, settings.quietHoursEnd);
      }
      const logs = await supabaseRepository.getWhatsAppLogs(10);
      hasSentLiveMessage = Array.isArray(logs) && logs.some(l => l.status === 'sent');
    } catch {
      // Graceful fallback if query fails
    }

    const callmebotConfigured = Boolean(settings?.whatsappApiKey || config.callmebotApiKey);
    const configured = isWhatsAppConfigured() || callmebotConfigured;
    const liveDeliveryActive = (!config.whatsappTestMode || callmebotConfigured) && configured;

    return {
      configured,
      testMode: config.whatsappTestMode,
      callmebotConfigured,
      connected: Boolean(liveDeliveryActive && hasSentLiveMessage),
      deliveryMode: config.whatsappTestMode && !callmebotConfigured
        ? 'test_mode'
        : (configured ? (hasSentLiveMessage ? 'live_verified' : 'live_pending_verification') : 'unconfigured'),
      apiVersion: config.whatsappApiVersion,
      phoneNumberIdMasked: maskSensitive(config.whatsappPhoneNumberId),
      recipientPhoneMasked: maskSensitive(config.whatsappRecipientPhoneNumber || settings?.whatsappPhone || settings?.phoneNumber || ''),
      businessAccountIdMasked: maskSensitive(config.whatsappBusinessAccountId),
      templateName: config.whatsappTemplateName || null,
      templateLang: config.whatsappTemplateLang || 'en_US',
      userSettings: settings
        ? {
            whatsappNotifications: Boolean(settings.whatsappNotifications ?? settings.whatsAppNotifications),
            whatsappPhone: settings.whatsappPhone || settings.phoneNumber || '',
            whatsappApiKeyMasked: settings.whatsappApiKey ? maskSensitive(settings.whatsappApiKey) : '',
            reminderTime: settings.reminderTime || '09:00',
            quietHoursStart: settings.quietHoursStart || '22:00',
            quietHoursEnd: settings.quietHoursEnd || '08:00',
            timeZone: settings.timeZone || 'Asia/Kolkata',
            currentlyInQuietHours: inQuietHours,
            currentTimeInTimezone: currentTime
          }
        : null
    };
  },

  /**
   * Dispatches a raw message via the WhatsApp Business Cloud API
   * or simulates the send when test mode is active.
   */
  async sendRawMessage({
    to,
    type = 'text',
    textBody = '',
    templateName = '',
    templateLang = 'en_US',
    apiKey = null,
    forceLive = false
  }) {
    const rawTo = to || config.whatsappRecipientPhoneNumber;
    const phoneValidation = validateInternationalPhoneNumber(rawTo);
    if (!phoneValidation.valid) {
      return {
        success: false,
        status: 'failed',
        errorMessage: phoneValidation.reason
      };
    }
    const cleanTo = phoneValidation.sanitized;

    // Check if CallMeBot API key is available
    let callMeBotKey = apiKey || config.callmebotApiKey || null;
    if (!callMeBotKey) {
      try {
        const settings = await supabaseRepository.getSettings();
        callMeBotKey = settings?.whatsappApiKey || null;
      } catch {
        // Ignore settings query error
      }
    }

    // CallMeBot direct delivery
    if (callMeBotKey && (!config.whatsappTestMode || forceLive)) {
      try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanTo)}&text=${encodeURIComponent(textBody)}&apikey=${encodeURIComponent(callMeBotKey)}`;
        const response = await fetch(url);
        const respText = await response.text().catch(() => '');
        if (response.ok || respText.toLowerCase().includes('message queued') || respText.toLowerCase().includes('message sent') || respText.toLowerCase().includes('success')) {
          const messageId = `cmb_${Date.now()}`;
          return {
            success: true,
            simulated: false,
            status: 'sent',
            provider: 'callmebot',
            whatsappMessageId: messageId,
            response: { text: respText }
          };
        } else {
          return {
            success: false,
            status: 'failed',
            errorMessage: respText || `CallMeBot HTTP ${response.status}`,
            response: { text: respText }
          };
        }
      } catch (err) {
        return {
          success: false,
          status: 'failed',
          errorMessage: err.message || 'Error communicating with CallMeBot'
        };
      }
    }

    // 1. Test Mode: simulate delivery safely without external HTTP requests
    if (config.whatsappTestMode && !forceLive) {
      const simulatedId = `sim_wamid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        simulated: true,
        testMode: true,
        status: 'simulated_test_mode',
        whatsappMessageId: simulatedId,
        response: {
          messaging_product: 'whatsapp',
          contacts: [{ input: cleanTo, wa_id: cleanTo }],
          messages: [{ id: simulatedId }]
        }
      };
    }

    // 2. Production Mode: requires valid credentials
    if (!config.whatsappApiToken || !config.whatsappPhoneNumberId) {
      return {
        success: false,
        status: 'failed',
        errorMessage: 'WhatsApp Cloud API credentials (WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID) are missing.'
      };
    }

    const endpoint = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;

    let payload;
    if (type === 'template' && templateName) {
      payload = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: templateLang || 'en_US'
          }
        }
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
          preview_url: true,
          body: textBody
        }
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.whatsappApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          status: 'failed',
          errorMessage: errorMsg,
          response: responseData
        };
      }

      const messageId = responseData?.messages?.[0]?.id || `wamid_${Date.now()}`;
      return {
        success: true,
        simulated: false,
        status: 'sent',
        whatsappMessageId: messageId,
        response: responseData
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        errorMessage: err.message || 'Network error dispatching WhatsApp Cloud API request.'
      };
    }
  },

  /**
   * Sends an ad-hoc test message to verify recipient configuration and test mode.
   * Only attempts dispatch when required recipient and credentials are provided.
   */
  async sendTestNotification({ recipientPhone, customText, apiKey } = {}) {
    let settings = null;
    try {
      settings = await supabaseRepository.getSettings();
    } catch {
      // Ignore settings lookup error
    }

    const targetRecipient = recipientPhone || settings?.whatsappPhone || settings?.phoneNumber || config.whatsappRecipientPhoneNumber;
    const effectiveApiKey = apiKey || settings?.whatsappApiKey || config.callmebotApiKey || null;

    if (!targetRecipient) {
      return {
        success: false,
        status: 'unconfigured',
        errorMessage: 'WhatsApp recipient phone number is not configured. Please set WHATSAPP_RECIPIENT_PHONE_NUMBER in backend/.env or configure your phone number in Notifications preferences.'
      };
    }

    const phoneValidation = validateInternationalPhoneNumber(targetRecipient);
    if (!phoneValidation.valid) {
      return {
        success: false,
        status: 'invalid_recipient',
        errorMessage: phoneValidation.reason
      };
    }

    // If live sending is requested, verify credentials exist
    if (!config.whatsappTestMode && !effectiveApiKey && (!config.whatsappApiToken || !config.whatsappPhoneNumberId)) {
      return {
        success: false,
        status: 'unconfigured',
        errorMessage: 'WhatsApp credentials (WHATSAPP_API_TOKEN or CALLMEBOT_API_KEY) are missing. Please configure them in backend/.env or in Notifications settings.'
      };
    }

    const cleanTo = phoneValidation.sanitized;
    const isCallMeBot = Boolean(effectiveApiKey);
    const body = customText || `👋 *ReviseCode WhatsApp Notification Test*
\nThis is a verified test message from your ReviseCode revision tracker.
\nSpaced-repetition milestone reminders are active for Days 3, 7, 12, 20, and 30.
\n⚙️ Provider: ${isCallMeBot ? 'CallMeBot Direct WhatsApp' : (config.whatsappTestMode ? 'Test Mode (Simulated)' : 'Live Meta Cloud API')}`;

    const sendResult = await this.sendRawMessage({
      to: cleanTo,
      type: 'text',
      textBody: body,
      apiKey: effectiveApiKey,
      forceLive: isCallMeBot // Live dispatch if user gave CallMeBot key
    });

    // Record delivery log
    const log = await supabaseRepository.recordWhatsAppLog({
      recipientPhone: cleanTo,
      reminderWindow: 'test',
      reminderDate: getTodayDateString(),
      messageType: 'text',
      messageBody: body,
      status: sendResult.status,
      whatsappMessageId: sendResult.whatsappMessageId || null,
      errorMessage: sendResult.errorMessage || null,
      metadata: {
        testMode: config.whatsappTestMode,
        simulated: sendResult.simulated || false,
        apiResponse: sendResult.response || null
      }
    });

    return {
      ...sendResult,
      logId: log?.id
    };
  },

  /**
   * Core notification engine: processes pending and overdue spaced-repetition milestones.
   * Supports reminder preferences, quiet hours compliance, before-midnight evening checks,
   * duplicate prevention, and simultaneous in-app notifications.
   *
   * @param {Object} options
   * @param {string} options.window - 'scheduled' (morning/day) or 'before_midnight' (evening)
   * @param {string} options.targetDate - Date string YYYY-MM-DD (defaults to today)
   * @param {boolean} options.force - If true, bypasses quiet hours and preferences (e.g. for testing)
   * @param {boolean} options.dryRun - If true, calculates reminders without dispatching
   * @param {string} options.recipientPhone - Explicit recipient override
   */
  async processMilestoneReminders({
    window = 'scheduled',
    targetDate = null,
    force = false,
    dryRun = false,
    recipientPhone = null
  } = {}) {
    const dateStr = targetDate || getTodayDateString();
    const settings = await supabaseRepository.getSettings();

    // 1. Check user notification preferences
    const waEnabled = Boolean(settings?.whatsappNotifications ?? settings?.whatsAppNotifications ?? settings?.whatsapp_notifications);
    if (!force && settings && !waEnabled) {
      return {
        window,
        targetDate: dateStr,
        processed: 0,
        sent: 0,
        skipped: 0,
        reason: 'whatsapp_notifications_disabled',
        message: 'WhatsApp notifications are toggled off in user settings.',
        details: []
      };
    }

    // 2. Check quiet hours
    const userTimezone = settings?.timeZone || 'Asia/Kolkata';
    const currentTime = getCurrentTimeInTimezone(userTimezone);
    const quietStart = settings?.quietHoursStart || '22:00';
    const quietEnd = settings?.quietHoursEnd || '08:00';
    const inQuietHours = isWithinQuietHours(currentTime, quietStart, quietEnd);

    if (!force && inQuietHours) {
      return {
        window,
        targetDate: dateStr,
        processed: 0,
        sent: 0,
        skipped: 0,
        reason: 'quiet_hours_active',
        currentTime,
        quietHours: `${quietStart} - ${quietEnd}`,
        message: `Current time (${currentTime}) falls within quiet hours (${quietStart} to ${quietEnd}). Reminders suppressed.`,
        details: []
      };
    }

    // 3. Verify recipient phone number
    const targetRecipient = recipientPhone || settings?.whatsappPhone || settings?.phoneNumber || config.whatsappRecipientPhoneNumber;
    if (!targetRecipient) {
      return {
        window,
        targetDate: dateStr,
        processed: 0,
        sent: 0,
        skipped: 0,
        reason: 'missing_recipient_phone_number',
        message: 'WhatsApp recipient phone number is not configured. Set WHATSAPP_RECIPIENT_PHONE_NUMBER in backend/.env or configure your phone number in Notifications preferences.',
        details: []
      };
    }

    const phoneValidation = validateInternationalPhoneNumber(targetRecipient);
    if (!phoneValidation.valid) {
      return {
        window,
        targetDate: dateStr,
        processed: 0,
        sent: 0,
        skipped: 0,
        reason: 'invalid_recipient_phone_number',
        message: phoneValidation.reason,
        details: []
      };
    }
    const recipient = phoneValidation.sanitized;

    // 4. Retrieve candidate revisions (due today or overdue)
    const [dueRevisions, overdueRevisions] = await Promise.all([
      supabaseRepository.getAllRevisions({ status: 'due' }),
      supabaseRepository.getAllRevisions({ status: 'overdue' })
    ]);

    // De-duplicate any overlap
    const candidateMap = new Map();
    [...dueRevisions, ...overdueRevisions].forEach(rev => {
      if (rev && rev.id) {
        candidateMap.set(rev.id, rev);
      }
    });

    const candidates = Array.from(candidateMap.values());
    const results = [];
    let sentCount = 0;
    let skippedCount = 0;

    for (const rev of candidates) {
      // Skip completed revisions
      if (rev.completedAt) {
        skippedCount += 1;
        results.push({
          revisionId: rev.id,
          status: 'skipped_already_completed',
          reason: 'Revision has already been completed.'
        });
        continue;
      }

      // Check duplicate reminder prevention for this revision, window, and date
      const alreadySent = await supabaseRepository.hasSentWhatsAppReminder({
        revisionId: rev.id,
        reminderWindow: window,
        reminderDate: dateStr
      });

      if (!force && alreadySent) {
        skippedCount += 1;
        results.push({
          revisionId: rev.id,
          status: 'skipped_duplicate',
          reason: `Reminder already dispatched for revision ${rev.id} in window "${window}" on ${dateStr}.`
        });
        continue;
      }

      // Fetch question details for formatting
      let question = null;
      try {
        question = await supabaseRepository.getQuestionById(rev.questionId);
      } catch {
        // Continue with minimal details
      }

      const messageBody = formatWhatsAppReminderMessage({
        milestone: rev,
        question: question || {},
        window,
        clientOrigin: config.clientOrigin
      });

      if (dryRun) {
        results.push({
          revisionId: rev.id,
          questionId: rev.questionId,
          status: 'dry_run',
          messagePreview: messageBody
        });
        continue;
      }

      // Dispatch message
      const sendResult = await this.sendRawMessage({
        to: recipient,
        type: config.whatsappTemplateName ? 'template' : 'text',
        textBody: messageBody,
        templateName: config.whatsappTemplateName,
        templateLang: config.whatsappTemplateLang,
        apiKey: settings?.whatsappApiKey || config.callmebotApiKey || null
      });

      // Record delivery log
      await supabaseRepository.recordWhatsAppLog({
        revisionId: rev.id,
        questionId: rev.questionId,
        recipientPhone: recipient,
        reminderWindow: window,
        reminderDate: dateStr,
        messageType: config.whatsappTemplateName ? 'template' : 'text',
        messageBody,
        status: sendResult.status,
        whatsappMessageId: sendResult.whatsappMessageId || null,
        errorMessage: sendResult.errorMessage || null,
        metadata: {
          milestoneDay: rev.milestoneDay,
          questionTitle: question?.title || '',
          window,
          testMode: config.whatsappTestMode,
          simulated: sendResult.simulated || false
        }
      });

      // Keep existing in-app notifications working synchronously
      try {
        const isOverdue = rev.status === 'overdue';
        const notifTitle = isOverdue
          ? `Overdue Revision: ${question?.title || 'Problem'}`
          : (window === 'before_midnight'
              ? `Evening Reminder: ${question?.title || 'Problem'}`
              : `Revision Due: ${question?.title || 'Problem'}`);

        const notifMsg = `Milestone Day ${rev.milestoneDay} for ${question?.title || 'problem'} is pending recall.`;

        await supabaseRepository.createNotification({
          type: isOverdue ? 'overdue' : 'revision_due',
          category: 'Revisions',
          title: notifTitle,
          message: notifMsg,
          questionId: rev.questionId
        });
      } catch {
        // Notification creation error does not fail WhatsApp send
      }

      if (sendResult.success) {
        sentCount += 1;
        results.push({
          revisionId: rev.id,
          questionId: rev.questionId,
          status: sendResult.status,
          messageId: sendResult.whatsappMessageId
        });
      } else {
        results.push({
          revisionId: rev.id,
          questionId: rev.questionId,
          status: 'failed',
          error: sendResult.errorMessage
        });
      }
    }

    return {
      window,
      targetDate: dateStr,
      processed: candidates.length,
      sent: sentCount,
      skipped: skippedCount,
      details: results
    };
  },

  /**
   * Retrieves recent WhatsApp delivery logs.
   */
  async getDeliveryLogs(limit = 50) {
    return await supabaseRepository.getWhatsAppLogs(limit);
  }
};
