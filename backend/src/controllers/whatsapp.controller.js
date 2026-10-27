/**
 * WhatsApp Controller (src/controllers/whatsapp.controller.js)
 * Handles WhatsApp diagnostic status, test dispatches, reminder runs,
 * and delivery log auditing.
 */

import { whatsappService } from '../services/whatsapp.service.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const whatsappController = {
  /**
   * GET /api/whatsapp/status
   * Safe status check with masked phone numbers and tokens.
   */
  async getStatus(req, res, next) {
    try {
      const status = await whatsappService.getStatus();
      return successResponse(res, {
        statusCode: 200,
        message: 'WhatsApp configuration status retrieved successfully',
        data: status
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/whatsapp/test
   * Sends or simulates a test WhatsApp notification.
   */
  async sendTestMessage(req, res, next) {
    try {
      const { recipientPhone, customText, apiKey } = req.body || {};
      const result = await whatsappService.sendTestNotification({
        recipientPhone,
        customText,
        apiKey
      });

      if (!result.success) {
        return errorResponse(res, {
          statusCode: 400,
          message: result.errorMessage || 'Failed to send WhatsApp notification',
          errors: [result.errorMessage || 'Failed to send WhatsApp notification']
        });
      }

      return successResponse(res, {
        statusCode: 200,
        message: result.simulated
          ? 'Test WhatsApp notification simulated successfully (Test Mode)'
          : 'Test WhatsApp notification sent successfully via Meta Cloud API',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/whatsapp/dispatch
   * Triggers spaced-repetition reminder processing.
   */
  async dispatchReminders(req, res, next) {
    try {
      const { window = 'scheduled', force = false, dryRun = false, targetDate, recipientPhone } = req.body || {};

      const result = await whatsappService.processMilestoneReminders({
        window,
        force: Boolean(force),
        dryRun: Boolean(dryRun),
        targetDate,
        recipientPhone
      });

      return successResponse(res, {
        statusCode: 200,
        message: `Milestone reminders processed for window "${result.window || window}"`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/whatsapp/logs
   * Retrieves audit logs of WhatsApp notifications.
   */
  async getLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const logs = await whatsappService.getDeliveryLogs(limit);
      return successResponse(res, {
        statusCode: 200,
        message: 'WhatsApp delivery logs retrieved successfully',
        data: { items: logs, count: logs.length }
      });
    } catch (err) {
      next(err);
    }
  }
};
