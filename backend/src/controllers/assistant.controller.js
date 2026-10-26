import { assistantService } from '../services/assistant.service.js';
import { successResponse, errorResponse } from '../utils/api-response.js';

export const assistantController = {
  getCapabilities(req, res, next) {
    try {
      const capabilities = assistantService.getCapabilities();
      return successResponse(res, {
        statusCode: 200,
        message: 'Assistant capabilities retrieved',
        data: capabilities
      });
    } catch (err) {
      next(err);
    }
  },

  getStatus(req, res, next) {
    try {
      const status = assistantService.getStatus();
      return successResponse(res, {
        statusCode: 200,
        message: 'Assistant Gemini status retrieved',
        data: status
      });
    } catch (err) {
      next(err);
    }
  },

  async testConnection(req, res, next) {
    try {
      const { apiKey } = req.body || {};
      const result = await assistantService.testGeminiConnection(apiKey);
      return successResponse(res, {
        statusCode: 200,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async configureKey(req, res, next) {
    try {
      const { apiKey, persist = true } = req.body || {};
      const result = await assistantService.configureGeminiKey(apiKey, persist);
      return successResponse(res, {
        statusCode: 200,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async executeCommand(req, res, next) {
    try {
      const { command, payload } = req.body;
      const result = await assistantService.executeCommand(command, payload, req.user?.id);

      if (!result.handled && result.clarificationNeeded) {
        return errorResponse(res, {
          statusCode: 400,
          message: result.message,
          errors: result.supportedCommands || [result.message]
        });
      }

      if (!result.handled) {
        return errorResponse(res, {
          statusCode: 400,
          message: result.message,
          errors: result.supportedCommands || []
        });
      }

      return successResponse(res, {
        statusCode: 200,
        message: result.message,
        data: result.data || {}
      });
    } catch (err) {
      next(err);
    }
  },

  async handleChat(req, res, next) {
    try {
      const { message, prompt, text } = req.body;
      const query = message || prompt || text || '';

      if (!query || typeof query !== 'string' || !query.trim()) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Message cannot be empty. Please provide a question or instruction.'
        });
      }

      const result = await assistantService.handleChatMessage(query, { ...req.body, userId: req.user?.id });
      return successResponse(res, {
        statusCode: 200,
        message: 'Assistant response generated',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
};
