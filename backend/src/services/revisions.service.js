/**
 * Revisions Service: core spaced repetition business logic.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const revisionsService = {
  async getAllRevisions({ status, questionId, userId } = {}) {
    return await supabaseRepository.getAllRevisions({ status, questionId, userId });
  },

  async getTodayRevisions(userId = null) {
    return await supabaseRepository.getAllRevisions({ status: 'due', userId });
  },

  async getUpcomingRevisions(userId = null) {
    return await supabaseRepository.getAllRevisions({ status: 'upcoming', userId });
  },

  async getOverdueRevisions(userId = null) {
    return await supabaseRepository.getAllRevisions({ status: 'overdue', userId });
  },

  async getCompletedRevisions(userId = null) {
    return await supabaseRepository.getAllRevisions({ status: 'completed', userId });
  },

  async getRevisionById(id, userId = null) {
    return await supabaseRepository.getRevisionById(id, userId);
  },

  async completeRevision(id, { recallRating = 'easy', notes = '' } = {}, userId = null) {
    return await supabaseRepository.completeRevision(id, { recallRating, notes }, userId);
  },

  async skipRevision(id, { reason = '' } = {}, userId = null) {
    return await supabaseRepository.skipRevision(id, { reason }, userId);
  },

  async rescheduleRevision(id, newDueDate, userId = null) {
    return await supabaseRepository.rescheduleRevision(id, newDueDate, userId);
  },

  async createCustomRevision({ questionId, milestoneDay, dueDate, notes = '', userId = null }) {
    return await supabaseRepository.createCustomRevision({ questionId, milestoneDay, dueDate, notes, userId });
  }
};
