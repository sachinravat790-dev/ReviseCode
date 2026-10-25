/**
 * Revisions Service: core spaced repetition business logic.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const revisionsService = {
  async getAllRevisions({ status, questionId } = {}) {
    return await supabaseRepository.getAllRevisions({ status, questionId });
  },

  async getTodayRevisions() {
    return await supabaseRepository.getAllRevisions({ status: 'due' });
  },

  async getUpcomingRevisions() {
    return await supabaseRepository.getAllRevisions({ status: 'upcoming' });
  },

  async getOverdueRevisions() {
    return await supabaseRepository.getAllRevisions({ status: 'overdue' });
  },

  async getCompletedRevisions() {
    return await supabaseRepository.getAllRevisions({ status: 'completed' });
  },

  async getRevisionById(id) {
    return await supabaseRepository.getRevisionById(id);
  },

  async completeRevision(id, { recallRating = 'easy', notes = '' } = {}) {
    return await supabaseRepository.completeRevision(id, { recallRating, notes });
  },

  async skipRevision(id, { reason = '' } = {}) {
    return await supabaseRepository.skipRevision(id, { reason });
  },

  async rescheduleRevision(id, newDueDate) {
    return await supabaseRepository.rescheduleRevision(id, newDueDate);
  },

  async createCustomRevision({ questionId, milestoneDay, dueDate, notes = '' }) {
    return await supabaseRepository.createCustomRevision({ questionId, milestoneDay, dueDate, notes });
  }
};
