-- ====================================================================
-- ReviseCode Optional Demo Seed Data
-- ====================================================================
-- IMPORTANT:
-- This script is completely OPTIONAL.
-- Do NOT execute this if you want an empty production database.
-- Run this in the Supabase SQL Editor only if you wish to populate
-- initial demo subjects (DSA, SQL, Web Dev, Aptitude, Math, Other)
-- and 3 interview problems (LeetCode 50, LeetCode 53, LeetCode 121)
-- with corresponding revision schedules.
-- ====================================================================

BEGIN;

-- 1. Insert Subjects with deterministic UUIDs
INSERT INTO public.subjects (id, name, description, color, icon, topics)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'DSA', 'Data Structures and Algorithms', '#7c3aed', 'binary', ARRAY['Arrays', 'Two Pointers', 'Binary Search', 'Sliding Window', 'Dynamic Programming', 'Trees', 'Graphs']),
  ('a0000000-0000-0000-0000-000000000002', 'SQL', 'Database Queries and Optimization', '#3b82f6', 'database', ARRAY['Joins', 'Window Functions', 'Aggregations', 'Subqueries', 'Indexing']),
  ('a0000000-0000-0000-0000-000000000003', 'Web Development', 'Modern Web, DOM & Architecture', '#10b981', 'globe', ARRAY['JavaScript ES6', 'DOM API', 'CSS Grid', 'Event Loop', 'Async/Await']),
  ('a0000000-0000-0000-0000-000000000004', 'Aptitude', 'Quantitative and Logical Reasoning', '#f59e0b', 'calculator', ARRAY['Time & Work', 'Permutations', 'Percentages', 'Ratios']),
  ('a0000000-0000-0000-0000-000000000005', 'Mathematics', 'Discrete Math & Number Theory', '#ec4899', 'sigma', ARRAY['Number Theory', 'Probability', 'Combinatorics']),
  ('a0000000-0000-0000-0000-000000000006', 'Other', 'System Design and General Concepts', '#64748b', 'folder', ARRAY['System Design', 'General'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  topics = EXCLUDED.topics;

-- 2. Insert Questions
INSERT INTO public.questions (
  id, title, platform, problem_number, problem_url, subject_id, topic, difficulty,
  date_solved, statement, approach, notes, solution, code_language, time_complexity,
  space_complexity, tags, is_bookmarked, created_at, updated_at
) VALUES 
  (
    'b0000000-0000-0000-0000-000000000001',
    'Pow(x, n)',
    'LeetCode',
    '50',
    'https://leetcode.com/problems/powx-n/',
    'a0000000-0000-0000-0000-000000000001',
    'Binary Search',
    'Medium',
    CURRENT_DATE - INTERVAL '3 days',
    'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).',
    'Binary exponentiation / Divide and Conquer. If n is negative, invert x and negate n. If n is even, pow(x, n) = pow(x*x, n/2). If n is odd, pow(x, n) = x * pow(x*x, (n-1)/2).',
    'Handle negative power and INT_MIN overflow in typed languages.',
    'function myPow(x, n) {\n  if (n === 0) return 1;\n  let power = n;\n  if (power < 0) {\n    x = 1 / x;\n    power = -power;\n  }\n  let result = 1;\n  let currentProduct = x;\n  while (power > 0) {\n    if (power % 2 === 1) result *= currentProduct;\n    currentProduct *= currentProduct;\n    power = Math.floor(power / 2);\n  }\n  return result;\n}',
    'javascript',
    'O(log n)',
    'O(1)',
    ARRAY['Recursion', 'Math', 'Divide and Conquer'],
    true,
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE - INTERVAL '3 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'Maximum Subarray',
    'LeetCode',
    '53',
    'https://leetcode.com/problems/maximum-subarray/',
    'a0000000-0000-0000-0000-000000000001',
    'Dynamic Programming',
    'Medium',
    CURRENT_DATE - INTERVAL '7 days',
    'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
    'Kadane algorithm. Keep a running sum. Reset to 0 when negative.',
    'Edge case: all negative values return the single maximum element.',
    'def maxSubArray(nums):\n    max_sum = float(''-inf'')\n    current_sum = 0\n    for num in nums:\n        current_sum += num\n        if current_sum > max_sum: max_sum = current_sum\n        if current_sum < 0: current_sum = 0\n    return max_sum',
    'python',
    'O(n)',
    'O(1)',
    ARRAY['Arrays', 'DP', 'Kadane Algorithm'],
    false,
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE - INTERVAL '7 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'Best Time to Buy and Sell Stock',
    'LeetCode',
    '121',
    'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    'a0000000-0000-0000-0000-000000000001',
    'Arrays',
    'Easy',
    CURRENT_DATE - INTERVAL '14 days',
    'Find maximum profit achievable from one buy and one sell in future.',
    'Single-pass greedy tracking lowest buy price seen so far.',
    'Greedy approach works without full dynamic programming table.',
    'function maxProfit(prices) {\n  let min = Infinity, maxP = 0;\n  for (let p of prices) {\n    if (p < min) min = p;\n    else if (p - min > maxP) maxP = p - min;\n  }\n  return maxP;\n}',
    'javascript',
    'O(n)',
    'O(1)',
    ARRAY['Two Pointers', 'Greedy'],
    true,
    CURRENT_DATE - INTERVAL '14 days',
    CURRENT_DATE - INTERVAL '14 days'
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Milestones for Day 3, 7, 12, 20, 30
INSERT INTO public.revisions (question_id, milestone_day, due_date, completed_at, recall_rating)
VALUES
  -- LeetCode 50: Day 3 is due TODAY
  ('b0000000-0000-0000-0000-000000000001', 3, CURRENT_DATE, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', 7, CURRENT_DATE + INTERVAL '4 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', 12, CURRENT_DATE + INTERVAL '9 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', 20, CURRENT_DATE + INTERVAL '17 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', 30, CURRENT_DATE + INTERVAL '27 days', NULL, NULL),
  
  -- LeetCode 53: Day 3 completed, Day 7 is due today
  ('b0000000-0000-0000-0000-000000000002', 3, CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '4 days', 'easy'),
  ('b0000000-0000-0000-0000-000000000002', 7, CURRENT_DATE, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000002', 12, CURRENT_DATE + INTERVAL '5 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000002', 20, CURRENT_DATE + INTERVAL '13 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000002', 30, CURRENT_DATE + INTERVAL '23 days', NULL, NULL),

  -- LeetCode 121: Day 3 & 7 completed, Day 12 overdue
  ('b0000000-0000-0000-0000-000000000003', 3, CURRENT_DATE - INTERVAL '11 days', CURRENT_DATE - INTERVAL '11 days', 'easy'),
  ('b0000000-0000-0000-0000-000000000003', 7, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '7 days', 'easy'),
  ('b0000000-0000-0000-0000-000000000003', 12, CURRENT_DATE - INTERVAL '2 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000003', 20, CURRENT_DATE + INTERVAL '6 days', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000003', 30, CURRENT_DATE + INTERVAL '16 days', NULL, NULL)
ON CONFLICT (question_id, due_date) DO NOTHING;

COMMIT;
