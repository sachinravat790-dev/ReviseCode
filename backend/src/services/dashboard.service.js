/**
 * Dashboard Service: calculates real-time aggregated metrics.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const dashboardService = {
  async getStats() {
    return await supabaseRepository.getStats();
  },

  async getRecentActivity(limit = 10) {
    return await supabaseRepository.getRecentSessions(limit);
  },

  async getSubjectProgress() {
    return await supabaseRepository.getSubjectProgress();
  }
};
