import { authService } from '../services/auth.service.js';
import { successResponse } from '../utils/api-response.js';

export const authController = {
  async register(req, res, next) {
    try {
      const fullName = req.body.fullName || req.body.name || '';
      const { email, password } = req.body;
      const { user, token } = await authService.register({ fullName, email, password });
      return successResponse(res, {
        statusCode: 201,
        message: 'Account created successfully',
        data: { user, token }
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.login({ email, password });
      return successResponse(res, {
        statusCode: 200,
        message: 'Signed in successfully',
        data: { user, token }
      });
    } catch (err) {
      next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      return successResponse(res, {
        statusCode: 200,
        message: 'Current user session retrieved',
        data: { user: req.user }
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      return successResponse(res, {
        statusCode: 200,
        message: 'Signed out successfully',
        data: { success: true }
      });
    } catch (err) {
      next(err);
    }
  },

  getOAuthUrl(req, res, next) {
    try {
      const { provider } = req.params;
      const redirectTo = req.query.redirectTo || `${config.clientOrigin}/login`;
      const supabaseUrl = config.supabaseUrl || 'https://uffxohelmzgvgsbnuuyc.supabase.co';
      const cleanProvider = (provider || 'google').toLowerCase();
      const url = `${supabaseUrl}/auth/v1/authorize?provider=${encodeURIComponent(cleanProvider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
      return successResponse(res, {
        statusCode: 200,
        message: 'OAuth authorization URL generated',
        data: { url, provider: cleanProvider, redirectTo }
      });
    } catch (err) {
      next(err);
    }
  }
};
