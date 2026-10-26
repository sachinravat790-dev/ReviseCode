/**
 * ReviseCode Data Access Layer (js/storage.js)
 * Clean abstraction over browser localStorage for client-side demo persistence.
 * Ready for future backend/Firebase API integration without breaking UI code.
 */

const STORAGE_KEYS = {
  QUESTIONS: 'revisecode_questions',
  SUBJECTS: 'revisecode_subjects',
  MILESTONES: 'revisecode_milestones',
  SESSIONS: 'revisecode_sessions',
  NOTIFICATIONS: 'revisecode_notifications',
  PROFILE: 'revisecode_profile',
  SETTINGS: 'revisecode_settings',
  INITIALIZED: 'revisecode_initialized_v1'
};

// Default Spaced Repetition Mandatory Intervals
export const MANDATORY_INTERVALS = [3, 7, 12, 20, 30];

// Seed Subjects
const DEFAULT_SUBJECTS = [
  { id: 'sub_dsa', name: 'DSA', color: '#7c3aed', icon: 'binary', topics: ['Arrays', 'Two Pointers', 'Binary Search', 'Sliding Window', 'Dynamic Programming', 'Trees', 'Graphs'], questionCount: 0, pendingCount: 0 },
  { id: 'sub_sql', name: 'SQL', color: '#3b82f6', icon: 'database', topics: ['Joins', 'Window Functions', 'Aggregations', 'Subqueries', 'Indexing'], questionCount: 0, pendingCount: 0 },
  { id: 'sub_web', name: 'Web Development', color: '#10b981', icon: 'globe', topics: ['JavaScript ES6', 'DOM API', 'CSS Grid', 'Event Loop', 'Async/Await'], questionCount: 0, pendingCount: 0 },
  { id: 'sub_apt', name: 'Aptitude', color: '#f59e0b', icon: 'calculator', topics: ['Time & Work', 'Permutations', 'Percentages', 'Ratios'], questionCount: 0, pendingCount: 0 },
  { id: 'sub_math', name: 'Mathematics', color: '#ec4899', icon: 'sigma', topics: ['Number Theory', 'Probability', 'Combinatorics'], questionCount: 0, pendingCount: 0 },
  { id: 'sub_other', name: 'Other', color: '#64748b', icon: 'folder', topics: ['System Design', 'General'], questionCount: 0, pendingCount: 0 }
];

// Helper to calculate target calendar dates from a base date
export function calculateMilestoneDates(startDateStr, intervals = MANDATORY_INTERVALS) {
  const baseDate = new Date(startDateStr);
  return intervals.map(days => {
    const target = new Date(baseDate);
    target.setDate(target.getDate() + days);
    return {
      day: days,
      targetDate: target.toISOString().split('T')[0]
    };
  });
}

// Format relative date helper
export function getDaysDiff(targetDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Generate unique ID helper
export function generateId(prefix = 'rc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// Seed Questions & Milestones
function getSeedData() {
  const today = new Date();
  const format = (d) => d.toISOString().split('T')[0];

  // Past dates
  const dMinus2 = new Date(today); dMinus2.setDate(today.getDate() - 2);
  const dMinus3 = new Date(today); dMinus3.setDate(today.getDate() - 3);
  const dMinus7 = new Date(today); dMinus7.setDate(today.getDate() - 7);
  const dMinus14 = new Date(today); dMinus14.setDate(today.getDate() - 14);
  const dMinus25 = new Date(today); dMinus25.setDate(today.getDate() - 25);

  const questions = [
    {
      id: 'q_lc_50',
      platform: 'LeetCode',
      problemNumber: '50',
      title: 'Pow(x, n)',
      url: 'https://leetcode.com/problems/powx-n/',
      subject: 'DSA',
      topic: 'Binary Search',
      difficulty: 'Medium',
      dateSolved: format(dMinus3),
      tags: ['Recursion', 'Math', 'Divide and Conquer'],
      summary: 'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).',
      approach: 'Binary exponentiation / Divide and Conquer. If n is negative, invert x and negate n. If n is even, pow(x, n) = pow(x*x, n/2). If n is odd, pow(x, n) = x * pow(x*x, (n-1)/2).',
      timeComplexity: 'O(log n)',
      spaceComplexity: 'O(1) iterative or O(log n) recursive',
      codeLanguage: 'javascript',
      codeSolution: `function myPow(x, n) {
  if (n === 0) return 1;
  let power = n;
  if (power < 0) {
    x = 1 / x;
    power = -power;
  }
  let result = 1;
  let currentProduct = x;
  while (power > 0) {
    if (power % 2 === 1) {
      result *= currentProduct;
    }
    currentProduct *= currentProduct;
    power = Math.floor(power / 2);
  }
  return result;
}`,
      notes: 'Remember to handle negative power and INT_MIN overflow in C++ / integer typing languages. In JS power can be inverted directly.',
      attachments: [],
      isBookmarked: true,
      isArchived: false,
      createdAt: format(dMinus3),
      updatedAt: format(dMinus3)
    },
    {
      id: 'q_lc_53',
      platform: 'LeetCode',
      problemNumber: '53',
      title: 'Maximum Subarray',
      url: 'https://leetcode.com/problems/maximum-subarray/',
      subject: 'DSA',
      topic: 'Dynamic Programming',
      difficulty: 'Medium',
      dateSolved: format(dMinus7),
      tags: ['Arrays', 'DP', 'Kadane Algorithm'],
      summary: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
      approach: 'Kadane algorithm. Keep a running sum. If the running sum drops below zero, reset it to 0. Update max sum at each step.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLanguage: 'python',
      codeSolution: `def maxSubArray(nums: list[int]) -> int:
    max_sum = float('-inf')
    current_sum = 0
    for num in nums:
        current_sum += num
        if current_sum > max_sum:
            max_sum = current_sum
        if current_sum < 0:
            current_sum = 0
    return max_sum`,
      notes: 'Edge case: when all numbers are negative, max_sum is the single largest (least negative) number.',
      attachments: [],
      isBookmarked: false,
      isArchived: false,
      createdAt: format(dMinus7),
      updatedAt: format(dMinus7)
    },
    {
      id: 'q_lc_121',
      platform: 'LeetCode',
      problemNumber: '121',
      title: 'Best Time to Buy and Sell Stock',
      url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
      subject: 'DSA',
      topic: 'Arrays',
      difficulty: 'Easy',
      dateSolved: format(dMinus14),
      tags: ['Two Pointers', 'Dynamic Programming'],
      summary: 'Find the maximum profit you can achieve from choosing a single day to buy one stock and choosing a different day in the future to sell.',
      approach: 'Track minimum buying price seen so far. At each step, calculate potential profit and update max profit.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLanguage: 'javascript',
      codeSolution: `function maxProfit(prices) {
  let minPrice = Infinity;
  let maxProfit = 0;
  for (const price of prices) {
    if (price < minPrice) {
      minPrice = price;
    } else if (price - minPrice > maxProfit) {
      maxProfit = price - minPrice;
    }
  }
  return maxProfit;
}`,
      notes: 'Classic greedy single-pass problem. No need for complex DP array.',
      attachments: [],
      isBookmarked: true,
      isArchived: false,
      createdAt: format(dMinus14),
      updatedAt: format(dMinus14)
    },
    {
      id: 'q_lc_134',
      platform: 'LeetCode',
      problemNumber: '134',
      title: 'Gas Station',
      url: 'https://leetcode.com/problems/gas-station/',
      subject: 'DSA',
      topic: 'Arrays',
      difficulty: 'Medium',
      dateSolved: format(dMinus25),
      tags: ['Greedy', 'Arrays'],
      summary: 'Given two integer arrays gas and cost, return the starting gas station index if you can travel around the circuit once, otherwise return -1.',
      approach: 'If total gas < total cost, return -1. Otherwise, if current gas tank drops below zero, starting point must be the next station.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLanguage: 'python',
      codeSolution: `def canCompleteCircuit(gas: list[int], cost: list[int]) -> int:
    if sum(gas) < sum(cost):
        return -1
    total_tank, current_tank = 0, 0
    start_index = 0
    for i in range(len(gas)):
        net = gas[i] - cost[i]
        current_tank += net
        if current_tank < 0:
            start_index = i + 1
            current_tank = 0
    return start_index`,
      notes: 'The greedy property holds because any station between the candidate start and failing point cannot be a start.',
      attachments: [],
      isBookmarked: false,
      isArchived: false,
      createdAt: format(dMinus25),
      updatedAt: format(dMinus25)
    },
    {
      id: 'q_lc_189',
      platform: 'LeetCode',
      problemNumber: '189',
      title: 'Rotate Array',
      url: 'https://leetcode.com/problems/rotate-array/',
      subject: 'DSA',
      topic: 'Two Pointers',
      difficulty: 'Medium',
      dateSolved: format(dMinus2),
      tags: ['Arrays', 'Math'],
      summary: 'Given an integer array nums, rotate the array to the right by k steps.',
      approach: 'Three reverse steps: reverse whole array, reverse first k elements, reverse remaining elements.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLanguage: 'javascript',
      codeSolution: `function rotate(nums, k) {
  k = k % nums.length;
  function reverse(start, end) {
    while (start < end) {
      [nums[start], nums[end]] = [nums[end], nums[start]];
      start++;
      end--;
    }
  }
  reverse(0, nums.length - 1);
  reverse(0, k - 1);
  reverse(k, nums.length - 1);
}`,
      notes: 'Make sure to take k = k % nums.length for k > array length.',
      attachments: [],
      isBookmarked: false,
      isArchived: false,
      createdAt: format(dMinus2),
      updatedAt: format(dMinus2)
    },
    {
      id: 'q_lc_209',
      platform: 'LeetCode',
      problemNumber: '209',
      title: 'Minimum Size Subarray Sum',
      url: 'https://leetcode.com/problems/minimum-size-subarray-sum/',
      subject: 'DSA',
      topic: 'Sliding Window',
      difficulty: 'Medium',
      dateSolved: format(dMinus25),
      tags: ['Sliding Window', 'Two Pointers', 'Prefix Sum'],
      summary: 'Given an array of positive integers nums and a target, return the minimal length of a subarray whose sum is >= target.',
      approach: 'Two-pointer sliding window. Expand right pointer until sum >= target, then shrink left pointer while maintaining sum >= target.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeLanguage: 'javascript',
      codeSolution: `function minSubArrayLen(target, nums) {
  let left = 0;
  let sum = 0;
  let minLen = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= target) {
      minLen = Math.min(minLen, right - left + 1);
      sum -= nums[left++];
    }
  }
  return minLen === Infinity ? 0 : minLen;
}`,
      notes: 'Notice nums contains only positive integers, allowing sliding window monotonicity.',
      attachments: [],
      isBookmarked: false,
      isArchived: false,
      createdAt: format(dMinus25),
      updatedAt: format(dMinus25)
    },
    {
      id: 'q_sql_1',
      platform: 'LeetCode',
      problemNumber: '178',
      title: 'Rank Scores',
      url: 'https://leetcode.com/problems/rank-scores/',
      subject: 'SQL',
      topic: 'Window Functions',
      difficulty: 'Medium',
      dateSolved: format(dMinus14),
      tags: ['SQL', 'DENSE_RANK'],
      summary: 'Write a solution to find the rank of the scores with no holes in ranking sequence.',
      approach: 'Use DENSE_RANK() OVER (ORDER BY score DESC).',
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(n)',
      codeLanguage: 'sql',
      codeSolution: `SELECT score,
       DENSE_RANK() OVER (ORDER BY score DESC) AS 'rank'
FROM Scores
ORDER BY score DESC;`,
      notes: 'DENSE_RANK does not skip ranks when there are ties, unlike RANK().',
      attachments: [],
      isBookmarked: false,
      isArchived: false,
      createdAt: format(dMinus14),
      updatedAt: format(dMinus14)
    },
    {
      id: 'q_web_1',
      platform: 'Other',
      problemNumber: 'JS-01',
      title: 'Implement Custom Promise.all()',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all',
      subject: 'Web Development',
      topic: 'JavaScript ES6',
      difficulty: 'Hard',
      dateSolved: format(dMinus7),
      tags: ['JavaScript', 'Async', 'Promises'],
      summary: 'Implement a polyfill for Promise.all taking an array of promises and resolving with an array of values in order.',
      approach: 'Return a new Promise. Maintain a results array and completed counter. Reject immediately on first error.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      codeLanguage: 'javascript',
      codeSolution: `function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!promises || promises.length === 0) {
      return resolve([]);
    }
    const results = [];
    let completed = 0;
    promises.forEach((p, index) => {
      Promise.resolve(p).then(val => {
        results[index] = val;
        completed++;
        if (completed === promises.length) {
          resolve(results);
        }
      }).catch(reject);
    });
  });
}`,
      notes: 'Make sure non-promise values are wrapped with Promise.resolve().',
      attachments: [],
      isBookmarked: true,
      isArchived: false,
      createdAt: format(dMinus7),
      updatedAt: format(dMinus7)
    }
  ];

  // Generate Milestones for each question
  const milestones = [];
  const sessions = [];

  questions.forEach(q => {
    const dates = calculateMilestoneDates(q.dateSolved, MANDATORY_INTERVALS);
    dates.forEach((m, idx) => {
      const daysDiff = getDaysDiff(m.targetDate);
      let status = 'upcoming';

      if (daysDiff < 0) {
        // Milestone target date has passed
        // For demonstration, let's mark some as completed and some as overdue
        if (idx === 0) {
          status = 'completed';
          sessions.push({
            id: generateId('sess'),
            questionId: q.id,
            questionTitle: q.title,
            milestoneDay: m.day,
            recallRating: 'easy',
            timestamp: m.targetDate + 'T14:30:00Z',
            notes: 'Smooth recall of binary search technique.'
          });
        } else if (idx === 1 && daysDiff < -2) {
          status = 'completed';
          sessions.push({
            id: generateId('sess'),
            questionId: q.id,
            questionTitle: q.title,
            milestoneDay: m.day,
            recallRating: 'difficult',
            timestamp: m.targetDate + 'T16:00:00Z',
            notes: 'Struggled slightly with odd exponent handling.'
          });
        } else {
          status = 'overdue';
        }
      } else if (daysDiff === 0) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      // Explicit override for LeetCode 50: Day 3 is due today
      if (q.id === 'q_lc_50' && m.day === 3) {
        status = 'due';
      }

      milestones.push({
        id: generateId('ms'),
        questionId: q.id,
        questionTitle: q.title,
        platform: q.platform,
        problemNumber: q.problemNumber,
        difficulty: q.difficulty,
        subject: q.subject,
        day: m.day,
        targetDate: m.targetDate,
        status: status,
        completedAt: status === 'completed' ? m.targetDate : null,
        recallRating: status === 'completed' ? 'easy' : null
      });
    });
  });

  const notifications = [
    {
      id: 'notif_1',
      type: 'revision_due',
      category: 'Revisions',
      title: 'Revision Due Today: LeetCode 50',
      message: 'Milestone Day 3 for Pow(x, n) is scheduled for today.',
      questionId: 'q_lc_50',
      isRead: false,
      createdAt: format(today) + 'T08:00:00Z'
    },
    {
      id: 'notif_2',
      type: 'overdue',
      category: 'Overdue',
      title: 'Overdue Revision: Maximum Subarray',
      message: 'Milestone Day 7 for LeetCode 53 was due 2 days ago.',
      questionId: 'q_lc_53',
      isRead: false,
      createdAt: format(dMinus2) + 'T09:00:00Z'
    },
    {
      id: 'notif_3',
      type: 'ai_action',
      category: 'AI Actions',
      title: 'AI Scheduled 5 Revisions',
      message: 'Milestones for Rotate Array (LeetCode 189) successfully generated.',
      questionId: 'q_lc_189',
      isRead: true,
      createdAt: format(dMinus2) + 'T11:15:00Z'
    },
    {
      id: 'notif_4',
      type: 'system',
      category: 'System',
      title: '5-Day Learning Streak Active!',
      message: 'Keep going! Complete today\'s queue to maintain your streak.',
      questionId: null,
      isRead: true,
      createdAt: format(today) + 'T07:00:00Z'
    }
  ];

  const profile = {
    name: 'New Learner',
    email: '',
    avatar: 'NL',
    role: 'Learner',
    dateJoined: new Date().toISOString().split('T')[0],
    streakDays: 0,
    streakFreezeLeft: 2,
    interests: []
  };

  const settings = {
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

  return { questions, subjects: DEFAULT_SUBJECTS, milestones, sessions, notifications, profile, settings };
}

// Storage Manager Service
export const StorageManager = {
  // Initialize safe default storage structures without populating unowned demo data
  init() {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        if (!localStorage.getItem(STORAGE_KEYS.SUBJECTS)) {
          localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
          localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.MILESTONES)) {
          localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
        }
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      }
    } catch (e) {
      console.warn('localStorage not accessible or restricted:', e);
    }
  },

  // Reset demo data to seed
  resetToSeed() {
    const seed = getSeedData();
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(seed.questions));
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(seed.subjects));
    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(seed.milestones));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(seed.sessions));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(seed.notifications));
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(seed.profile));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(seed.settings));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return seed;
  },

  // Questions
  getQuestions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  getQuestionById(id) {
    const questions = this.getQuestions();
    return questions.find(q => q.id === id) || null;
  },

  saveQuestion(questionData) {
    const questions = this.getQuestions();
    let isNew = false;
    let savedQuestion;

    if (!questionData.id) {
      // Create new
      isNew = true;
      savedQuestion = {
        ...questionData,
        id: generateId('q'),
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        isBookmarked: false,
        isArchived: false
      };
      questions.unshift(savedQuestion);

      // Create mandatory revision milestones: 3, 7, 12, 20, 30
      const dates = calculateMilestoneDates(savedQuestion.dateSolved || savedQuestion.createdAt);
      const newMilestones = dates.map(m => {
        const daysDiff = getDaysDiff(m.targetDate);
        return {
          id: generateId('ms'),
          questionId: savedQuestion.id,
          questionTitle: savedQuestion.title,
          platform: savedQuestion.platform,
          problemNumber: savedQuestion.problemNumber,
          difficulty: savedQuestion.difficulty,
          subject: savedQuestion.subject,
          day: m.day,
          targetDate: m.targetDate,
          status: daysDiff < 0 ? 'overdue' : (daysDiff === 0 ? 'due' : 'upcoming'),
          completedAt: null,
          recallRating: null
        };
      });

      const currentMilestones = this.getMilestones();
      localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify([...newMilestones, ...currentMilestones]));

      // Add notification
      this.addNotification({
        type: 'revision_scheduled',
        category: 'Revisions',
        title: `Question Saved: ${savedQuestion.title}`,
        message: `Scheduled 5 revision milestones for Day 3, 7, 12, 20, and 30.`,
        questionId: savedQuestion.id
      });
    } else {
      // Update existing
      const index = questions.findIndex(q => q.id === questionData.id);
      if (index !== -1) {
        savedQuestion = {
          ...questions[index],
          ...questionData,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        questions[index] = savedQuestion;
      } else {
        questions.push(questionData);
        savedQuestion = questionData;
      }
    }

    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    return savedQuestion;
  },

  deleteQuestion(id) {
    let questions = this.getQuestions();
    questions = questions.filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

    // Also remove associated milestones
    let milestones = this.getMilestones();
    milestones = milestones.filter(m => m.questionId !== id);
    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(milestones));
    return true;
  },

  toggleBookmark(id) {
    const questions = this.getQuestions();
    const q = questions.find(item => item.id === id);
    if (q) {
      q.isBookmarked = !q.isBookmarked;
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
      return q.isBookmarked;
    }
    return false;
  },

  checkDuplicate(platform, problemNumber, title) {
    const questions = this.getQuestions();
    return questions.find(q => {
      const matchNumber = platform && problemNumber && q.platform.toLowerCase() === platform.toLowerCase() && String(q.problemNumber) === String(problemNumber);
      const matchTitle = title && q.title.toLowerCase().trim() === title.toLowerCase().trim();
      return matchNumber || matchTitle;
    }) || null;
  },

  // Subjects
  getSubjects() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      const subjects = data ? JSON.parse(data) : DEFAULT_SUBJECTS;
      // recalculate question counts
      const questions = this.getQuestions();
      const milestones = this.getMilestones();

      return subjects.map(s => {
        const qCount = questions.filter(q => q.subject.toLowerCase() === s.name.toLowerCase()).length;
        const pendingCount = milestones.filter(m => m.subject?.toLowerCase() === s.name.toLowerCase() && (m.status === 'due' || m.status === 'overdue')).length;
        return {
          ...s,
          questionCount: qCount,
          pendingCount: pendingCount
        };
      });
    } catch (e) {
      return DEFAULT_SUBJECTS;
    }
  },

  saveSubject(subjectData) {
    const subjects = this.getSubjects();
    if (!subjectData.id) {
      const newSubject = {
        ...subjectData,
        id: generateId('sub'),
        questionCount: 0,
        pendingCount: 0
      };
      subjects.push(newSubject);
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
      return newSubject;
    } else {
      const idx = subjects.findIndex(s => s.id === subjectData.id);
      if (idx !== -1) {
        subjects[idx] = { ...subjects[idx], ...subjectData };
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
        return subjects[idx];
      }
    }
  },

  deleteSubject(id) {
    let subjects = this.getSubjects();
    subjects = subjects.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    return true;
  },

  // Milestones
  getMilestones() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MILESTONES);
      const milestones = data ? JSON.parse(data) : [];
      // dynamically update overdue/due status based on current calendar date
      return milestones.map(m => {
        if (m.status !== 'completed') {
          const diff = getDaysDiff(m.targetDate);
          if (diff < 0) return { ...m, status: 'overdue' };
          if (diff === 0) return { ...m, status: 'due' };
          return { ...m, status: 'upcoming' };
        }
        return m;
      });
    } catch (e) {
      return [];
    }
  },

  getMilestonesForQuestion(questionId) {
    const milestones = this.getMilestones();
    return milestones.filter(m => m.questionId === questionId).sort((a, b) => a.day - b.day);
  },

  // Complete a revision milestone session
  completeMilestone(milestoneId, recallRating = 'easy', notes = '') {
    const milestones = this.getMilestones();
    const ms = milestones.find(m => m.id === milestoneId);
    if (!ms) return null;

    if (ms.status === 'completed') {
      // Prevent duplicate completion records caused by repeated clicks
      return ms;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();

    ms.status = 'completed';
    ms.completedAt = todayStr;
    ms.recallRating = recallRating;

    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(milestones));

    // Record session
    const sessions = this.getSessions();
    const session = {
      id: generateId('sess'),
      questionId: ms.questionId,
      questionTitle: ms.questionTitle,
      milestoneDay: ms.day,
      recallRating,
      timestamp,
      notes
    };
    sessions.unshift(session);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    // Add completion notification
    this.addNotification({
      type: 'revision_completed',
      category: 'Revisions',
      title: `Revision Completed: ${ms.questionTitle}`,
      message: `Completed Day ${ms.day} milestone with recall rated "${recallRating.toUpperCase()}".`,
      questionId: ms.questionId
    });

    return ms;
  },

  // Explicitly reschedule milestone without silently shifting other dates
  rescheduleMilestone(milestoneId, newTargetDate) {
    const milestones = this.getMilestones();
    const ms = milestones.find(m => m.id === milestoneId);
    if (!ms) return null;

    ms.targetDate = newTargetDate;
    const diff = getDaysDiff(newTargetDate);
    ms.status = diff < 0 ? 'overdue' : (diff === 0 ? 'due' : 'upcoming');
    localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(milestones));
    return ms;
  },

  // Revision Sessions
  getSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Notifications
  getNotifications() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addNotification(notif) {
    const list = this.getNotifications();
    const newNotif = {
      id: generateId('notif'),
      isRead: false,
      createdAt: new Date().toISOString(),
      ...notif
    };
    list.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    return newNotif;
  },

  markNotificationRead(id) {
    const list = this.getNotifications();
    const n = list.find(item => item.id === id);
    if (n) {
      n.isRead = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    }
  },

  markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, isRead: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  },

  clearNotification(id) {
    let list = this.getNotifications();
    list = list.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  },

  // Profile & Settings
  getProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) return JSON.parse(data);

      const sessionUser = localStorage.getItem('revisecode_user') || sessionStorage.getItem('revisecode_user');
      if (sessionUser) {
        const u = JSON.parse(sessionUser);
        return {
          name: u.name || 'Learner',
          email: u.email || '',
          avatar: u.avatar || 'U',
          role: 'Learner',
          dateJoined: u.createdAt ? u.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          streakDays: 0,
          streakFreezeLeft: 0,
          interests: []
        };
      }
    } catch (e) {
      // Fallback
    }
    return {
      name: 'Learner',
      email: '',
      avatar: 'U',
      role: 'Learner',
      dateJoined: new Date().toISOString().split('T')[0],
      streakDays: 0,
      streakFreezeLeft: 0,
      interests: []
    };
  },

  saveProfile(profileData) {
    const profile = { ...this.getProfile(), ...profileData };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    return profile;
  },

  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : getSeedData().settings;
    } catch (e) {
      return getSeedData().settings;
    }
  },

  saveSettings(settingsData) {
    const settings = { ...this.getSettings(), ...settingsData };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return settings;
  },

  // Calculated Dashboard & Analytics Metrics
  getDashboardMetrics() {
    const questions = this.getQuestions();
    const milestones = this.getMilestones();
    const sessions = this.getSessions();
    const profile = this.getProfile();

    const dueToday = milestones.filter(m => m.status === 'due');
    const overdue = milestones.filter(m => m.status === 'overdue');
    const completed = milestones.filter(m => m.status === 'completed');
    const totalDueOrPast = dueToday.length + overdue.length + completed.length;

    const completionRate = totalDueOrPast > 0 ? Math.round((completed.length / totalDueOrPast) * 100) : 100;

    return {
      totalQuestions: questions.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      completionRate: completionRate,
      streakDays: profile.streakDays || 0,
      completedSessionsCount: sessions.length
    };
  },

  // Export all application data as clean JSON
  exportData() {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      questions: this.getQuestions(),
      subjects: this.getSubjects(),
      milestones: this.getMilestones(),
      sessions: this.getSessions(),
      notifications: this.getNotifications(),
      profile: this.getProfile(),
      settings: this.getSettings()
    }, null, 2);
  }
};

// Auto-run init upon script evaluation
StorageManager.init();
