import { dashboardService } from '../services/dashboard.service.js';
import { successResponse } from '../utils/api-response.js';

export const dashboardController = {
  async getStats(req, res, next) {
    try {
      const stats = await dashboardService.getStats(req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Dashboard statistics calculated successfully',
        data: stats
      });
    } catch (err) {
      next(err);
    }
  },

  async getRecentActivity(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const activity = await dashboardService.getRecentActivity(limit, req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Recent revision activity retrieved successfully',
        data: { items: activity }
      });
    } catch (err) {
      next(err);
    }
  },

  async getSubjectProgress(req, res, next) {
    try {
      const progress = await dashboardService.getSubjectProgress(req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subject progress metrics calculated successfully',
        data: { items: progress }
      });
    } catch (err) {
      next(err);
    }
  }
};
