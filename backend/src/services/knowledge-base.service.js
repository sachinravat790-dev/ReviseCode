/**
 * Knowledge Base Service: Provides accurate, educational answers for common
 * C++, DSA, Algorithms, Mathematics, SQL, and Web Development queries.
 * Used when an external LLM provider is unavailable or as a grounded fallback.
 * Supports English, Hindi, and Hinglish queries.
 */

export const knowledgeBaseService = {
  /**
   * Attempts to match and answer technical programming/math queries.
   */
  answerQuestion(query, isHindi = false) {
    const lower = query.toLowerCase().trim();

    // 1. C++: std::vector vs std::deque
    if ((lower.includes('vector') && lower.includes('deque')) || (lower.includes('std::vector') && lower.includes('std::deque'))) {
      if (isHindi || lower.includes('kya') || lower.includes('antar') || lower.includes('difference')) {
        return {
          handled: true,
          topic: 'C++ STL: vector vs deque',
          text: `### Difference between \`std::vector\` and \`std::deque\` in C++

1. **Memory Layout (मेमोरी लेआउट):**
   - \`std::vector\`: **Contiguous memory block** (लगातार मेमोरी)। Elements array की तरह लगातार मेमोरी में स्टोर होते हैं।
   - \`std::deque\` (Double-ended Queue): **Segmented memory blocks** (छोटे-छोटे फिक्स्ड-साइज चंक्स)। एक सेंट्रल इंडेक्स टेबल इन चंक्स को ट्रैक करती है।

2. **Insertion & Deletion (इंसर्शन और डिलीशन):**
   - \`std::vector\`: केवल **End (Back)** पर $O(1)$ amortized insertion होता है। Front में push करने पर सभी elements shift करने पड़ते हैं ($O(n)$)।
   - \`std::deque\`: **Front और Back दोनों सिरों** पर $O(1)$ insertion/deletion सपोर्ट करता है (\`push_front\` और \`push_back\`)।

3. **Reallocation Overhead:**
   - \`std::vector\`: Capacity भरने पर पूरी मेमोरी रीएलोकेट होती है और elements कॉपी होते हैं (Iterators invalidate हो जाते हैं)।
   - \`std::deque\`: नया चंक एलोकेट होता है, मौजूदा elements को कॉपी करने की जरूरत नहीं पड़ती।

4. **Random Access:**
   - दोनों में $O(1)$ index access (\`operator[]\`) होता है, लेकिन \`std::vector\` में pointer arithmetic होने के कारण CPU cache locality बहुत बेहतर होती है।

**Summary:** यदि आपको केवल अंत में जोड़ना है और तेज कैश परफॉरमेंस चाहिए तो \`std::vector\` चुनें; यदि दोनों सिरों से लगातार जोड़ना/घटाना है तो \`std::deque\` चुनें।`
        };
      }

      return {
        handled: true,
        topic: 'C++ STL: vector vs deque',
        text: `### Key Differences: \`std::vector\` vs \`std::deque\` in C++

| Feature | \`std::vector\` | \`std::deque\` |
| :--- | :--- | :--- |
| **Memory Allocation** | Single contiguous memory block. | Segmented fixed-size memory chunks via an internal map. |
| **Push/Pop Front** | $O(n)$ — requires shifting all elements. | $O(1)$ constant time (\`push_front\` / \`pop_front\`). |
| **Push/Pop Back** | $O(1)$ amortized time. | $O(1)$ constant time. |
| **Random Access** | $O(1)$ — extremely fast due to optimal CPU cache locality. | $O(1)$ — slightly slower due to double pointer indirection. |
| **Reallocation Cost** | When capacity is exceeded, copies all elements to a larger block. | Allocates a new chunk without copying existing elements. |
| **Pointer Validity** | Iterators and references invalidate on reallocation. | References remain valid when inserting at ends; iterators invalidate. |

**When to use which?**
- Use **\`std::vector\`** by default for sequence containers due to superior cache locality and minimal memory overhead.
- Use **\`std::deque\`** when you need frequent insertions or deletions at both the beginning and end of the sequence.`
      };
    }

    // 2. Mathematics: Bayes' Theorem
    if (lower.includes('bayes') || lower.includes('बेयस')) {
      return {
        handled: true,
        topic: 'Mathematics: Bayes Theorem',
        text: `### Bayes' Theorem (बेयस प्रमेय)

Bayes' Theorem provides a mathematical formula for calculating conditional probability: the probability of an event based on prior knowledge of conditions related to the event.

$$\\mathbf{P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}}$$

Where:
- $\\mathbf{P(A|B)}$: **Posterior Probability** — Probability of hypothesis $A$ given that evidence $B$ has occurred.
- $\\mathbf{P(B|A)}$: **Likelihood** — Probability of evidence $B$ given that hypothesis $A$ is true.
- $\\mathbf{P(A)}$: **Prior Probability** — Initial probability of hypothesis $A$ before seeing evidence $B$.
- $\\mathbf{P(B)}$: **Marginal Probability / Evidence** — Total probability of observing evidence $B$ across all possible hypotheses:
  $$P(B) = P(B|A) \\cdot P(A) + P(B|\\neg A) \\cdot P(\\neg A)$$

#### Application in Computer Science & Machine Learning:
1. **Naive Bayes Classifiers:** Text classification (Spam filtering, sentiment analysis) assuming feature independence.
2. **Medical Diagnosis:** Calculating the true positive probability of a disease given a positive test result in a population with low prevalence.
3. **Bayesian Optimization:** Hyperparameter tuning in deep learning models by balancing exploration and exploitation.`
      };
    }

    // 3. Dynamic Programming vs Divide & Conquer (Hindi / Hinglish / English)
    if ((lower.includes('dynamic programming') || lower.includes('डायनामिक') || lower.includes('dp')) &&
        (lower.includes('divide') || lower.includes('डिवाइड') || lower.includes('conquer') || lower.includes('diff') || lower.includes('kya'))) {
      return {
        handled: true,
        topic: 'Algorithms: Dynamic Programming vs Divide and Conquer',
        text: `### Dynamic Programming (DP) बनाम Divide and Conquer (D&C)

दोनों तकनीकें समस्या को छोटे उप-समस्याओं (sub-problems) में विभाजित करती हैं, लेकिन इनमें मुख्य अंतर यह है:

| विशेषता | Dynamic Programming (DP) | Divide and Conquer (D&C) |
| :--- | :--- | :--- |
| **उप-समस्याओं की प्रकृति** | **Overlapping Subproblems:** वही उप-समस्या बार-बार हल होती है। | **Independent Subproblems:** प्रत्येक उप-समस्या स्वतंत्र और अद्वितीय होती है। |
| **मेमोरी / स्टोरेज** | **Memoization (Top-down)** या **Tabulation (Bottom-up)** से पिछले उत्तरों को सहेजता है। | परिणाम दोबारा स्टोर करने की आवश्यकता नहीं होती; केवल रिकर्शन कॉल स्टैक का उपयोग होता है। |
| **इष्टतम संरचना** | **Optimal Substructure:** बड़े इष्टतम समाधान में छोटे इष्टतम समाधान शामिल होते हैं। | उप-समस्याओं के परिणामों को सीधे मिलाकर अंतिम उत्तर बनाया जाता है। |
| **उदाहरण** | Fibonacci numbers, 0/1 Knapsack, Longest Common Subsequence (LCS), Floyd-Warshall. | Merge Sort, Quick Sort, Binary Search, Strassen's Matrix Multiplication. |

**सरल शब्दों में (In Simple Words):**
- यदि उप-समस्याएं आपस में टकराती हैं और बार-बार दोहराई जाती हैं, तो **DP** का उपयोग करके पिछले परिणामों को याद रखें।
- यदि प्रत्येक उप-समस्या बिल्कुल स्वतंत्र है, तो **Divide & Conquer** का उपयोग करें।`
      };
    }

    // 4. Two Pointers Technique (Hinglish / Hindi / English)
    if (lower.includes('two pointer') || lower.includes('two pointers') || lower.includes('2 pointer')) {
      return {
        handled: true,
        topic: 'DSA: Two Pointers Pattern',
        text: `### Two Pointers Technique (दो पॉइंटर्स तकनीक)

**Two Pointers कब use karte hain?**
Two Pointers ek algorithmic pattern hai jisme hum array ya linked list me do index pointers ko track karte hain (usually opposing directions se ya same direction me different speeds se).

#### Common Use Cases:
1. **Opposite Ends (Dono kinaro se):**
   - Sorted array me pair sum dhoondna (e.g. *Two Sum II - Input array is sorted*).
   - Palindrome check karna (\`left\` from 0, \`right\` from $n-1$).
   - Reversing an array / string in-place.
   - Container With Most Water (LeetCode 11).

2. **Same Direction (Slow & Fast Pointers / Sliding Window):**
   - Sorted array se duplicates remove karna in-place (LeetCode 26).
   - Cycle detection in Linked List (Floyd's Tortoise and Hare).
   - Finding the middle of a Linked List.

#### Benefits & Complexity:
- **Time Complexity Optimization:** $O(n^2)$ nested loops ko reduce karke linear $\\mathbf{O(n)}$ time me solve kar deta hai.
- **Space Complexity:** Ek ya do variables lagte hain, isliye auxiliary space $\\mathbf{O(1)}$ rehta hai (in-place modification).

\`\`\`cpp
// Example: Pair sum in sorted array
bool hasPairWithSum(const vector<int>& arr, int target) {
    int left = 0, right = arr.size() - 1;
    while (left < right) {
        int current = arr[left] + arr[right];
        if (current == target) return true;
        if (current < target) left++; // sum badhana hai
        else right--;                 // sum ghatana hai
    }
    return false;
}
\`\`\``
      };
    }

    // 5. Quicksort complexity (worst vs average)
    if (lower.includes('quicksort') || lower.includes('quick sort')) {
      return {
        handled: true,
        topic: 'Algorithms: QuickSort Analysis',
        text: `### QuickSort Time and Space Complexity Analysis

QuickSort is an in-place, divide-and-conquer sorting algorithm based on partitioning around a pivot element.

#### 1. Time Complexity:
- **Best Case: $\\mathbf{O(n \\log n)}$** — Occurs when the pivot partition always divides the array into two nearly equal halves.
- **Average Case: $\\mathbf{O(n \\log n)}$** — Over all possible permutations of input, the expected comparison count is $2n \\ln n \\approx 1.39 n \\log_2 n$.
- **Worst Case: $\\mathbf{O(n^2)}$** — Occurs when the chosen pivot is always the smallest or largest element (e.g. sorted array with first/last element as pivot).

#### 2. Space Complexity:
- **Auxiliary Space: $\\mathbf{O(\\log n)}$** average call stack depth. In the worst case without tail-call elimination, recursion depth can reach $\\mathbf{O(n)}$.

#### 3. How to prevent $O(n^2)$ Worst Case?
- **Randomized Pivot Selection:** Choose a pivot index uniformly at random.
- **Median-of-Three:** Pick the median of \`first\`, \`middle\`, and \`last\` elements.
- **Introsort:** Switch to HeapSort when recursion depth exceeds $2 \\log n$ (used in standard C++ \`std::sort\`).`
      };
    }

    // 6. SQL Joins vs Subqueries
    if (lower.includes('join') && (lower.includes('subquery') || lower.includes('subqueries') || lower.includes('sql'))) {
      return {
        handled: true,
        topic: 'SQL: JOINs vs Subqueries',
        text: `### SQL: JOINs vs Subqueries

#### 1. JOINs:
- Combine columns from two or more tables based on a related column.
- Types: \`INNER JOIN\`, \`LEFT JOIN\`, \`RIGHT JOIN\`, \`FULL OUTER JOIN\`.
- **Performance:** Relational query optimizers excel at optimizing JOINs using hash joins, merge joins, or nested loops with indexes.

#### 2. Subqueries (Nested Queries):
- A query embedded within another query (inside \`WHERE\`, \`FROM\`, or \`SELECT\`).
- Can be **correlated** (references outer query columns, evaluated per outer row) or **non-correlated** (evaluated once).
- Correlated subqueries in \`WHERE\` clauses without indexes can degrade to $O(N \\times M)$ performance.

**Rule of Thumb:** Prefer \`JOIN\` for combining tabular datasets and aggregations; use Subqueries when checking existence (\`WHERE EXISTS (...)\`) or computing scalar isolated values.`
      };
    }

    // 7. Binary Search Concept & Complexity
    if (lower.includes('binary search') && (lower.includes('kaise') || lower.includes('how') || lower.includes('kya') || lower.includes('explain'))) {
      return {
        handled: true,
        topic: 'Algorithms: Binary Search',
        text: `### Binary Search (बाइनरी सर्च)

Binary Search ek efficient searching algorithm hai jo **sorted array** par kaam karta hai. Ye search space ko har step par aadha ($1/2$) kar deta hai.

#### Working Principle:
1. Array ke beech ka index (\`mid\`) calculate karo: \`mid = low + (high - low) / 2\`.
2. Agar \`arr[mid] == target\`, element mil gaya!
3. Agar \`arr[mid] < target\`, matlab target right half me hai: \`low = mid + 1\`.
4. Agar \`arr[mid] > target\`, matlab target left half me hai: \`high = mid - 1\`.
5. Repeat jab tak \`low <= high\`.

#### Complexity Analysis:
- **Time Complexity:** $\\mathbf{O(\\log n)}$ (Kyuki har comparison ke baad $n, n/2, n/4, \\dots, 1$).
- **Space Complexity:**
  - Iterative: $\\mathbf{O(1)}$ auxiliary space.
  - Recursive: $\\mathbf{O(\\log n)}$ call stack space.`
      };
    }

    return null;
  }
};
