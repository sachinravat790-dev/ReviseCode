/**
 * Questions Service: handles business logic, duplication rules, and mandatory revision scheduling.
 * Persistent storage backed by Supabase PostgreSQL.
 */

import { supabaseRepository } from '../repositories/supabase.repository.js';
import { generateMandatoryMilestones, getTodayDateString } from '../utils/dates.js';
import { config } from '../config/env.js';
import { DEFAULT_TEST_USER_ID } from '../middleware/auth.js';

export const questionsService = {
  async getAllQuestions(params = {}) {
    return await supabaseRepository.getAllQuestions(params);
  },

  async getQuestionById(id, userId = null) {
    return await supabaseRepository.getQuestionById(id, userId);
  },

  async checkDuplicate(platform, problemNumber, title, userId = null) {
    return await supabaseRepository.checkDuplicateQuestion(platform, problemNumber, title, userId);
  },

  async createQuestion(data) {
    const userId = data.userId || data.user_id || (config.nodeEnv === 'test' ? DEFAULT_TEST_USER_ID : null);

    // 1. Create the question in Supabase
    const createdQuestion = await supabaseRepository.createQuestion({ ...data, userId });

    // 2. Automatically generate and persist 5 mandatory revision milestones (Day 3, 7, 12, 20, 30)
    const dateSolved = data.dateSolved || getTodayDateString();
    const milestoneTemplates = generateMandatoryMilestones(dateSolved);

    const milestonesToInsert = milestoneTemplates.map(m => ({
      questionId: createdQuestion.id,
      milestoneDay: m.milestoneDay,
      dueDate: m.dueDate,
      userId,
      user_id: userId,
      notes: ''
    }));

    await supabaseRepository.createMilestones(milestonesToInsert);

    // 3. Create persistent notification
    await supabaseRepository.createNotification({
      type: 'revision_scheduled',
      category: 'Revisions',
      title: `Question Saved: ${createdQuestion.title}`,
      message: `Scheduled 5 revision milestones for Day 3, 7, 12, 20, and 30.`,
      questionId: createdQuestion.id,
      userId,
      user_id: userId
    });

    return createdQuestion;
  },

  async updateQuestion(id, data, userId = null) {
    return await supabaseRepository.updateQuestion(id, data, userId);
  },

  async toggleBookmark(id, userId = null) {
    return await supabaseRepository.toggleBookmark(id, userId);
  },

  async deleteQuestion(id, userId = null) {
    return await supabaseRepository.deleteQuestion(id, userId);
  },

  /**
   * Retrieves questions solved today using Asia/Kolkata timezone.
   * Strictly counts new questions solved on this date, NOT revision completions.
   */
  async getTodaySolvedQuestions(userIdOrOptions, maybeTimeZone) {
    let userId = null;
    let timeZone = 'Asia/Kolkata';

    if (typeof userIdOrOptions === 'string' && userIdOrOptions.includes('/')) {
      timeZone = userIdOrOptions;
    } else if (typeof userIdOrOptions === 'string') {
      userId = userIdOrOptions;
      if (maybeTimeZone) timeZone = maybeTimeZone;
    } else if (userIdOrOptions && typeof userIdOrOptions === 'object') {
      userId = userIdOrOptions.userId || null;
      timeZone = userIdOrOptions.timeZone || 'Asia/Kolkata';
    }

    const today = getTodayDateString(timeZone);
    const result = await supabaseRepository.getAllQuestions({ limit: 1000, userId });
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
