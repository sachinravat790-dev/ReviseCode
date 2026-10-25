/**
 * In-Memory Supabase Mock Client (tests/mocks/supabase.mock.js)
 * High-fidelity query builder mock for isolated testing of the Supabase repository and Express endpoints.
 */

import { addDays, getTodayDateString, computeRevisionStatus } from '../../src/utils/dates.js';

export function createMockSupabaseClient() {
  const today = getTodayDateString();
  const dMinus2 = addDays(today, -2);
  const dMinus3 = addDays(today, -3);
  const dMinus7 = addDays(today, -7);
  const dMinus14 = addDays(today, -14);
  const dMinus25 = addDays(today, -25);

  // In-memory relational tables
  const db = {
    subjects: [
      { id: 'sub_dsa', name: 'DSA', description: 'Data Structures and Algorithms', color: '#7c3aed', icon: 'binary', topics: ['Arrays', 'Two Pointers', 'Binary Search', 'Sliding Window', 'Dynamic Programming', 'Trees', 'Graphs'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` },
      { id: 'sub_sql', name: 'SQL', description: 'Database Queries and Optimization', color: '#3b82f6', icon: 'database', topics: ['Joins', 'Window Functions', 'Aggregations', 'Subqueries', 'Indexing'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` },
      { id: 'sub_web', name: 'Web Development', description: 'Modern Web, DOM & Architecture', color: '#10b981', icon: 'globe', topics: ['JavaScript ES6', 'DOM API', 'CSS Grid', 'Event Loop', 'Async/Await'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` },
      { id: 'sub_apt', name: 'Aptitude', description: 'Quantitative and Logical Reasoning', color: '#f59e0b', icon: 'calculator', topics: ['Time & Work', 'Permutations', 'Percentages', 'Ratios'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` },
      { id: 'sub_math', name: 'Mathematics', description: 'Discrete Math & Number Theory', color: '#ec4899', icon: 'sigma', topics: ['Number Theory', 'Probability', 'Combinatorics'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` },
      { id: 'sub_other', name: 'Other', description: 'System Design and General Concepts', color: '#64748b', icon: 'folder', topics: ['System Design', 'General'], created_at: `${dMinus25}T00:00:00Z`, updated_at: `${dMinus25}T00:00:00Z` }
    ],
    questions: [
      {
        id: 'q_lc_50',
        title: 'Pow(x, n)',
        platform: 'LeetCode',
        problem_number: '50',
        problem_url: 'https://leetcode.com/problems/powx-n/',
        subject_id: 'sub_dsa',
        topic: 'Binary Search',
        difficulty: 'Medium',
        date_solved: dMinus3,
        statement: 'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).',
        approach: 'Binary exponentiation / Divide and Conquer.',
        notes: 'Handle negative power and INT_MIN overflow in typed languages.',
        solution: 'function myPow(x, n) {\n  if (n === 0) return 1;\n  let power = n;\n  return Math.pow(x, n);\n}',
        code_language: 'javascript',
        time_complexity: 'O(log n)',
        space_complexity: 'O(1)',
        tags: ['Recursion', 'Math', 'Divide and Conquer'],
        is_bookmarked: true,
        attachments: [],
        created_at: `${dMinus3}T10:00:00Z`,
        updated_at: `${dMinus3}T10:00:00Z`
      },
      {
        id: 'q_lc_53',
        title: 'Maximum Subarray',
        platform: 'LeetCode',
        problem_number: '53',
        problem_url: 'https://leetcode.com/problems/maximum-subarray/',
        subject_id: 'sub_dsa',
        topic: 'Dynamic Programming',
        difficulty: 'Medium',
        date_solved: dMinus7,
        statement: 'Find subarray with the largest sum and return its sum.',
        approach: 'Kadane algorithm. Keep a running sum. Reset to 0 when negative.',
        notes: 'Edge case: all negative values return the single maximum element.',
        solution: 'def maxSubArray(nums):\n    max_sum = float("-inf")\n    return max_sum',
        code_language: 'python',
        time_complexity: 'O(n)',
        space_complexity: 'O(1)',
        tags: ['Arrays', 'DP', 'Kadane Algorithm'],
        is_bookmarked: false,
        attachments: [],
        created_at: `${dMinus7}T10:00:00Z`,
        updated_at: `${dMinus7}T10:00:00Z`
      },
      {
        id: 'q_lc_121',
        title: 'Best Time to Buy and Sell Stock',
        platform: 'LeetCode',
        problem_number: '121',
        problem_url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
        subject_id: 'sub_dsa',
        topic: 'Arrays',
        difficulty: 'Easy',
        date_solved: dMinus14,
        statement: 'Find maximum profit achievable from one buy and one sell in future.',
        approach: 'Single-pass greedy tracking lowest buy price seen so far.',
        notes: 'Greedy approach works without full dynamic programming table.',
        solution: 'function maxProfit(prices) {\n  let min = Infinity, maxP = 0;\n  return maxP;\n}',
        code_language: 'javascript',
        time_complexity: 'O(n)',
        space_complexity: 'O(1)',
        tags: ['Two Pointers', 'Greedy'],
        is_bookmarked: true,
        attachments: [],
        created_at: `${dMinus14}T10:00:00Z`,
        updated_at: `${dMinus14}T10:00:00Z`
      }
    ],
    revisions: [],
    revision_sessions: [],
    notifications: [
      {
        id: 'notif_1',
        type: 'revision_due',
        category: 'Revisions',
        title: 'Revision Due Today: LeetCode 50',
        message: 'Milestone Day 3 for Pow(x, n) is due for active recall.',
        question_id: 'q_lc_50',
        is_read: false,
        created_at: `${today}T08:00:00Z`
      },
      {
        id: 'notif_2',
        type: 'overdue',
        category: 'Overdue',
        title: 'Overdue Revision: Maximum Subarray',
        message: 'Milestone Day 7 for Maximum Subarray is overdue.',
        question_id: 'q_lc_53',
        is_read: false,
        created_at: `${dMinus2}T09:00:00Z`
      }
    ],
    user_settings: [
      {
        id: 'default',
        theme: 'dark',
        time_zone: 'Asia/Kolkata (UTC+05:30)',
        reminder_time: '09:00',
        study_goal_questions: 3,
        custom_intervals_enabled: false,
        custom_interval_days: [45, 60],
        in_app_notifications: true,
        email_notifications: true,
        whatsapp_notifications: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        ai_demo_mode: true,
        updated_at: `${today}T00:00:00Z`
      }
    ],
    whatsapp_logs: []
  };

  // Seed revisions for the 3 questions
  const intervals = [3, 7, 12, 20, 30];
  let revIdCounter = 100;
  db.questions.forEach(q => {
    intervals.forEach((dayOffset, idx) => {
      const dueDate = addDays(q.date_solved, dayOffset);
      let completedAt = null;
      let recallRating = null;

      if (q.id === 'q_lc_50' && dayOffset === 3) {
        completedAt = null; // due today
      } else if (idx === 0) {
        completedAt = dueDate;
        recallRating = 'easy';
        db.revision_sessions.push({
          id: `sess_${revIdCounter}`,
          revision_id: `ms_${revIdCounter}`,
          question_id: q.id,
          milestone_day: dayOffset,
          recall_rating: 'easy',
          notes: 'Strong initial retention.',
          timestamp: `${dueDate}T14:00:00Z`
        });
      }

      revIdCounter += 1;
      db.revisions.push({
        id: `ms_${revIdCounter}`,
        question_id: q.id,
        milestone_day: dayOffset,
        due_date: dueDate,
        completed_at: completedAt,
        recall_rating: recallRating,
        notes: '',
        created_at: `${q.date_solved}T00:00:00Z`,
        updated_at: `${q.date_solved}T00:00:00Z`
      });
    });
  });

  function resolveJoins(tableName, row) {
    const enriched = { ...row };
    if (tableName === 'questions') {
      const subject = db.subjects.find(s => s.id === row.subject_id);
      enriched.subjects = subject ? { id: subject.id, name: subject.name } : null;
    } else if (tableName === 'revisions') {
      const q = db.questions.find(question => question.id === row.question_id);
      if (q) {
        const sub = db.subjects.find(s => s.id === q.subject_id);
        enriched.questions = {
          id: q.id,
          title: q.title,
          platform: q.platform,
          problem_number: q.problem_number,
          difficulty: q.difficulty,
          subject_id: q.subject_id,
          subjects: sub ? { name: sub.name } : null
        };
      } else {
        enriched.questions = null;
      }
    } else if (tableName === 'revision_sessions') {
      const q = db.questions.find(question => question.id === row.question_id);
      enriched.questions = q ? { title: q.title } : { title: '' };
    }
    return enriched;
  }

  return {
    _db: db,
    from(tableName) {
      if (!db[tableName]) {
        db[tableName] = [];
      }

      const tableData = db[tableName];
      let filters = [];
      let orderBy = null;
      let rangeLimit = null;
      let isSingle = false;
      let isMaybeSingle = false;
      let isCountHead = false;
      let pendingInsert = null;
      let pendingUpdate = null;
      let pendingUpsert = null;
      let isDelete = false;

      const builder = {
        select(columns = '*', options = {}) {
          if (options && options.head && options.count) {
            isCountHead = true;
          }
          return builder;
        },

        insert(data) {
          pendingInsert = Array.isArray(data) ? data : [data];
          return builder;
        },

        update(data) {
          pendingUpdate = data;
          return builder;
        },

        upsert(data) {
          pendingUpsert = Array.isArray(data) ? data : [data];
          return builder;
        },

        delete() {
          isDelete = true;
          return builder;
        },

        eq(column, value) {
          filters.push(row => row[column] === value || (row[column] !== null && row[column] !== undefined && String(row[column]) === String(value)));
          return builder;
        },

        neq(column, value) {
          filters.push(row => row[column] !== value);
          return builder;
        },

        ilike(column, pattern) {
          const cleanPattern = pattern.replace(/^%|%$/g, '').toLowerCase();
          filters.push(row => {
            const val = row[column];
            if (val === undefined || val === null) return false;
            return String(val).toLowerCase().includes(cleanPattern);
          });
          return builder;
        },

        or(conditionStr) {
          // Supports comma-separated conditions like title.ilike.%q%,problem_number.ilike.%q%
          const parts = conditionStr.split(',');
          filters.push(row => {
            return parts.some(part => {
              const trimmed = part.trim();
              if (trimmed.includes('.ilike.')) {
                const [col, pat] = trimmed.split('.ilike.');
                const clean = pat.replace(/^%|%$/g, '').toLowerCase();
                const val = row[col];
                return val !== undefined && val !== null && String(val).toLowerCase().includes(clean);
              }
              if (trimmed.includes('.eq.')) {
                const [col, val] = trimmed.split('.eq.');
                return String(row[col]) === String(val);
              }
              return false;
            });
          });
          return builder;
        },

        order(column, { ascending = true } = {}) {
          orderBy = { column, ascending };
          return builder;
        },

        range(from, to) {
          rangeLimit = { from, to };
          return builder;
        },

        limit(count) {
          rangeLimit = { from: 0, to: count - 1 };
          return builder;
        },

        single() {
          isSingle = true;
          return builder;
        },

        maybeSingle() {
          isMaybeSingle = true;
          return builder;
        },

        async then(resolve, reject) {
          try {
            // 1. Handle INSERT
            if (pendingInsert) {
              const insertedRows = [];
              for (const item of pendingInsert) {
                const newRow = { ...item };
                tableData.push(newRow);
                insertedRows.push(resolveJoins(tableName, newRow));
              }
              const resultData = isSingle ? insertedRows[0] : insertedRows;
              return resolve({ data: resultData, error: null });
            }

            // 2. Handle UPSERT
            if (pendingUpsert) {
              const upsertedRows = [];
              for (const item of pendingUpsert) {
                const existingIdx = tableData.findIndex(r => r.id === item.id);
                if (existingIdx >= 0) {
                  tableData[existingIdx] = { ...tableData[existingIdx], ...item };
                  upsertedRows.push(resolveJoins(tableName, tableData[existingIdx]));
                } else {
                  tableData.push(item);
                  upsertedRows.push(resolveJoins(tableName, item));
                }
              }
              const resultData = isSingle ? upsertedRows[0] : upsertedRows;
              return resolve({ data: resultData, error: null });
            }

            // Apply filters
            let filtered = tableData.filter(row => {
              return filters.every(fn => fn(row));
            });

            // 3. Handle DELETE
            if (isDelete) {
              const idsToDelete = new Set(filtered.map(r => r.id));
              for (let i = tableData.length - 1; i >= 0; i--) {
                if (idsToDelete.has(tableData[i].id)) {
                  tableData.splice(i, 1);
                }
              }
              return resolve({ data: filtered, error: null });
            }

            // 4. Handle UPDATE
            if (pendingUpdate) {
              const updatedRows = [];
              for (const row of filtered) {
                Object.assign(row, pendingUpdate);
                updatedRows.push(resolveJoins(tableName, row));
              }
              const resultData = isSingle || isMaybeSingle ? (updatedRows[0] || null) : updatedRows;
              return resolve({ data: resultData, error: null });
            }

            // 5. Handle COUNT HEAD
            if (isCountHead) {
              return resolve({ count: filtered.length, data: null, error: null });
            }

            // 6. Handle SELECT
            if (orderBy) {
              filtered.sort((a, b) => {
                const aVal = a[orderBy.column];
                const bVal = b[orderBy.column];
                if (aVal < bVal) return orderBy.ascending ? -1 : 1;
                if (aVal > bVal) return orderBy.ascending ? 1 : -1;
                return 0;
              });
            }

            const totalCount = filtered.length;
            if (rangeLimit) {
              filtered = filtered.slice(rangeLimit.from, rangeLimit.to + 1);
            }

            const resolvedRows = filtered.map(r => resolveJoins(tableName, r));

            if (isSingle) {
              if (resolvedRows.length === 0) {
                return resolve({ data: null, error: new Error('Record not found') });
              }
              return resolve({ data: resolvedRows[0], error: null, count: totalCount });
            }

            if (isMaybeSingle) {
              return resolve({ data: resolvedRows[0] || null, error: null, count: totalCount });
            }

            return resolve({ data: resolvedRows, count: totalCount, error: null });
          } catch (err) {
            return reject(err);
          }
        }
      };

      return builder;
    }
  };
}
