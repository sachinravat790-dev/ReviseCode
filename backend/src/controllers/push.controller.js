/**
 * Push Controller (src/controllers/push.controller.js)
 * Manages VAPID public key distribution, client subscriptions, and test pushes.
 */

import { pushService } from '../services/push.service.js';
import { supabaseRepository } from '../repositories/supabase.repository.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const pushController = {
  /**
   * GET /api/push/public-key
   * Supplies the VAPID public key so client can subscribe with pushManager.
   */
  async getPublicKey(req, res, next) {
    try {
      const publicKey = pushService.getPublicKey();
      return successResponse(res, {
        statusCode: 200,
        message: 'VAPID public key retrieved successfully',
        data: { publicKey }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/push/subscribe
   * Saves or updates a browser push subscription for the active user.
   */
  async subscribe(req, res, next) {
    try {
      const { endpoint, keys } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Invalid subscription payload. Required: endpoint, keys.p256dh, keys.auth'
        });
      }

      const userId = req.user?.id || null;
      const saved = await supabaseRepository.savePushSubscription({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      });

      return successResponse(res, {
        statusCode: 200,
        message: 'Push subscription registered successfully',
        data: saved
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/push/test
   * Sends an immediate test notification to the client's subscription.
   */
  async testPush(req, res, next) {
    try {
      const { endpoint, keys } = req.body || {};
      let sub = null;

      if (endpoint && keys?.p256dh && keys?.auth) {
        sub = { endpoint, p256dh: keys.p256dh, auth: keys.auth };
      } else {
        const userId = req.user?.id || null;
        const subs = await supabaseRepository.getPushSubscriptions(userId);
        if (subs && subs.length > 0) {
          sub = subs[subs.length - 1];
        }
      }

      if (!sub) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'No push subscription found to test. Please enable notifications first.'
        });
      }

      const result = await pushService.sendTestNotification(sub);
      if (!result.success) {
        return errorResponse(res, {
          statusCode: 500,
          message: result.error || 'Failed to dispatch push notification'
        });
      }

      return successResponse(res, {
        statusCode: 200,
        message: 'Test push notification sent successfully to your device!',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/push/unsubscribe
   */
  async unsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body || {};
      if (endpoint) {
        await supabaseRepository.deletePushSubscription(endpoint);
      }
      return successResponse(res, {
        statusCode: 200,
        message: 'Push subscription removed successfully'
      });
    } catch (err) {
      next(err);
    }
  }
};
