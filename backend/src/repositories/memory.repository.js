/**
 * In-Memory Repository for ReviseCode Development Phase
 * Encapsulates in-memory storage with seed demonstration data and isolated reset capabilities for tests.
 */

import { addDays, computeRevisionStatus, getTodayDateString } from '../utils/dates.js';

let counter = 1000;
export function generateUniqueId(prefix = 'rc') {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

export class MemoryRepository {
  constructor() {
    this.reset();
  }

  reset() {
    const today = getTodayDateString();
    const dMinus2 = addDays(today, -2);
    const dMinus3 = addDays(today, -3);
    const dMinus7 = addDays(today, -7);
    const dMinus14 = addDays(today, -14);
    const dMinus25 = addDays(today, -25);

    // Initial Subjects Seed
    this.subjects = [
      { id: 'sub_dsa', name: 'DSA', description: 'Data Structures and Algorithms', color: '#7c3aed', icon: 'binary', topics: ['Arrays', 'Two Pointers', 'Binary Search', 'Sliding Window', 'Dynamic Programming', 'Trees', 'Graphs'], createdAt: dMinus25, updatedAt: dMinus25 },
      { id: 'sub_sql', name: 'SQL', description: 'Database Queries and Optimization', color: '#3b82f6', icon: 'database', topics: ['Joins', 'Window Functions', 'Aggregations', 'Subqueries', 'Indexing'], createdAt: dMinus25, updatedAt: dMinus25 },
      { id: 'sub_web', name: 'Web Development', description: 'Modern Web, DOM & Architecture', color: '#10b981', icon: 'globe', topics: ['JavaScript ES6', 'DOM API', 'CSS Grid', 'Event Loop', 'Async/Await'], createdAt: dMinus25, updatedAt: dMinus25 },
      { id: 'sub_apt', name: 'Aptitude', description: 'Quantitative and Logical Reasoning', color: '#f59e0b', icon: 'calculator', topics: ['Time & Work', 'Permutations', 'Percentages', 'Ratios'], createdAt: dMinus25, updatedAt: dMinus25 },
      { id: 'sub_math', name: 'Mathematics', description: 'Discrete Math & Number Theory', color: '#ec4899', icon: 'sigma', topics: ['Number Theory', 'Probability', 'Combinatorics'], createdAt: dMinus25, updatedAt: dMinus25 },
      { id: 'sub_other', name: 'Other', description: 'System Design and General Concepts', color: '#64748b', icon: 'folder', topics: ['System Design', 'General'], createdAt: dMinus25, updatedAt: dMinus25 }
    ];

    // Initial Questions Seed
    this.questions = [
      {
        id: 'q_lc_50',
        title: 'Pow(x, n)',
        platform: 'LeetCode',
        problemNumber: '50',
        problemUrl: 'https://leetcode.com/problems/powx-n/',
        subjectId: 'sub_dsa',
        subject: 'DSA',
        topic: 'Binary Search',
        difficulty: 'Medium',
        dateSolved: dMinus3,
        description: 'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).',
        summary: 'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).',
        approach: 'Binary exponentiation / Divide and Conquer. If n is negative, invert x and negate n. If n is even, pow(x, n) = pow(x*x, n/2). If n is odd, pow(x, n) = x * pow(x*x, (n-1)/2).',
        notes: 'Handle negative power and INT_MIN overflow in typed languages.',
        code: `function myPow(x, n) {\n  if (n === 0) return 1;\n  let power = n;\n  if (power < 0) {\n    x = 1 / x;\n    power = -power;\n  }\n  let result = 1;\n  let currentProduct = x;\n  while (power > 0) {\n    if (power % 2 === 1) result *= currentProduct;\n    currentProduct *= currentProduct;\n    power = Math.floor(power / 2);\n  }\n  return result;\n}`,
        codeSolution: `function myPow(x, n) {\n  if (n === 0) return 1;\n  let power = n;\n  if (power < 0) {\n    x = 1 / x;\n    power = -power;\n  }\n  let result = 1;\n  let currentProduct = x;\n  while (power > 0) {\n    if (power % 2 === 1) result *= currentProduct;\n    currentProduct *= currentProduct;\n    power = Math.floor(power / 2);\n  }\n  return result;\n}`,
        programmingLanguage: 'javascript',
        codeLanguage: 'javascript',
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        tags: ['Recursion', 'Math', 'Divide and Conquer'],
        bookmarked: true,
        isBookmarked: true,
        attachments: [],
        createdAt: dMinus3,
        updatedAt: dMinus3
      },
      {
        id: 'q_lc_53',
        title: 'Maximum Subarray',
        platform: 'LeetCode',
        problemNumber: '53',
        problemUrl: 'https://leetcode.com/problems/maximum-subarray/',
        subjectId: 'sub_dsa',
        subject: 'DSA',
        topic: 'Dynamic Programming',
        difficulty: 'Medium',
        dateSolved: dMinus7,
        description: 'Find subarray with the largest sum and return its sum.',
        summary: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
        approach: 'Kadane algorithm. Keep a running sum. Reset to 0 when negative.',
        notes: 'Edge case: all negative values return the single maximum element.',
        code: `def maxSubArray(nums):\n    max_sum = float('-inf')\n    current_sum = 0\n    for num in nums:\n        current_sum += num\n        if current_sum > max_sum: max_sum = current_sum\n        if current_sum < 0: current_sum = 0\n    return max_sum`,
        codeSolution: `def maxSubArray(nums):\n    max_sum = float('-inf')\n    current_sum = 0\n    for num in nums:\n        current_sum += num\n        if current_sum > max_sum: max_sum = current_sum\n        if current_sum < 0: current_sum = 0\n    return max_sum`,
        programmingLanguage: 'python',
        codeLanguage: 'python',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        tags: ['Arrays', 'DP', 'Kadane Algorithm'],
        bookmarked: false,
        isBookmarked: false,
        attachments: [],
        createdAt: dMinus7,
        updatedAt: dMinus7
      },
      {
        id: 'q_lc_121',
        title: 'Best Time to Buy and Sell Stock',
        platform: 'LeetCode',
        problemNumber: '121',
        problemUrl: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
        subjectId: 'sub_dsa',
        subject: 'DSA',
        topic: 'Arrays',
        difficulty: 'Easy',
        dateSolved: dMinus14,
        description: 'Find maximum profit achievable from one buy and one sell.',
        summary: 'Find maximum profit achievable from one buy and one sell in future.',
        approach: 'Single-pass greedy tracking lowest buy price seen so far.',
        notes: 'Greedy approach works without full dynamic programming table.',
        code: `function maxProfit(prices) {\n  let min = Infinity, maxP = 0;\n  for (let p of prices) {\n    if (p < min) min = p;\n    else if (p - min > maxP) maxP = p - min;\n  }\n  return maxP;\n}`,
        codeSolution: `function maxProfit(prices) {\n  let min = Infinity, maxP = 0;\n  for (let p of prices) {\n    if (p < min) min = p;\n    else if (p - min > maxP) maxP = p - min;\n  }\n  return maxP;\n}`,
        programmingLanguage: 'javascript',
        codeLanguage: 'javascript',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        tags: ['Two Pointers', 'Greedy'],
        bookmarked: true,
        isBookmarked: true,
        attachments: [],
        createdAt: dMinus14,
        updatedAt: dMinus14
      }
    ];

    // Initial Revisions & Sessions Seed
    this.revisions = [];
    this.sessions = [];

    // Milestone schedule for Day 3, 7, 12, 20, 30 for seeded questions
    const intervals = [3, 7, 12, 20, 30];
    this.questions.forEach(q => {
      intervals.forEach((dayOffset, idx) => {
        const dueDate = addDays(q.dateSolved, dayOffset);
        let completedAt = null;
        let recallRating = null;

        // Make first milestone of LC 50 due today (since solved 3 days ago)
        if (q.id === 'q_lc_50' && dayOffset === 3) {
          completedAt = null;
        } else if (idx === 0) {
          completedAt = dueDate;
          recallRating = 'easy';
          this.sessions.push({
            id: generateUniqueId('sess'),
            questionId: q.id,
            questionTitle: q.title,
            milestoneDay: dayOffset,
            recallRating: 'easy',
            timestamp: `${dueDate}T14:00:00Z`,
            notes: 'Strong initial retention.'
          });
        }

        const revRecord = {
          id: generateUniqueId('ms'),
          questionId: q.id,
          questionTitle: q.title,
          platform: q.platform,
          problemNumber: q.problemNumber,
          difficulty: q.difficulty,
          subject: q.subject,
          milestoneDay: dayOffset,
          dueDate,
          status: computeRevisionStatus(dueDate, completedAt),
          completedAt,
          recallRating,
          notes: ''
        };
        this.revisions.push(revRecord);
      });
    });

    // Notifications Seed
    this.notifications = [
      {
        id: generateUniqueId('notif'),
        type: 'revision_due',
        category: 'Revisions',
        title: 'Revision Due Today: LeetCode 50',
        message: 'Milestone Day 3 for Pow(x, n) is due for active recall.',
        questionId: 'q_lc_50',
        isRead: false,
        createdAt: `${today}T08:00:00Z`
      },
      {
        id: generateUniqueId('notif'),
        type: 'overdue',
        category: 'Overdue',
        title: 'Overdue Revision: Maximum Subarray',
        message: 'Milestone Day 7 for Maximum Subarray is overdue.',
        questionId: 'q_lc_53',
        isRead: false,
        createdAt: `${dMinus2}T09:00:00Z`
      }
    ];

    // Settings Seed
    this.settings = {
      theme: 'dark',
      timeZone: 'Asia/Kolkata (UTC+05:30)',
      reminderTime: '09:00',
      studyGoalQuestions: 3,
      customIntervalsEnabled: false,
      customIntervalDays: [45, 60],
      inAppNotifications: true,
      emailNotifications: true,
      whatsAppNotifications: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      aiDemoMode: true
    };
  }
}

// Singleton repository instance for application runtime
export const memoryRepository = new MemoryRepository();
