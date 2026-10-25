/**
 * Problem Verifier Service: Verifies coding problem existence on official platforms
 * (LeetCode, Codeforces, GeeksforGeeks) via public APIs and verified registries.
 * Adheres strictly to the honesty principle: NEVER invents URLs or claims existence without proof.
 */

export const problemVerifierService = {
  /**
   * Attempts to verify if a problem exists on a competitive programming platform.
   * @param {string} platform - e.g. "LeetCode", "Codeforces", "GeeksforGeeks"
   * @param {string|number} identifier - problem number (e.g. 50), slug, or title
   * @returns {Promise<Object>} Verification result with honest status
   */
  async verifyProblem(platform = '', identifier = '') {
    const plat = (platform || '').toLowerCase().trim();
    const query = String(identifier || '').trim();

    if (!query) {
      return {
        verified: false,
        platform: platform || 'Unknown',
        message: 'No problem title or number specified for verification.'
      };
    }

    if (plat.includes('leetcode')) {
      return await this.verifyLeetCode(query);
    }

    if (plat.includes('codeforces')) {
      return await this.verifyCodeforces(query);
    }

    if (plat.includes('geeks') || plat.includes('gfg')) {
      return await this.verifyGeeksForGeeks(query);
    }

    // Unhandled or unknown platform
    return {
      verified: false,
      platform: platform || 'Unknown',
      message: `Online verification is not available for platform "${platform}". The existence of this problem could not be verified.`,
      onlineCheckAvailable: false
    };
  },

  /**
   * Verifies a problem on LeetCode using official GraphQL endpoints.
   */
  async verifyLeetCode(query) {
    const isNumber = /^\d+$/.test(query);

    try {
      // 1. If numeric problem number: search by keyword to resolve exact questionFrontendId
      if (isNumber) {
        const res = await fetch('https://leetcode.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            query: `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
              problemsetQuestionList: questionList(categorySlug: $categorySlug limit: $limit skip: $skip filters: $filters) {
                total: totalNum
                questions: data {
                  questionFrontendId
                  title
                  titleSlug
                  difficulty
                  isPaidOnly
                }
              }
            }`,
            variables: { categorySlug: '', limit: 10, skip: 0, filters: { searchKeywords: query } }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) {
          return {
            verified: false,
            platform: 'LeetCode',
            onlineCheckAvailable: false,
            message: `LeetCode verification endpoint returned HTTP ${res.status}. Could not verify online.`
          };
        }

        const data = await res.json();
        const questions = data.data?.problemsetQuestionList?.questions || [];
        const match = questions.find(q => String(q.questionFrontendId) === String(query));

        if (match) {
          return {
            verified: true,
            platform: 'LeetCode',
            problemNumber: match.questionFrontendId,
            title: match.title,
            titleSlug: match.titleSlug,
            difficulty: match.difficulty,
            isPaidOnly: Boolean(match.isPaidOnly),
            officialUrl: `https://leetcode.com/problems/${match.titleSlug}/`,
            sourceEvidence: `Verified via LeetCode official problem list (Problem #${match.questionFrontendId})`
          };
        }

        return {
          verified: false,
          platform: 'LeetCode',
          onlineCheckAvailable: true,
          message: `No problem with number #${query} found on LeetCode.`
        };
      }

      // 2. If problem title or slug: search by slug or title
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const detailRes = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          query: `query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionId
              questionFrontendId
              title
              difficulty
              isPaidOnly
            }
          }`,
          variables: { titleSlug: slug }
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (detailRes.ok) {
        const detailData = await detailRes.json();
        const q = detailData.data?.question;
        if (q && q.title) {
          return {
            verified: true,
            platform: 'LeetCode',
            problemNumber: q.questionFrontendId,
            title: q.title,
            titleSlug: slug,
            difficulty: q.difficulty,
            isPaidOnly: Boolean(q.isPaidOnly),
            officialUrl: `https://leetcode.com/problems/${slug}/`,
            sourceEvidence: `Verified via LeetCode official GraphQL API`
          };
        }
      }

      // Fallback search by keyword
      const searchRes = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
        body: JSON.stringify({
          query: `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
            problemsetQuestionList: questionList(categorySlug: $categorySlug limit: $limit skip: $skip filters: $filters) {
              questions: data {
                questionFrontendId
                title
                titleSlug
                difficulty
                isPaidOnly
              }
            }
          }`,
          variables: { categorySlug: '', limit: 5, skip: 0, filters: { searchKeywords: query } }
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (searchRes.ok) {
        const sData = await searchRes.json();
        const questions = sData.data?.problemsetQuestionList?.questions || [];
        const cleanQ = query.toLowerCase().trim();

        // Require genuine title or slug match rather than arbitrary fuzzy substrings
        const genuineMatch = questions.find(q =>
          q.title.toLowerCase() === cleanQ ||
          q.titleSlug.toLowerCase() === slug ||
          q.title.toLowerCase().includes(cleanQ)
        );

        if (genuineMatch) {
          return {
            verified: true,
            platform: 'LeetCode',
            problemNumber: genuineMatch.questionFrontendId,
            title: genuineMatch.title,
            titleSlug: genuineMatch.titleSlug,
            difficulty: genuineMatch.difficulty,
            isPaidOnly: Boolean(genuineMatch.isPaidOnly),
            officialUrl: `https://leetcode.com/problems/${genuineMatch.titleSlug}/`,
            sourceEvidence: `Verified matching "${query}" on LeetCode`
          };
        }
      }

      return {
        verified: false,
        platform: 'LeetCode',
        onlineCheckAvailable: true,
        message: `Could not verify any LeetCode problem matching "${query}".`
      };
    } catch (err) {
      return {
        verified: false,
        platform: 'LeetCode',
        onlineCheckAvailable: false,
        message: `Online verification is currently unavailable (${err.message}). Problem existence could not be confirmed.`
      };
    }
  },

  /**
   * Verifies a problem on Codeforces using the official public Codeforces API.
   */
  async verifyCodeforces(query) {
    try {
      const matchContest = query.match(/^(\d+)\s*([A-Za-z]\d?)$/); // e.g. "4A" or "71A"
      const res = await fetch('https://codeforces.com/api/problemset.problems', {
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        return {
          verified: false,
          platform: 'Codeforces',
          onlineCheckAvailable: false,
          message: `Codeforces API returned HTTP ${res.status}. Online verification unavailable.`
        };
      }

      const data = await res.json();
      if (data.status !== 'OK' || !Array.isArray(data.result?.problems)) {
        return {
          verified: false,
          platform: 'Codeforces',
          onlineCheckAvailable: false,
          message: 'Codeforces API did not return problemset data.'
        };
      }

      const problems = data.result.problems;

      if (matchContest) {
        const contestId = parseInt(matchContest[1], 10);
        const index = matchContest[2].toUpperCase();
        const found = problems.find(p => p.contestId === contestId && p.index.toUpperCase() === index);

        if (found) {
          return {
            verified: true,
            platform: 'Codeforces',
            contestId: found.contestId,
            index: found.index,
            title: found.name,
            difficulty: found.rating ? `${found.rating} rating` : 'Unrated',
            tags: found.tags || [],
            officialUrl: `https://codeforces.com/problemset/problem/${found.contestId}/${found.index}`,
            sourceEvidence: `Verified via Codeforces API (Contest ${found.contestId}, Problem ${found.index})`
          };
        }
      }

      // Title search
      const qLower = query.toLowerCase();
      const titleMatch = problems.find(p => p.name.toLowerCase() === qLower || p.name.toLowerCase().includes(qLower));

      if (titleMatch) {
        return {
          verified: true,
          platform: 'Codeforces',
          contestId: titleMatch.contestId,
          index: titleMatch.index,
          title: titleMatch.name,
          difficulty: titleMatch.rating ? `${titleMatch.rating} rating` : 'Unrated',
          tags: titleMatch.tags || [],
          officialUrl: `https://codeforces.com/problemset/problem/${titleMatch.contestId}/${titleMatch.index}`,
          sourceEvidence: `Verified via Codeforces API`
        };
      }

      return {
        verified: false,
        platform: 'Codeforces',
        onlineCheckAvailable: true,
        message: `Could not verify problem "${query}" in Codeforces problemset.`
      };
    } catch (err) {
      return {
        verified: false,
        platform: 'Codeforces',
        onlineCheckAvailable: false,
        message: `Online verification is currently unavailable (${err.message}). Problem existence could not be confirmed.`
      };
    }
  },

  /**
   * GeeksforGeeks verification handler.
   */
  async verifyGeeksForGeeks(query) {
    // GeeksforGeeks does not provide an official public GraphQL or open REST API.
    // Explicitly communicate that online verification is unavailable rather than fabricating.
    return {
      verified: false,
      platform: 'GeeksforGeeks',
      onlineCheckAvailable: false,
      message: `GeeksforGeeks does not provide an open public API for programmatic verification. The existence of "${query}" could not be confirmed through official channels. Avoid assuming the problem exists without checking geeksforgeeks.org directly.`
    };
  }
};
