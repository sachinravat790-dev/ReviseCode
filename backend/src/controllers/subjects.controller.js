import { subjectsService } from '../services/subjects.service.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const subjectsController = {
  async getAllSubjects(req, res, next) {
    try {
      const data = await subjectsService.getAllSubjects(req.user?.id);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subjects retrieved successfully',
        data
      });
    } catch (err) {
      next(err);
    }
  },

  async getSubjectById(req, res, next) {
    try {
      const subject = await subjectsService.getSubjectById(req.params.id, req.user?.id);
      if (!subject) {
        return errorResponse(res, {
          statusCode: 404,
          message: `Subject with ID "${req.params.id}" not found`
        });
      }
      return successResponse(res, {
        statusCode: 200,
        message: 'Subject retrieved successfully',
        data: subject
      });
    } catch (err) {
      next(err);
    }
  },

  async createSubject(req, res, next) {
    try {
      const created = await subjectsService.createSubject(req.body);
      return successResponse(res, {
        statusCode: 201,
        message: 'Subject created successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  },

  async updateSubject(req, res, next) {
    try {
      const updated = await subjectsService.updateSubject(req.params.id, req.body);
      return successResponse(res, {
        statusCode: 200,
        message: 'Subject updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteSubject(req, res, next) {
    try {
      const deleted = await subjectsService.deleteSubject(req.params.id);
      return successResponse(res, {
        statusCode: 200,
        message: `Subject "${deleted.name}" deleted successfully`,
        data: deleted
      });
    } catch (err) {
      next(err);
    }
  }
};
