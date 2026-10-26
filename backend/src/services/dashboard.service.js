/**
 * Dashboard Service: calculates real-time aggregated metrics.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const dashboardService = {
  async getStats(userId = null) {
    return await supabaseRepository.getStats(userId);
  },

  async getRecentActivity(limit = 10, userId = null) {
    return await supabaseRepository.getRecentSessions(limit, userId);
  },

  async getSubjectProgress(userId = null) {
    return await supabaseRepository.getSubjectProgress(userId);
  }
};
