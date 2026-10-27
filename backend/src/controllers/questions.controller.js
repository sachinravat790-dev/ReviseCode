import { questionsService } from '../services/questions.service.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const questionsController = {
  async getAllQuestions(req, res, next) {
    try {
      const data = await questionsService.getAllQuestions({ ...req.query, userId: req.user?.id });
      return successResponse(res, {
        statusCode: 200,
        message: 'Questions retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getQuestionById(req, res, next) {
    try {
      const question = await questionsService.getQuestionById(req.params.id, req.user?.id);
      if (!question) {
        return errorResponse(res, {
          statusCode: 404,
          message: `Question with ID "${req.params.id}" not found`
        });
      }
      return successResponse(res, {
        statusCode: 200,
        message: 'Question retrieved successfully',
        data: question
      });
    } catch (err) {
      next(err);
    }
  },

  async createQuestion(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return errorResponse(res, {
          statusCode: 401,
          message: 'Authentication required. Please sign in to create questions.'
        });
      }
      const created = await questionsService.createQuestion({ ...req.body, userId: req.user.id });
      return successResponse(res, {
        statusCode: 201,
        message: 'Question created successfully and revision milestones scheduled',
        data: created
      });
    } catch (err) {
      next(err);
    }
  },

  async updateQuestion(req, res, next) {
    try {
      const updated = await questionsService.updateQuestion(req.params.id, req.body, req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Question updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  async toggleBookmark(req, res, next) {
    try {
      const result = await questionsService.toggleBookmark(req.params.id, req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: result.bookmarked ? 'Question bookmarked' : 'Bookmark removed',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteQuestion(req, res, next) {
    try {
      const deleted = await questionsService.deleteQuestion(req.params.id, req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: `Question "${deleted.title}" and its associated milestones deleted successfully`,
        data: deleted
      });
    } catch (err) {
      next(err);
    }
  }
};
