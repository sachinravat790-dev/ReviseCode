import { supabaseRepository } from '../repositories/supabase.repository.js';
import { successResponse } from '../utils/api-response.js';

export const settingsController = {
  async getSettings(req, res, next) {
    try {
      const settings = await supabaseRepository.getSettings();
      return successResponse(res, {
        statusCode: 200,
        message: 'Settings retrieved successfully',
        data: settings
      });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      const updated = await supabaseRepository.updateSettings(req.body);
      return successResponse(res, {
        statusCode: 200,
        message: 'Settings updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
};
