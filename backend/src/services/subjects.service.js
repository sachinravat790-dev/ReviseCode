/**
 * Subjects Service: handles subject management and ensures referential safety.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const subjectsService = {
  async getAllSubjects(userId = null) {
    return await supabaseRepository.getAllSubjects(userId);
  },

  async getSubjectById(id, userId = null) {
    return await supabaseRepository.getSubjectById(id, userId);
  },

  async createSubject(data) {
    return await supabaseRepository.createSubject(data);
  },

  async updateSubject(id, data) {
    return await supabaseRepository.updateSubject(id, data);
  },

  async deleteSubject(id) {
    return await supabaseRepository.deleteSubject(id);
  }
};
