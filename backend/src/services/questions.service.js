/**
 * Questions Service: handles business logic, duplication rules, and mandatory revision scheduling.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';
import { generateMandatoryMilestones, getTodayDateString } from '../utils/dates.js';

export const questionsService = {
  async getAllQuestions(params = {}) {
    return await supabaseRepository.getAllQuestions(params);
  },

  async getQuestionById(id) {
    return await supabaseRepository.getQuestionById(id);
  },

  async checkDuplicate(platform, problemNumber, title) {
    return await supabaseRepository.checkDuplicateQuestion(platform, problemNumber, title);
  },

  async createQuestion(data) {
    // 1. Create the question in Supabase
    const createdQuestion = await supabaseRepository.createQuestion(data);

    // 2. Automatically generate and persist 5 mandatory revision milestones (Day 3, 7, 12, 20, 30)
    const dateSolved = data.dateSolved || getTodayDateString();
    const milestoneTemplates = generateMandatoryMilestones(dateSolved);

    const milestonesToInsert = milestoneTemplates.map(m => ({
      questionId: createdQuestion.id,
      milestoneDay: m.milestoneDay,
      dueDate: m.dueDate,
      notes: ''
    }));

    await supabaseRepository.createMilestones(milestonesToInsert);

    // 3. Create persistent notification
    await supabaseRepository.createNotification({
      type: 'revision_scheduled',
      category: 'Revisions',
      title: `Question Saved: ${createdQuestion.title}`,
      message: `Scheduled 5 revision milestones for Day 3, 7, 12, 20, and 30.`,
      questionId: createdQuestion.id
    });

    return createdQuestion;
  },

  async updateQuestion(id, data) {
    return await supabaseRepository.updateQuestion(id, data);
  },

  async toggleBookmark(id) {
    return await supabaseRepository.toggleBookmark(id);
  },

  async deleteQuestion(id) {
    return await supabaseRepository.deleteQuestion(id);
  },

  /**
   * Retrieves questions solved today using Asia/Kolkata timezone.
   * Strictly counts new questions solved on this date, NOT revision completions.
   */
  async getTodaySolvedQuestions(timeZone = 'Asia/Kolkata') {
    const today = getTodayDateString(timeZone);
    const result = await supabaseRepository.getAllQuestions({ limit: 1000 });
    const all = result?.items || [];
    const solvedToday = all.filter(q => q.dateSolved === today);
    return {
      today,
      timeZone,
      count: solvedToday.length,
      items: solvedToday
    };
  }
};
