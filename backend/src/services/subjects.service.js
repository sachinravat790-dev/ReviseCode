/**
 * Subjects Service: handles subject management and ensures referential safety.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';

export const subjectsService = {
  async getAllSubjects() {
    return await supabaseRepository.getAllSubjects();
  },

  async getSubjectById(id) {
    return await supabaseRepository.getSubjectById(id);
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
