import { revisionsService } from '../services/revisions.service.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const revisionsController = {
  async getAllRevisions(req, res, next) {
    try {
      const data = await revisionsService.getAllRevisions(req.query);
      return successResponse(res, {
        statusCode: 200,
        message: 'Revisions retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getTodayRevisions(req, res, next) {
    try {
      const data = await revisionsService.getTodayRevisions();
      return successResponse(res, {
        statusCode: 200,
        message: "Today's due revisions retrieved successfully",
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getUpcomingRevisions(req, res, next) {
    try {
      const data = await revisionsService.getUpcomingRevisions();
      return successResponse(res, {
        statusCode: 200,
        message: 'Upcoming revisions retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getOverdueRevisions(req, res, next) {
    try {
      const data = await revisionsService.getOverdueRevisions();
      return successResponse(res, {
        statusCode: 200,
        message: 'Overdue revisions retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getCompletedRevisions(req, res, next) {
    try {
      const data = await revisionsService.getCompletedRevisions();
      return successResponse(res, {
        statusCode: 200,
        message: 'Completed revisions retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getRevisionById(req, res, next) {
    try {
      const revision = await revisionsService.getRevisionById(req.params.id);
      if (!revision) {
        return errorResponse(res, {
          statusCode: 404,
          message: `Revision milestone with ID "${req.params.id}" not found`
        });
      }
      return successResponse(res, {
        statusCode: 200,
        message: 'Revision milestone retrieved successfully',
        data: revision
      });
    } catch (err) {
      next(err);
    }
  },

  async completeRevision(req, res, next) {
    try {
      const completed = await revisionsService.completeRevision(req.params.id, req.body);
      return successResponse(res, {
        statusCode: 200,
        message: 'Revision milestone marked as completed',
        data: completed
      });
    } catch (err) {
      next(err);
    }
  },

  async skipRevision(req, res, next) {
    try {
      const skipped = await revisionsService.skipRevision(req.params.id, req.body);
      return successResponse(res, {
        statusCode: 200,
        message: 'Revision milestone skipped',
        data: skipped
      });
    } catch (err) {
      next(err);
    }
  },

  async rescheduleRevision(req, res, next) {
    try {
      const rescheduled = await revisionsService.rescheduleRevision(req.params.id, req.body.newDueDate);
      return successResponse(res, {
        statusCode: 200,
        message: `Revision milestone rescheduled to ${req.body.newDueDate}`,
        data: rescheduled
      });
    } catch (err) {
      next(err);
    }
  },

  async createCustomRevision(req, res, next) {
    try {
      const custom = await revisionsService.createCustomRevision(req.body);
      return successResponse(res, {
        statusCode: 201,
        message: 'Custom revision milestone created successfully',
        data: custom
      });
    } catch (err) {
      next(err);
    }
  }
};
