/**
 * Supabase PostgreSQL Repository for ReviseCode (src/repositories/supabase.repository.js)
 * Implements persistent database operations across subjects, questions,
 * revision milestones, session history, notifications, and user settings.
 */

import crypto from 'crypto';
import { getSupabaseClient } from '../config/supabase.js';
import { computeRevisionStatus, getTodayDateString } from '../utils/dates.js';
import { config } from '../config/env.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

export function generateUuid() {
  return crypto.randomUUID();
}

export function parseProblemNumber(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  const num = parseInt(str, 10);
  return Number.isInteger(num) ? num : null;
}

/**
 * -------------------------------------------------------------
 * Data Mappers (snake_case database <-> camelCase API models)
 * -------------------------------------------------------------
 */

export function mapSubjectFromDb(row, { questionCount = 0, pendingCount = 0 } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    color: row.color || '#7c3aed',
    icon: row.icon || 'folder',
    topics: Array.isArray(row.topics) ? row.topics : [],
    questionCount,
    pendingCount,
    createdAt: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : ''
  };
}

export function mapQuestionFromDb(row, subjectName = null, milestones = []) {
  if (!row) return null;

  const dateSolvedStr = row.date_solved 
    ? (typeof row.date_solved === 'string' ? row.date_solved.split('T')[0] : new Date(row.date_solved).toISOString().split('T')[0])
    : (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : getTodayDateString());

  const createdStr = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : dateSolvedStr;
  const updatedStr = row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : createdStr;

  const resolvedSubject = subjectName || (row.subjects && row.subjects.name) || 'DSA';

  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    problemNumber: row.problem_number ?? '',
    problemUrl: row.problem_url || '',
    subjectId: row.subject_id || '',
    subject: resolvedSubject,
    topic: row.topic || 'General',
    difficulty: row.difficulty || 'Medium',
    dateSolved: dateSolvedStr,
    description: row.statement || '',
    summary: row.statement || '',
    approach: row.approach || '',
    notes: row.notes || '',
    code: row.solution || '',
    codeSolution: row.solution || '',
    programmingLanguage: row.code_language || 'javascript',
    codeLanguage: row.code_language || 'javascript',
    timeComplexity: row.time_complexity || 'O(n)',
    spaceComplexity: row.space_complexity || 'O(1)',
    tags: Array.isArray(row.tags) ? row.tags : [],
    bookmarked: Boolean(row.is_bookmarked),
    isBookmarked: Boolean(row.is_bookmarked),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdAt: createdStr,
    updatedAt: updatedStr,
    milestones: milestones || []
  };
}

export function mapRevisionFromDb(row, question = null) {
  if (!row) return null;
  const q = question || row.questions || null;
  const dueDateStr = typeof row.due_date === 'string' ? row.due_date.split('T')[0] : new Date(row.due_date).toISOString().split('T')[0];
  const completedAtStr = row.completed_at ? (typeof row.completed_at === 'string' ? row.completed_at.split('T')[0] : new Date(row.completed_at).toISOString().split('T')[0]) : null;

  const dynamicStatus = computeRevisionStatus(dueDateStr, completedAtStr);

  return {
    id: row.id,
    questionId: row.question_id,
    questionTitle: q?.title || row.question_title || '',
    platform: q?.platform || '',
    problemNumber: q?.problem_number ?? '',
    difficulty: q?.difficulty || 'Medium',
    subject: q?.subjects?.name || q?.subject || 'DSA',
    milestoneDay: row.milestone_day,
    dueDate: dueDateStr,
    status: dynamicStatus,
    completedAt: completedAtStr,
    recallRating: row.recall_rating || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapSessionFromDb(row, questionTitle = '') {
  if (!row) return null;
  return {
    id: row.id,
    revisionId: row.revision_id,
    questionId: row.question_id,
    questionTitle: questionTitle || row.questions?.title || '',
    milestoneDay: row.milestone_day,
    recallRating: row.recall_rating,
    timestamp: row.timestamp || new Date().toISOString(),
    notes: row.notes || ''
  };
}

export function mapNotificationFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    category: row.category || 'Revisions',
    title: row.title,
    message: row.message,
    questionId: row.question_id || null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || new Date().toISOString()
  };
}

export function mapSettingsFromDb(row) {
  if (!row) {
    return {
      theme: 'dark',
      timeZone: 'Asia/Kolkata (UTC+05:30)',
      reminderTime: '09:00',
      studyGoalQuestions: 3,
      customIntervalsEnabled: false,
      customIntervalDays: [45, 60],
      inAppNotifications: true,
      emailNotifications: true,
      whatsAppNotifications: false,
      whatsappNotifications: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      aiDemoMode: true
    };
  }
  const wa = Boolean(row.whatsapp_notifications);
  return {
    theme: row.theme || 'dark',
    timeZone: row.time_zone || 'Asia/Kolkata (UTC+05:30)',
    reminderTime: row.reminder_time || '09:00',
    studyGoalQuestions: row.study_goal_questions ?? 3,
    customIntervalsEnabled: Boolean(row.custom_intervals_enabled),
    customIntervalDays: row.custom_interval_days || [45, 60],
    inAppNotifications: Boolean(row.in_app_notifications),
    emailNotifications: Boolean(row.email_notifications),
    whatsAppNotifications: wa,
    whatsappNotifications: wa,
    quietHoursStart: row.quiet_hours_start || '22:00',
    quietHoursEnd: row.quiet_hours_end || '08:00',
    aiDemoMode: Boolean(row.ai_demo_mode)
  };
}

export function isSchemaOrColumnError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  return (
    code === 'PGRST205' || // Table not found in schema cache
    code === 'PGRST204' || // Column not found in schema cache
    code === '42703' ||    // PostgreSQL undefined_column
    code === '42P01' ||    // PostgreSQL undefined_table
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('not find the table') ||
    msg.includes('not find the column')
  );
}

/**
 * In production mode, halts silent ephemeral fallbacks if a required table is missing.
 */
export function assertProductionSchema(tableName, err) {
  if (config.isProduction && isSchemaOrColumnError(err)) {
    throw new Error(
      `[Production Database Error] Table or column "${tableName}" is missing or unmigrated in Supabase PostgreSQL. ` +
      `Please execute backend/supabase/migrations/production_schema_migration.sql in the Supabase SQL Editor. ` +
      `Underlying error: ${err.message}`
    );
  }
}

/**
 * -------------------------------------------------------------
 * Supabase Repository Implementation
 * -------------------------------------------------------------
 */
export class SupabaseRepository {
  constructor(client = null) {
    this._customClient = client;
    this._inMemoryWhatsAppLogs = [];
    this._inMemoryRevisions = new Map();
    this._inMemorySessions = [];
    this._inMemoryNotifications = [];
    this._inMemorySettings = null;
    this._cachedSubjectsExtra = new Map();
    this._cachedQuestionsExtra = new Map();
    this._missingTables = new Map();
  }

  _markTableMissing(tableName, ttlMs = 60000) {
    this._missingTables.set(tableName, Date.now() + ttlMs);
  }

  _isTableMissing(tableName) {
    const expiresAt = this._missingTables.get(tableName);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this._missingTables.delete(tableName);
      return false;
    }
    return true;
  }

  get client() {
    return this._customClient || getSupabaseClient();
  }

  // ==========================================
  // SUBJECTS
  // ==========================================

  async getAllSubjects() {
    const fetchSubjects = this.client
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });

    const fetchQuestions = this.client
      .from('questions')
      .select('id, subject_id');

    const fetchRevisions = this._isTableMissing('revisions')
      ? Promise.resolve({ data: Array.from(this._inMemoryRevisions.values()), error: null })
      : this.client.from('revisions').select('id, question_id, due_date, completed_at');

    const [subRes, qRes, revRes] = await Promise.all([
      Promise.resolve(fetchSubjects).catch(err => ({ data: null, error: err })),
      Promise.resolve(fetchQuestions).catch(err => ({ data: null, error: err })),
      Promise.resolve(fetchRevisions).catch(err => ({ data: null, error: err }))
    ]);

    if (subRes.error) {
      throw new Error(`Failed to list subjects: ${subRes.error.message}`);
    }
    const subjects = subRes.data || [];

    let questions = [];
    if (qRes.error) {
      console.warn('Database warning: Unable to fetch questions for subject stats:', qRes.error.message);
    } else {
      questions = qRes.data || [];
    }

    let revisions = [];
    if (revRes.error) {
      if (isSchemaOrColumnError(revRes.error)) {
        this._markTableMissing('revisions');
        console.warn('Database warning: revisions table not available in schema cache. Using in-memory fallback for pending revision counts.');
        revisions = Array.from(this._inMemoryRevisions.values());
      } else {
        console.warn('Database warning: Failed to compute subject revision stats:', revRes.error.message);
      }
    } else {
      revisions = revRes.data || [];
    }

    const qList = questions;
    const revList = revisions;

    const questionSubjectMap = new Map();
    qList.forEach(q => questionSubjectMap.set(q.id, q.subject_id));

    return subjects.map(s => {
      const qCount = qList.filter(q => q.subject_id === s.id).length;
      
      const pendingCount = revList.filter(m => {
        const qSubId = questionSubjectMap.get(m.question_id || m.questionId);
        if (qSubId !== s.id) return false;
        const status = computeRevisionStatus(m.due_date || m.dueDate, m.completed_at || m.completedAt);
        return status === 'due' || status === 'overdue';
      }).length;

      const cachedExtra = this._cachedSubjectsExtra.get(s.id) || {};
      const merged = { ...cachedExtra, ...s };
      return mapSubjectFromDb(merged, { questionCount: qCount, pendingCount });
    });
  }

  async getSubjectById(id) {
    if (!id) return null;
    let query = this.client.from('subjects').select('*');
    if (isValidUuid(id)) {
      query = query.eq('id', id);
    } else {
      // Legacy id compatibility fallback e.g. 'sub_dsa'
      const cleanName = id.replace(/^sub_/, '').toLowerCase();
      query = query.ilike('name', cleanName);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (error.code === '22P02') return null;
      throw new Error(`Failed to get subject by ID "${id}": ${error.message}`);
    }
    if (!data) return null;

    let questions = [];
    try {
      const { data: qData, error: qErr } = await this.client
        .from('questions')
        .select('*')
        .eq('subject_id', data.id)
        .order('created_at', { ascending: false });

      if (qErr) {
        console.warn(`Database warning: Failed to fetch questions for subject "${id}":`, qErr.message);
      } else {
        questions = qData || [];
      }
    } catch (e) {
      console.warn(`Database warning: Could not query questions for subject "${id}":`, e.message);
    }

    const cachedExtra = this._cachedSubjectsExtra.get(data.id) || {};
    const merged = { ...cachedExtra, ...data };
    const mappedQuestions = (questions || []).map(q => {
      const qExtra = this._cachedQuestionsExtra.get(q.id) || {};
      return mapQuestionFromDb({ ...qExtra, ...q }, data.name);
    });

    return {
      ...mapSubjectFromDb(merged, { questionCount: mappedQuestions.length }),
      questions: mappedQuestions
    };
  }

  async findSubjectByName(name) {
    if (!name) return null;
    const { data, error } = await this.client
      .from('subjects')
      .select('*')
      .ilike('name', name.trim())
      .maybeSingle();

    if (error) throw new Error(`Failed to lookup subject by name: ${error.message}`);
    return data ? mapSubjectFromDb(data) : null;
  }

  async createSubject(data) {
    const existing = await this.findSubjectByName(data.name);
    if (existing) {
      const err = new Error(`Subject with name "${data.name}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    const id = isValidUuid(data.id) ? data.id : generateUuid();
    const fullRow = {
      id,
      name: data.name.trim(),
      description: data.description || '',
      color: data.color || '#7c3aed',
      icon: data.icon || 'folder',
      topics: Array.isArray(data.topics) ? data.topics : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let createdRecord = null;
    const { data: created, error } = await this.client
      .from('subjects')
      .insert(fullRow)
      .select()
      .single();

    if (error) {
      if (isSchemaOrColumnError(error)) {
        console.warn('Database warning: subjects table lacks enhanced columns (color/icon/topics). Inserting base columns.');
        const baseRow = {
          id,
          name: data.name.trim(),
          description: data.description || '',
          created_at: new Date().toISOString()
        };
        const { data: baseCreated, error: baseErr } = await this.client
          .from('subjects')
          .insert(baseRow)
          .select()
          .single();

        if (baseErr) throw new Error(`Failed to create subject: ${baseErr.message}`);
        createdRecord = baseCreated;
      } else {
        throw new Error(`Failed to create subject: ${error.message}`);
      }
    } else {
      createdRecord = created;
    }

    this._cachedSubjectsExtra.set(id, {
      color: data.color || '#7c3aed',
      icon: data.icon || 'folder',
      topics: Array.isArray(data.topics) ? data.topics : []
    });

    return mapSubjectFromDb({
      color: data.color || '#7c3aed',
      icon: data.icon || 'folder',
      topics: Array.isArray(data.topics) ? data.topics : [],
      ...createdRecord
    });
  }

  async updateSubject(id, data) {
    const existing = await this.getSubjectById(id);
    if (!existing) {
      const err = new Error(`Subject not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const updates = {
      updated_at: new Date().toISOString()
    };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description || '';
    if (data.color !== undefined) updates.color = data.color || '#7c3aed';
    if (data.icon !== undefined) updates.icon = data.icon || 'folder';
    if (data.topics !== undefined) updates.topics = Array.isArray(data.topics) ? data.topics : [];

    let updatedRecord = null;
    const { data: updated, error } = await this.client
      .from('subjects')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      if (isSchemaOrColumnError(error)) {
        console.warn('Database warning: subjects table lacks enhanced columns for update. Updating supported columns.');
        const baseUpdates = {};
        if (data.name !== undefined) baseUpdates.name = data.name.trim();
        if (data.description !== undefined) baseUpdates.description = data.description || '';

        if (Object.keys(baseUpdates).length > 0) {
          const { data: baseUpdated, error: baseErr } = await this.client
            .from('subjects')
            .update(baseUpdates)
            .eq('id', existing.id)
            .select()
            .single();

          if (baseErr) throw new Error(`Failed to update subject: ${baseErr.message}`);
          updatedRecord = baseUpdated;
        } else {
          updatedRecord = { id: existing.id, name: existing.name, description: existing.description };
        }
      } else {
        throw new Error(`Failed to update subject "${id}": ${error.message}`);
      }
    } else {
      updatedRecord = updated;
    }

    const currentExtra = this._cachedSubjectsExtra.get(existing.id) || {};
    this._cachedSubjectsExtra.set(existing.id, {
      ...currentExtra,
      color: data.color !== undefined ? data.color : existing.color,
      icon: data.icon !== undefined ? data.icon : existing.icon,
      topics: data.topics !== undefined ? data.topics : existing.topics
    });

    return mapSubjectFromDb({
      ...existing,
      ...updatedRecord,
      ...this._cachedSubjectsExtra.get(existing.id)
    });
  }

  async deleteSubject(id) {
    const existing = await this.getSubjectById(id);
    if (!existing) {
      const err = new Error(`Subject not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    // Check referential protection: reject if assigned questions exist
    const { count, error: countErr } = await this.client
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', existing.id);

    if (countErr) throw new Error(`Failed to verify subject referential integrity: ${countErr.message}`);

    if (count > 0) {
      const err = new Error(
        `Cannot delete subject "${existing.name}" because it still has ${count} associated question(s). Reassign or delete those questions first.`
      );
      err.statusCode = 400;
      throw err;
    }

    const { error: delErr } = await this.client
      .from('subjects')
      .delete()
      .eq('id', existing.id);

    if (delErr) throw new Error(`Failed to delete subject: ${delErr.message}`);
    return existing;
  }

  // ==========================================
  // QUESTIONS
  // ==========================================

  async getAllQuestions({ search, subject, subjectId, topic, difficulty, platform, bookmarked, page = 1, limit = 50 } = {}) {
    let query = this.client
      .from('questions')
      .select('*, subjects(id, name)', { count: 'exact' });

    if (difficulty && difficulty !== 'all') {
      query = query.ilike('difficulty', difficulty);
    }

    if (platform && platform !== 'all') {
      query = query.ilike('platform', platform);
    }

    if (topic && topic !== 'all') {
      query = query.ilike('topic', topic);
    }

    if (bookmarked !== undefined && bookmarked !== '') {
      const isBookmarked = String(bookmarked) === 'true';
      query = query.eq('is_bookmarked', isBookmarked);
    }

    // Resolve subject / subjectId
    let targetSubjectId = null;
    if (subjectId) {
      if (isValidUuid(subjectId)) {
        targetSubjectId = subjectId;
      } else {
        const sub = await this.getSubjectById(subjectId);
        if (sub) targetSubjectId = sub.id;
      }
    } else if (subject && subject !== 'all') {
      const sub = await this.findSubjectByName(subject);
      if (sub) targetSubjectId = sub.id;
    }

    if (targetSubjectId) {
      query = query.eq('subject_id', targetSubjectId);
    }

    if (search && search.trim()) {
      const q = search.trim();
      const numQ = parseInt(q, 10);
      if (!isNaN(numQ) && String(numQ) === q) {
        query = query.or(`title.ilike.%${q}%,problem_number.eq.${numQ},topic.ilike.%${q}%`);
      } else {
        query = query.or(`title.ilike.%${q}%,topic.ilike.%${q}%`);
      }
    }

    query = query.order('created_at', { ascending: false });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`Failed to query questions: ${error.message}`);

    const items = (data || []).map(q => {
      const qExtra = this._cachedQuestionsExtra.get(q.id) || {};
      return mapQuestionFromDb({ ...qExtra, ...q });
    });
    const total = count ?? items.length;

    return {
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  async getQuestionById(id) {
    if (!id) return null;

    const { data: question, error } = await this.client
      .from('questions')
      .select('*, subjects(id, name)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.code === '22P02') return null;
      throw new Error(`Failed to retrieve question: ${error.message}`);
    }
    if (!question) return null;

    let milestones = [];
    try {
      const { data: revisions, error: revErr } = await this.client
        .from('revisions')
        .select('*')
        .eq('question_id', question.id)
        .order('milestone_day', { ascending: true });

      if (revErr) {
        if (isSchemaOrColumnError(revErr)) {
          console.warn(`Database warning: revisions table not available in schema cache. Checking in-memory milestones for question "${question.id}".`);
          milestones = Array.from(this._inMemoryRevisions.values())
            .filter(r => (r.question_id || r.questionId) === question.id)
            .sort((a, b) => (a.milestone_day || a.milestoneDay) - (b.milestone_day || b.milestoneDay))
            .map(r => mapRevisionFromDb(r, question));
        } else {
          throw new Error(`Failed to retrieve milestones for question: ${revErr.message}`);
        }
      } else {
        milestones = (revisions || []).map(r => mapRevisionFromDb(r, question));
      }
    } catch (e) {
      if (isSchemaOrColumnError(e)) {
        milestones = Array.from(this._inMemoryRevisions.values())
          .filter(r => (r.question_id || r.questionId) === question.id)
          .sort((a, b) => (a.milestone_day || a.milestoneDay) - (b.milestone_day || b.milestoneDay))
          .map(r => mapRevisionFromDb(r, question));
      } else {
        throw e;
      }
    }

    const qExtra = this._cachedQuestionsExtra.get(question.id) || {};
    return mapQuestionFromDb({ ...qExtra, ...question }, question.subjects?.name, milestones);
  }

  async checkDuplicateQuestion(platform, problemNumber, title) {
    if (title && title.trim()) {
      const { data: titleMatch } = await this.client
        .from('questions')
        .select('id, title, platform, problem_number')
        .ilike('title', title.trim())
        .maybeSingle();

      if (titleMatch) return titleMatch;
    }

    if (platform && problemNumber !== undefined && problemNumber !== null && String(problemNumber).trim()) {
      const parsedNum = parseProblemNumber(problemNumber);
      let queryBuilder = this.client
        .from('questions')
        .select('id, title, platform, problem_number')
        .ilike('platform', platform.trim());

      if (parsedNum !== null) {
        queryBuilder = queryBuilder.eq('problem_number', parsedNum);
      } else {
        queryBuilder = queryBuilder.eq('problem_number', String(problemNumber).trim());
      }

      const { data: numMatch } = await queryBuilder.maybeSingle();
      if (numMatch) return numMatch;
    }

    return null;
  }

  async createQuestion(data) {
    const existing = await this.checkDuplicateQuestion(data.platform, data.problemNumber, data.title);
    if (existing) {
      const err = new Error(
        `Duplicate question: A problem with title "${data.title}" or ${data.platform} #${data.problemNumber} already exists`
      );
      err.statusCode = 409;
      throw err;
    }

    let resolvedSubjectId = null;
    let resolvedSubjectName = null;
    if (data.subjectId) {
      if (isValidUuid(data.subjectId)) {
        resolvedSubjectId = data.subjectId;
        const sub = await this.getSubjectById(data.subjectId);
        if (sub) resolvedSubjectName = sub.name;
      } else {
        const sub = await this.getSubjectById(data.subjectId);
        if (sub) {
          resolvedSubjectId = sub.id;
          resolvedSubjectName = sub.name;
        }
      }
    } else if (data.subject) {
      const sub = await this.findSubjectByName(data.subject);
      if (sub) {
        resolvedSubjectId = sub.id;
        resolvedSubjectName = sub.name;
      }
    }

    const questionId = isValidUuid(data.id) ? data.id : generateUuid();
    const dateSolved = data.dateSolved || getTodayDateString();
    const nowIso = new Date().toISOString();

    const fullRow = {
      id: questionId,
      title: data.title.trim(),
      platform: data.platform.trim(),
      problem_number: parseProblemNumber(data.problemNumber),
      problem_url: data.problemUrl || '',
      subject_id: resolvedSubjectId,
      topic: data.topic || 'General',
      difficulty: data.difficulty || 'Medium',
      date_solved: dateSolved,
      statement: data.statement || data.description || data.summary || '',
      approach: data.approach || '',
      notes: data.notes || '',
      solution: data.solution || data.code || data.codeSolution || '',
      code_language: data.code_language || data.programmingLanguage || data.codeLanguage || 'javascript',
      time_complexity: data.timeComplexity || 'O(n)',
      space_complexity: data.spaceComplexity || 'O(1)',
      tags: Array.isArray(data.tags) ? data.tags : [],
      is_bookmarked: Boolean(data.bookmarked ?? data.isBookmarked ?? false),
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      created_at: nowIso,
      updated_at: nowIso
    };

    let createdRecord = null;
    const { data: created, error } = await this.client
      .from('questions')
      .insert(fullRow)
      .select('*, subjects(id, name)')
      .single();

    if (error) {
      if (isSchemaOrColumnError(error)) {
        console.warn('Database warning: questions table lacks extended columns (date_solved/approach/etc.). Inserting base columns.');
        const baseRow = {
          id: questionId,
          title: data.title.trim(),
          platform: data.platform.trim(),
          problem_number: parseProblemNumber(data.problemNumber),
          problem_url: data.problemUrl || '',
          subject_id: resolvedSubjectId,
          topic: data.topic || 'General',
          difficulty: data.difficulty || 'Medium',
          statement: data.statement || data.description || data.summary || '',
          solution: data.solution || data.code || data.codeSolution || '',
          notes: data.notes || '',
          is_bookmarked: Boolean(data.bookmarked ?? data.isBookmarked ?? false),
          created_at: nowIso,
          updated_at: nowIso
        };
        const { data: baseCreated, error: baseErr } = await this.client
          .from('questions')
          .insert(baseRow)
          .select('*, subjects(id, name)')
          .single();

        if (baseErr) throw new Error(`Failed to insert question: ${baseErr.message}`);
        createdRecord = baseCreated;
      } else {
        throw new Error(`Failed to insert question: ${error.message}`);
      }
    } else {
      createdRecord = created;
    }

    // Cache extra properties for this question
    this._cachedQuestionsExtra.set(questionId, {
      date_solved: dateSolved,
      approach: data.approach || '',
      code_language: data.code_language || data.programmingLanguage || data.codeLanguage || 'javascript',
      time_complexity: data.timeComplexity || 'O(n)',
      space_complexity: data.spaceComplexity || 'O(1)',
      tags: Array.isArray(data.tags) ? data.tags : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    });

    const cached = this._cachedQuestionsExtra.get(questionId) || {};
    return mapQuestionFromDb({ ...cached, ...createdRecord }, resolvedSubjectName);
  }

  async updateQuestion(id, data) {
    const existing = await this.getQuestionById(id);
    if (!existing) {
      const err = new Error(`Question not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.platform !== undefined) updates.platform = data.platform.trim();
    if (data.problemNumber !== undefined) updates.problem_number = parseProblemNumber(data.problemNumber);
    if (data.problemUrl !== undefined) updates.problem_url = data.problemUrl || '';
    if (data.topic !== undefined) updates.topic = data.topic;
    if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
    if (data.dateSolved !== undefined) updates.date_solved = data.dateSolved;
    if (data.approach !== undefined) updates.approach = data.approach;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.timeComplexity !== undefined) updates.time_complexity = data.timeComplexity;
    if (data.spaceComplexity !== undefined) updates.space_complexity = data.spaceComplexity;
    if (data.tags !== undefined) updates.tags = Array.isArray(data.tags) ? data.tags : [];
    if (data.attachments !== undefined) updates.attachments = Array.isArray(data.attachments) ? data.attachments : [];

    const statementVal = data.statement ?? data.description ?? data.summary;
    if (statementVal !== undefined) updates.statement = statementVal;

    const solutionVal = data.solution ?? data.code ?? data.codeSolution;
    if (solutionVal !== undefined) updates.solution = solutionVal;

    const langVal = data.code_language ?? data.programmingLanguage ?? data.codeLanguage;
    if (langVal !== undefined) updates.code_language = langVal;

    const bookmarkVal = data.is_bookmarked ?? data.bookmarked ?? data.isBookmarked;
    if (bookmarkVal !== undefined) updates.is_bookmarked = Boolean(bookmarkVal);

    if (data.subjectId !== undefined) {
      if (isValidUuid(data.subjectId)) {
        updates.subject_id = data.subjectId;
      } else {
        const sub = await this.getSubjectById(data.subjectId);
        updates.subject_id = sub ? sub.id : null;
      }
    } else if (data.subject !== undefined) {
      const sub = await this.findSubjectByName(data.subject);
      if (sub) updates.subject_id = sub.id;
    }

    let updatedRecord = null;
    const { data: updated, error } = await this.client
      .from('questions')
      .update(updates)
      .eq('id', existing.id)
      .select('*, subjects(id, name)')
      .single();

    if (error) {
      if (isSchemaOrColumnError(error)) {
        console.warn('Database warning: questions table lacks extended columns for update. Updating supported columns.');
        const baseUpdates = {
          updated_at: updates.updated_at
        };
        if (updates.title !== undefined) baseUpdates.title = updates.title;
        if (updates.platform !== undefined) baseUpdates.platform = updates.platform;
        if (updates.problem_number !== undefined) baseUpdates.problem_number = updates.problem_number;
        if (updates.problem_url !== undefined) baseUpdates.problem_url = updates.problem_url;
        if (updates.topic !== undefined) baseUpdates.topic = updates.topic;
        if (updates.difficulty !== undefined) baseUpdates.difficulty = updates.difficulty;
        if (updates.statement !== undefined) baseUpdates.statement = updates.statement;
        if (updates.solution !== undefined) baseUpdates.solution = updates.solution;
        if (updates.notes !== undefined) baseUpdates.notes = updates.notes;
        if (updates.is_bookmarked !== undefined) baseUpdates.is_bookmarked = updates.is_bookmarked;
        if (updates.subject_id !== undefined) baseUpdates.subject_id = updates.subject_id;

        const { data: baseUpdated, error: baseErr } = await this.client
          .from('questions')
          .update(baseUpdates)
          .eq('id', existing.id)
          .select('*, subjects(id, name)')
          .single();

        if (baseErr) throw new Error(`Failed to update question: ${baseErr.message}`);
        updatedRecord = baseUpdated;
      } else {
        throw new Error(`Failed to update question: ${error.message}`);
      }
    } else {
      updatedRecord = updated;
    }

    const currentCached = this._cachedQuestionsExtra.get(existing.id) || {};
    this._cachedQuestionsExtra.set(existing.id, {
      ...currentCached,
      ...(data.dateSolved !== undefined ? { date_solved: data.dateSolved } : {}),
      ...(data.approach !== undefined ? { approach: data.approach } : {}),
      ...(langVal !== undefined ? { code_language: langVal } : {}),
      ...(data.timeComplexity !== undefined ? { time_complexity: data.timeComplexity } : {}),
      ...(data.spaceComplexity !== undefined ? { space_complexity: data.spaceComplexity } : {}),
      ...(data.tags !== undefined ? { tags: Array.isArray(data.tags) ? data.tags : [] } : {}),
      ...(data.attachments !== undefined ? { attachments: Array.isArray(data.attachments) ? data.attachments : [] } : {})
    });

    const cached = this._cachedQuestionsExtra.get(existing.id) || {};
    return mapQuestionFromDb({ ...cached, ...existing, ...updatedRecord });
  }

  async toggleBookmark(id) {
    const existing = await this.getQuestionById(id);
    if (!existing) {
      const err = new Error(`Question not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const nextState = !existing.bookmarked;
    const { error } = await this.client
      .from('questions')
      .update({ is_bookmarked: nextState, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) throw new Error(`Failed to toggle bookmark: ${error.message}`);
    return { id: existing.id, bookmarked: nextState };
  }

  async deleteQuestion(id) {
    const existing = await this.getQuestionById(id);
    if (!existing) {
      const err = new Error(`Question not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    // Safely delete associated records if tables exist
    await Promise.allSettled([
      this.client.from('revisions').delete().eq('question_id', existing.id),
      this.client.from('revision_sessions').delete().eq('question_id', existing.id),
      this.client.from('notifications').delete().eq('question_id', existing.id)
    ]);

    // Clean up in-memory stores
    for (const [revId, rev] of this._inMemoryRevisions.entries()) {
      if ((rev.question_id || rev.questionId) === existing.id) {
        this._inMemoryRevisions.delete(revId);
      }
    }
    this._inMemorySessions = this._inMemorySessions.filter(s => (s.question_id || s.questionId) !== existing.id);
    this._inMemoryNotifications = this._inMemoryNotifications.filter(n => (n.question_id || n.questionId) !== existing.id);
    this._cachedQuestionsExtra.delete(existing.id);

    const { error } = await this.client
      .from('questions')
      .delete()
      .eq('id', existing.id);

    if (error) throw new Error(`Failed to delete question: ${error.message}`);
    return existing;
  }

  // ==========================================
  // REVISIONS & MILESTONES
  // ==========================================

  async getAllRevisions({ status, questionId } = {}) {
    let list = [];

    if (this._isTableMissing('revisions')) {
      list = Array.from(this._inMemoryRevisions.values());
      if (questionId) {
        list = list.filter(r => (r.question_id || r.questionId) === questionId);
      }
    } else {
      try {
        let query = this.client
          .from('revisions')
          .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))');

        if (questionId) {
          query = query.eq('question_id', questionId);
        }

        query = query.order('due_date', { ascending: true });

        const { data, error } = await query;
        if (error) {
          if (isSchemaOrColumnError(error)) {
            this._markTableMissing('revisions');
            console.warn('Database warning: revisions table not in schema cache. Using in-memory store.');
            list = Array.from(this._inMemoryRevisions.values());
            if (questionId) {
              list = list.filter(r => (r.question_id || r.questionId) === questionId);
            }
          } else {
            throw new Error(`Failed to fetch revisions: ${error.message}`);
          }
        } else {
          list = (data || []).map(r => mapRevisionFromDb(r));
        }
      } catch (err) {
        if (isSchemaOrColumnError(err)) {
          this._markTableMissing('revisions');
          list = Array.from(this._inMemoryRevisions.values());
          if (questionId) {
            list = list.filter(r => (r.question_id || r.questionId) === questionId);
          }
        } else {
          throw err;
        }
      }
    }

    if (status) {
      list = list.filter(r => r.status === status);
    }

    return list;
  }

  async getRevisionById(id) {
    if (!id) return null;

    try {
      const { data, error } = await this.client
        .from('revisions')
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (error.code === '22P02') return null;
        if (isSchemaOrColumnError(error)) {
          const inMem = this._inMemoryRevisions.get(id);
          return inMem ? mapRevisionFromDb(inMem) : null;
        }
        throw new Error(`Failed to fetch revision "${id}": ${error.message}`);
      }
      if (!data) {
        const inMem = this._inMemoryRevisions.get(id);
        return inMem ? mapRevisionFromDb(inMem) : null;
      }

      return mapRevisionFromDb(data);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        const inMem = this._inMemoryRevisions.get(id);
        return inMem ? mapRevisionFromDb(inMem) : null;
      }
      throw err;
    }
  }

  async createMilestones(milestones) {
    if (!Array.isArray(milestones) || milestones.length === 0) return [];

    const rows = milestones.map(m => ({
      id: isValidUuid(m.id) ? m.id : generateUuid(),
      question_id: m.questionId,
      milestone_day: m.milestoneDay,
      due_date: m.dueDate,
      completed_at: m.completedAt || null,
      recall_rating: m.recallRating || null,
      notes: m.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    try {
      const { data, error } = await this.client
        .from('revisions')
        .insert(rows)
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))');

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('revisions', error);
          console.warn('Database warning: revisions table not in schema cache. Storing milestones in memory.');
          rows.forEach(r => this._inMemoryRevisions.set(r.id, r));
          return rows.map(r => mapRevisionFromDb(r));
        }
        throw new Error(`Failed to schedule revision milestones: ${error.message}`);
      }
      return (data || []).map(r => mapRevisionFromDb(r));
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('revisions', err);
        console.warn('Database warning: revisions table not available. Storing milestones in memory.');
        rows.forEach(r => this._inMemoryRevisions.set(r.id, r));
        return rows.map(r => mapRevisionFromDb(r));
      }
      throw err;
    }
  }

  async completeRevision(id, { recallRating = 'easy', notes = '' } = {}) {
    const revision = await this.getRevisionById(id);
    if (!revision) {
      const err = new Error(`Revision record not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    if (revision.completedAt) {
      const err = new Error(`Revision milestone with ID "${id}" is already completed`);
      err.statusCode = 400;
      throw err;
    }

    const today = getTodayDateString();
    const timestamp = new Date().toISOString();

    let updatedRow = null;
    try {
      const { data: updated, error } = await this.client
        .from('revisions')
        .update({
          completed_at: today,
          recall_rating: recallRating,
          notes: notes || revision.notes,
          updated_at: timestamp
        })
        .eq('id', revision.id)
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))')
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('revisions', error);
          console.warn('Database warning: revisions table not in schema cache. Updating milestone in memory.');
          const inMem = this._inMemoryRevisions.get(revision.id) || revision;
          const updatedInMem = {
            ...inMem,
            completed_at: today,
            completedAt: today,
            recall_rating: recallRating,
            recallRating,
            notes: notes || revision.notes,
            updated_at: timestamp
          };
          this._inMemoryRevisions.set(revision.id, updatedInMem);
          updatedRow = updatedInMem;
        } else {
          throw new Error(`Failed to complete revision milestone: ${error.message}`);
        }
      } else {
        updatedRow = updated;
      }
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('revisions', err);
        const inMem = this._inMemoryRevisions.get(revision.id) || revision;
        const updatedInMem = {
          ...inMem,
          completed_at: today,
          completedAt: today,
          recall_rating: recallRating,
          recallRating,
          notes: notes || revision.notes,
          updated_at: timestamp
        };
        this._inMemoryRevisions.set(revision.id, updatedInMem);
        updatedRow = updatedInMem;
      } else {
        throw err;
      }
    }

    try {
      await this.recordSession({
        revisionId: revision.id,
        questionId: revision.questionId,
        milestoneDay: revision.milestoneDay,
        recallRating,
        notes,
        timestamp
      });
    } catch (sessErr) {
      console.warn('Database warning: Failed to record revision session:', sessErr.message);
    }

    try {
      await this.createNotification({
        type: 'revision_completed',
        category: 'Revisions',
        title: `Revision Completed: ${revision.questionTitle || 'Question'}`,
        message: `Completed Day ${revision.milestoneDay} revision with recall rated "${recallRating.toUpperCase()}".`,
        questionId: revision.questionId
      });
    } catch (notifErr) {
      console.warn('Database warning: Failed to create revision completion notification:', notifErr.message);
    }

    return mapRevisionFromDb(updatedRow);
  }

  async rescheduleRevision(id, newDueDate) {
    const revision = await this.getRevisionById(id);
    if (!revision) {
      const err = new Error(`Revision record not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    try {
      const { data: updated, error } = await this.client
        .from('revisions')
        .update({
          due_date: newDueDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', revision.id)
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))')
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('revisions', error);
          const inMem = this._inMemoryRevisions.get(revision.id) || revision;
          const updatedInMem = { ...inMem, due_date: newDueDate, dueDate: newDueDate, updated_at: new Date().toISOString() };
          this._inMemoryRevisions.set(revision.id, updatedInMem);
          return mapRevisionFromDb(updatedInMem);
        }
        throw new Error(`Failed to reschedule revision: ${error.message}`);
      }
      return mapRevisionFromDb(updated);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('revisions', err);
        const inMem = this._inMemoryRevisions.get(revision.id) || revision;
        const updatedInMem = { ...inMem, due_date: newDueDate, dueDate: newDueDate, updated_at: new Date().toISOString() };
        this._inMemoryRevisions.set(revision.id, updatedInMem);
        return mapRevisionFromDb(updatedInMem);
      }
      throw err;
    }
  }

  async skipRevision(id, { reason = '' } = {}) {
    const revision = await this.getRevisionById(id);
    if (!revision) {
      const err = new Error(`Revision record not found with ID: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const noteText = reason ? `Skipped: ${reason}` : 'Skipped revision';
    try {
      const { data: updated, error } = await this.client
        .from('revisions')
        .update({
          notes: noteText,
          updated_at: new Date().toISOString()
        })
        .eq('id', revision.id)
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))')
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          const inMem = this._inMemoryRevisions.get(revision.id) || revision;
          const updatedInMem = { ...inMem, notes: noteText, updated_at: new Date().toISOString() };
          this._inMemoryRevisions.set(revision.id, updatedInMem);
          return mapRevisionFromDb(updatedInMem);
        }
        throw new Error(`Failed to skip revision: ${error.message}`);
      }
      return mapRevisionFromDb(updated);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        const inMem = this._inMemoryRevisions.get(revision.id) || revision;
        const updatedInMem = { ...inMem, notes: noteText, updated_at: new Date().toISOString() };
        this._inMemoryRevisions.set(revision.id, updatedInMem);
        return mapRevisionFromDb(updatedInMem);
      }
      throw err;
    }
  }

  async createCustomRevision({ questionId, milestoneDay, dueDate, notes = '' }) {
    const question = await this.getQuestionById(questionId);
    if (!question) {
      const err = new Error(`Question not found with ID: ${questionId}`);
      err.statusCode = 404;
      throw err;
    }

    const row = {
      id: generateUuid(),
      question_id: question.id,
      milestone_day: milestoneDay,
      due_date: dueDate,
      completed_at: null,
      recall_rating: null,
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data: existingDup } = await this.client
        .from('revisions')
        .select('id')
        .eq('question_id', question.id)
        .eq('due_date', dueDate)
        .maybeSingle();

      if (existingDup) {
        const err = new Error(`A revision milestone already exists for this question on ${dueDate}`);
        err.statusCode = 409;
        throw err;
      }

      const { data: created, error } = await this.client
        .from('revisions')
        .insert(row)
        .select('*, questions(id, title, platform, problem_number, difficulty, subject_id, subjects(name))')
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          this._inMemoryRevisions.set(row.id, row);
          return mapRevisionFromDb(row, question);
        }
        throw new Error(`Failed to create custom milestone: ${error.message}`);
      }
      return mapRevisionFromDb(created);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        this._inMemoryRevisions.set(row.id, row);
        return mapRevisionFromDb(row, question);
      }
      throw err;
    }
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  async recordSession({ revisionId = null, questionId, milestoneDay, recallRating, notes = '', timestamp = null }) {
    const row = {
      id: generateUuid(),
      revision_id: revisionId && isValidUuid(revisionId) ? revisionId : null,
      question_id: questionId,
      milestone_day: milestoneDay,
      recall_rating: recallRating,
      notes: notes || '',
      timestamp: timestamp || new Date().toISOString()
    };

    this._inMemorySessions.unshift(row);
    if (this._inMemorySessions.length > 100) this._inMemorySessions.pop();

    try {
      const { data, error } = await this.client
        .from('revision_sessions')
        .insert(row)
        .select('*, questions(title)')
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('revision_sessions', error);
          return mapSessionFromDb(row);
        }
        throw new Error(`Failed to record revision session: ${error.message}`);
      }
      return mapSessionFromDb(data);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('revision_sessions', err);
        return mapSessionFromDb(row);
      }
      throw err;
    }
  }

  async getRecentSessions(limit = 10) {
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    if (this._isTableMissing('revision_sessions')) {
      return this._inMemorySessions.slice(0, limitNum).map(s => mapSessionFromDb(s));
    }
    try {
      const { data, error } = await this.client
        .from('revision_sessions')
        .select('*, questions(title)')
        .order('timestamp', { ascending: false })
        .limit(limitNum);

      if (error) {
        if (isSchemaOrColumnError(error)) {
          this._markTableMissing('revision_sessions');
          return this._inMemorySessions.slice(0, limitNum).map(s => mapSessionFromDb(s));
        }
        throw new Error(`Failed to retrieve revision sessions: ${error.message}`);
      }
      return (data || []).map(s => mapSessionFromDb(s));
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        this._markTableMissing('revision_sessions');
        return this._inMemorySessions.slice(0, limitNum).map(s => mapSessionFromDb(s));
      }
      throw err;
    }
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async getAllNotifications() {
    if (this._isTableMissing('notifications')) {
      return this._inMemoryNotifications.map(mapNotificationFromDb);
    }
    try {
      const { data, error } = await this.client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaOrColumnError(error)) {
          this._markTableMissing('notifications');
          return this._inMemoryNotifications.map(mapNotificationFromDb);
        }
        throw new Error(`Failed to list notifications: ${error.message}`);
      }
      return (data || []).map(mapNotificationFromDb);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        this._markTableMissing('notifications');
        return this._inMemoryNotifications.map(mapNotificationFromDb);
      }
      throw err;
    }
  }

  async createNotification({ type, category = 'Revisions', title, message, questionId = null }) {
    const row = {
      id: generateUuid(),
      type,
      category,
      title,
      message,
      question_id: questionId,
      is_read: false,
      created_at: new Date().toISOString()
    };

    this._inMemoryNotifications.unshift(row);
    if (this._inMemoryNotifications.length > 50) this._inMemoryNotifications.pop();

    try {
      const { data, error } = await this.client
        .from('notifications')
        .insert(row)
        .select()
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('notifications', error);
          return mapNotificationFromDb(row);
        }
        throw new Error(`Failed to insert notification: ${error.message}`);
      }
      return mapNotificationFromDb(data);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('notifications', err);
        return mapNotificationFromDb(row);
      }
      throw err;
    }
  }

  async markNotificationAsRead(id) {
    if (!id) {
      const err = new Error(`Notification with ID "${id}" not found`);
      err.statusCode = 404;
      throw err;
    }

    try {
      const { data, error } = await this.client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '22P02') {
          const err = new Error(`Notification with ID "${id}" not found`);
          err.statusCode = 404;
          throw err;
        }
        if (isSchemaOrColumnError(error)) {
          const inMem = this._inMemoryNotifications.find(n => n.id === id);
          if (!inMem) {
            const err = new Error(`Notification with ID "${id}" not found`);
            err.statusCode = 404;
            throw err;
          }
          inMem.is_read = true;
          return mapNotificationFromDb(inMem);
        }
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }
      if (!data) {
        const inMem = this._inMemoryNotifications.find(n => n.id === id);
        if (!inMem) {
          const err = new Error(`Notification with ID "${id}" not found`);
          err.statusCode = 404;
          throw err;
        }
        inMem.is_read = true;
        return mapNotificationFromDb(inMem);
      }

      return mapNotificationFromDb(data);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        const inMem = this._inMemoryNotifications.find(n => n.id === id);
        if (!inMem) {
          const err = new Error(`Notification with ID "${id}" not found`);
          err.statusCode = 404;
          throw err;
        }
        inMem.is_read = true;
        return mapNotificationFromDb(inMem);
      }
      throw err;
    }
  }

  // ==========================================
  // SETTINGS
  // ==========================================

  async getSettings() {
    if (this._isTableMissing('user_settings')) {
      return this._inMemorySettings || mapSettingsFromDb(null);
    }
    try {
      const { data, error } = await this.client
        .from('user_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          this._markTableMissing('user_settings');
          return this._inMemorySettings || mapSettingsFromDb(null);
        }
        throw new Error(`Failed to retrieve settings: ${error.message}`);
      }
      return mapSettingsFromDb(data || this._inMemorySettings);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        this._markTableMissing('user_settings');
        return this._inMemorySettings || mapSettingsFromDb(null);
      }
      throw err;
    }
  }

  async updateSettings(updates = {}) {
    const payload = {
      id: 'default',
      updated_at: new Date().toISOString()
    };

    if (updates.theme !== undefined) payload.theme = updates.theme;
    if (updates.timeZone !== undefined) payload.time_zone = updates.timeZone;
    if (updates.reminderTime !== undefined) payload.reminder_time = updates.reminderTime;
    if (updates.studyGoalQuestions !== undefined) payload.study_goal_questions = updates.studyGoalQuestions;
    if (updates.customIntervalsEnabled !== undefined) payload.custom_intervals_enabled = updates.customIntervalsEnabled;
    if (updates.customIntervalDays !== undefined) payload.custom_interval_days = updates.customIntervalDays;
    if (updates.inAppNotifications !== undefined) payload.in_app_notifications = updates.inAppNotifications;
    if (updates.emailNotifications !== undefined) payload.email_notifications = updates.emailNotifications;
    const waVal = updates.whatsAppNotifications ?? updates.whatsappNotifications ?? updates.whatsapp_notifications;
    if (waVal !== undefined) payload.whatsapp_notifications = waVal;
    if (updates.quietHoursStart !== undefined) payload.quiet_hours_start = updates.quietHoursStart;
    if (updates.quietHoursEnd !== undefined) payload.quiet_hours_end = updates.quietHoursEnd;
    if (updates.aiDemoMode !== undefined) payload.ai_demo_mode = updates.aiDemoMode;

    const currentSettings = this._inMemorySettings || mapSettingsFromDb(null);
    this._inMemorySettings = {
      ...currentSettings,
      ...updates
    };

    try {
      const { data, error } = await this.client
        .from('user_settings')
        .upsert(payload)
        .select()
        .single();

      if (error) {
        if (isSchemaOrColumnError(error)) {
          assertProductionSchema('user_settings', error);
          return this._inMemorySettings;
        }
        throw new Error(`Failed to update settings: ${error.message}`);
      }
      return mapSettingsFromDb(data);
    } catch (err) {
      if (isSchemaOrColumnError(err)) {
        assertProductionSchema('user_settings', err);
        return this._inMemorySettings;
      }
      throw err;
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  async getStats() {
    const fetchQuestions = this.client
      .from('questions')
      .select('id', { count: 'exact', head: true });

    const fetchRevisions = this._isTableMissing('revisions')
      ? Promise.resolve({ data: Array.from(this._inMemoryRevisions.values()), error: null })
      : this.client.from('revisions').select('id, due_date, completed_at');

    const [qResult, revResult] = await Promise.allSettled([
      Promise.resolve(fetchQuestions),
      Promise.resolve(fetchRevisions)
    ]);

    let totalQuestions = 0;
    if (qResult.status === 'fulfilled') {
      const { count, error: qErr } = qResult.value;
      if (qErr) {
        console.warn('Database warning: Unable to count questions:', qErr.message);
      } else {
        totalQuestions = count ?? 0;
      }
    } else {
      console.warn('Database warning: Could not query questions count:', qResult.reason?.message);
    }

    let revList = [];
    if (revResult.status === 'fulfilled') {
      const { data: revisions, error: revErr } = revResult.value;
      if (revErr) {
        if (isSchemaOrColumnError(revErr)) {
          this._markTableMissing('revisions');
          console.warn('Database warning: revisions table not in schema cache. Using in-memory store for stats.');
          revList = Array.from(this._inMemoryRevisions.values());
        } else {
          console.warn('Database warning: Failed to count revisions:', revErr.message);
        }
      } else {
        revList = revisions || [];
      }
    } else {
      console.warn('Database warning: Could not query revisions table for stats:', revResult.reason?.message);
      revList = Array.from(this._inMemoryRevisions.values());
    }

    let dueToday = 0;
    let overdue = 0;
    let completed = 0;

    revList.forEach(m => {
      const status = computeRevisionStatus(m.due_date || m.dueDate, m.completed_at || m.completedAt);
      if (status === 'due') dueToday += 1;
      else if (status === 'overdue') overdue += 1;
      else if (status === 'completed') completed += 1;
    });

    const totalEligible = dueToday + overdue + completed;
    const completionRate = totalEligible > 0 ? Math.round((completed / totalEligible) * 100) : 100;

    return {
      totalQuestions: totalQuestions ?? 0,
      dueToday,
      overdue,
      completed,
      completionRate
    };
  }

  async getSubjectProgress() {
    const fetchSubjects = this.client
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });

    const fetchQuestions = this.client
      .from('questions')
      .select('id, subject_id');

    const [subResult, qResult] = await Promise.allSettled([
      Promise.resolve(fetchSubjects),
      Promise.resolve(fetchQuestions)
    ]);

    let subjects = [];
    if (subResult.status === 'fulfilled') {
      const { data, error: subErr } = subResult.value;
      if (subErr) {
        console.warn('Database warning: Failed to fetch subjects for progress:', subErr.message);
      } else {
        subjects = data || [];
      }
    } else {
      console.warn('Database warning: Could not query subjects for progress:', subResult.reason?.message);
    }

    let questions = [];
    if (qResult.status === 'fulfilled') {
      const { data, error: qErr } = qResult.value;
      if (qErr) {
        console.warn('Database warning: Failed to fetch questions for progress:', qErr.message);
      } else {
        questions = data || [];
      }
    } else {
      console.warn('Database warning: Could not query questions for progress:', qResult.reason?.message);
    }

    const subList = subjects;
    const qList = questions;
    const totalQuestions = qList.length;

    return subList.map(s => {
      const cached = this._cachedSubjectsExtra.get(s.id) || {};
      const count = qList.filter(q => q.subject_id === s.id).length;
      const percentage = totalQuestions > 0 ? Math.round((count / totalQuestions) * 100) : 0;
      return {
        id: s.id,
        name: s.name,
        color: s.color || cached.color || '#7c3aed',
        icon: s.icon || cached.icon || 'folder',
        questionCount: count,
        percentage
      };
    });
  }

  // ==========================================
  // WHATSAPP DELIVERY LOGS & DUPLICATE TRACKING
  // ==========================================

  async recordWhatsAppLog({
    revisionId = null,
    questionId = null,
    recipientPhone,
    reminderWindow = 'scheduled',
    reminderDate,
    messageType = 'text',
    messageBody = '',
    status,
    whatsappMessageId = null,
    errorMessage = null,
    metadata = {}
  }) {
    const row = {
      id: generateUuid(),
      revision_id: revisionId || null,
      question_id: questionId || null,
      recipient_phone: recipientPhone || '',
      reminder_window: reminderWindow,
      reminder_date: reminderDate || getTodayDateString(),
      message_type: messageType,
      message_body: messageBody,
      status: status,
      whatsapp_message_id: whatsappMessageId,
      error_message: errorMessage,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };

    // Keep an in-memory buffer for resilience
    this._inMemoryWhatsAppLogs.unshift(row);
    if (this._inMemoryWhatsAppLogs.length > 200) {
      this._inMemoryWhatsAppLogs.pop();
    }

    try {
      // If connected to real Postgres and ID is not a UUID, protect against 22P02
      const dbPayload = {
        ...row,
        revision_id: revisionId && (isValidUuid(revisionId) || this.client._db) ? revisionId : null,
        question_id: questionId && (isValidUuid(questionId) || this.client._db) ? questionId : null
      };

      const { data, error } = await this.client
        .from('whatsapp_logs')
        .insert(dbPayload)
        .select()
        .maybeSingle();

      if (error) {
        return row;
      }
      return data || row;
    } catch {
      return row;
    }
  }

  async hasSentWhatsAppReminder({ revisionId, reminderWindow, reminderDate }) {
    if (!revisionId) return false;
    const targetDate = reminderDate || getTodayDateString();

    // 1. Check in-memory logs
    const inMemMatch = this._inMemoryWhatsAppLogs.some(l => 
      l.revision_id === revisionId &&
      l.reminder_window === reminderWindow &&
      l.reminder_date === targetDate &&
      (l.status === 'sent' || l.status === 'simulated_test_mode')
    );
    if (inMemMatch) return true;

    // 2. Check persistent database
    try {
      const { data, error } = await this.client
        .from('whatsapp_logs')
        .select('id, status')
        .eq('revision_id', revisionId)
        .eq('reminder_window', reminderWindow)
        .eq('reminder_date', targetDate)
        .in('status', ['sent', 'simulated_test_mode'])
        .limit(1);

      if (error || !data) return false;
      return data.length > 0;
    } catch {
      return false;
    }
  }

  async getWhatsAppLogs(limit = 50) {
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    try {
      const { data, error } = await this.client
        .from('whatsapp_logs')
        .select('*, questions(title, platform, problem_number), revisions(milestone_day, due_date)')
        .order('created_at', { ascending: false })
        .limit(limitNum);

      if (error || !data || data.length === 0) {
        return this._inMemoryWhatsAppLogs.slice(0, limitNum);
      }
      return data;
    } catch {
      return this._inMemoryWhatsAppLogs.slice(0, limitNum);
    }
  }
}

// Singleton repository instance for application runtime
export const supabaseRepository = new SupabaseRepository();
