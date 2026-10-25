import { supabaseRepository } from '../repositories/supabase.repository.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const notificationsController = {
  async getNotifications(req, res, next) {
    try {
      const items = await supabaseRepository.getAllNotifications();
      return successResponse(res, {
        statusCode: 200,
        message: 'Notifications retrieved successfully',
        data: { items }
      });
    } catch (err) {
      next(err);
    }
  },

  async markAsRead(req, res, next) {
    try {
      const notif = await supabaseRepository.markNotificationAsRead(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Notification marked as read',
        data: notif
      });
    } catch (err) {
      next(err);
    }
  }
};
