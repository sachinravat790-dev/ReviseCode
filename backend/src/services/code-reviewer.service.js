/**
 * Code Reviewer Service: Validates user coding solutions across C++, JavaScript, Python, SQL.
 * Checks syntax via real compilers (clang++, node, python3) where available,
 * analyzes logic & edge cases, and provides transparent verification status.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export const codeReviewerService = {
  /**
   * Detects if a text prompt contains a code solution or snippet.
   */
  hasCodeSnippet(text = '') {
    if (!text || typeof text !== 'string') return false;
    const hasFencedBlock = /```(?:cpp|c\+\+|js|javascript|py|python|java|sql)?[\s\S]*?```/i.test(text);
    const hasFunctionSignature = /(?:int|void|bool|double|string|def|function|class)\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{?/i.test(text);
    const hasIncludeOrImport = /(?:#include\s*<[a-z]+>|import\s+[a-z]+|from\s+[a-z]+\s+import)/i.test(text);
    return hasFencedBlock || (hasFunctionSignature && text.length > 50) || hasIncludeOrImport;
  },

  /**
   * Extracts code and language from text.
   */
  extractCode(text = '') {
    const fencedMatch = text.match(/```(cpp|c\+\+|js|javascript|py|python|java|sql)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      let lang = (fencedMatch[1] || '').toLowerCase();
      if (lang === 'c++') lang = 'cpp';
      if (lang === 'js') lang = 'javascript';
      if (lang === 'py') lang = 'python';

      return {
        code: fencedMatch[2].trim(),
        language: lang || this.inferLanguage(fencedMatch[2])
      };
    }

    return {
      code: text.trim(),
      language: this.inferLanguage(text)
    };
  },

  inferLanguage(code = '') {
    if (/#include\s*<|std::|vector<|cout\s*<<|int\s+main\s*\(/i.test(code)) return 'cpp';
    if (/def\s+[a-zA-Z0-9_]+\s*\(|:\s*\n\s+|print\s*\(/i.test(code)) return 'python';
    if (/const\s+|let\s+|var\s+|console\.log|function\s*\(/i.test(code)) return 'javascript';
    if (/public\s+class|System\.out\.println/i.test(code)) return 'java';
    if (/SELECT\s+.*FROM|CREATE\s+TABLE|INSERT\s+INTO/i.test(code)) return 'sql';
    return 'unknown';
  },

  /**
   * Runs syntax check using local compiler or runtime when available.
   */
  async checkSyntax(code, language) {
    if (language === 'cpp') {
      return await this.checkCppSyntax(code);
    }
    if (language === 'javascript') {
      return await this.checkJsSyntax(code);
    }
    if (language === 'python') {
      return await this.checkPythonSyntax(code);
    }
    return {
      supported: false,
      status: 'unsupported_language',
      message: `Syntax compilation not configured for ${language}. Relying on static reasoning.`
    };
  },

  async checkCppSyntax(code) {
    let fullCode = code;
    // Add common includes if missing for snippet check
    if (!fullCode.includes('#include')) {
      fullCode = `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n#include <climits>\nusing namespace std;\n\n${code}`;
    }

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `revisecode_test_${Date.now()}_${Math.random().toString(36).substring(7)}.cpp`);

    try {
      await fs.writeFile(tmpFile, fullCode, 'utf8');
      await execFileAsync('clang++', ['-fsyntax-only', '-std=c++17', tmpFile], { timeout: 3000 });
      await fs.unlink(tmpFile).catch(() => {});
      return {
        supported: true,
        passed: true,
        status: 'syntax_valid',
        message: 'Clang++ syntax and type check passed with 0 errors (-std=c++17).'
      };
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {});
      // Extract clean error
      const cleaned = (err.stderr || err.message || '')
        .split('\n')
        .filter(l => !l.includes(tmpFile) && l.trim())
        .join('\n');
      return {
        supported: true,
        passed: false,
        status: 'syntax_error',
        errorDetails: cleaned || err.message,
        message: 'Clang++ compiler reported syntax/type errors in C++ snippet.'
      };
    }
  },

  async checkJsSyntax(code) {
    try {
      new Function(code);
      return {
        supported: true,
        passed: true,
        status: 'syntax_valid',
        message: 'JavaScript syntax parsed cleanly with 0 syntax errors.'
      };
    } catch (err) {
      return {
        supported: true,
        passed: false,
        status: 'syntax_error',
        errorDetails: err.message,
        message: `JavaScript Syntax Error: ${err.message}`
      };
    }
  },

  async checkPythonSyntax(code) {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `revisecode_py_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);

    try {
      await fs.writeFile(tmpFile, code, 'utf8');
      await execFileAsync('python3', ['-m', 'py_compile', tmpFile], { timeout: 3000 });
      await fs.unlink(tmpFile).catch(() => {});
      return {
        supported: true,
        passed: true,
        status: 'syntax_valid',
        message: 'Python syntax compiled cleanly with 0 syntax errors.'
      };
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {});
      return {
        supported: true,
        passed: false,
        status: 'syntax_error',
        errorDetails: err.stderr || err.message,
        message: 'Python syntax compilation reported errors.'
      };
    }
  },

  /**
   * Static analysis of common DSA pitfalls and edge cases.
   */
  analyzeCommonBugs(code, language) {
    const findings = [];

    // 1. Integer overflow in binary search: (low + high) / 2
    if (/\(\s*(?:low|left|l)\s*\+\s*(?:high|right|r)\s*\)\s*\/\s*2/i.test(code)) {
      findings.push({
        type: 'integer_overflow',
        severity: 'high',
        title: 'Integer Overflow Risk in Midpoint Calculation',
        description: 'Using `(low + high) / 2` causes 32-bit signed integer overflow when `low + high > 2,147,483,647` (INT_MAX), causing a negative index and crash.',
        recommendation: 'Change to `low + (high - low) / 2` (or in C++20 `std::midpoint(low, high)`).'
      });
    }

    // 2. Binary search infinite loop: high = mid inside while (low <= high) or low = mid
    if (/(?:while|for)\s*\([^)]*(?:low|left|l)\s*<\s*(?:high|right|r)[^)]*\)[\s\S]*?(?:low|left|l)\s*=\s*mid\s*;/i.test(code)) {
      findings.push({
        type: 'infinite_loop',
        severity: 'high',
        title: 'Infinite Loop Risk in Binary Search',
        description: 'Setting `low = mid` without `mid + 1` causes an infinite loop when `high - low == 1` because integer division truncates downwards.',
        recommendation: 'Use `low = mid + 1` for strict inequality or adjust midpoint rounding.'
      });
    }

    // 3. Off-by-one in array iteration: for (int i = 0; i <= n; i++)
    if (/for\s*\(\s*int\s+[a-z]\s*=\s*0\s*;\s*[a-z]\s*<=\s*(?:[a-zA-Z0-9_]+\.size\(\)|[a-zA-Z0-9_]+\.length|n)\s*;/i.test(code)) {
      findings.push({
        type: 'off_by_one',
        severity: 'medium',
        title: 'Potential Off-By-One Array Out-of-Bounds',
        description: 'Loop condition uses `<=` with 0-based size/length, accessing index `size` which is past the valid array bounds.',
        recommendation: 'Use `<` instead of `<=` for 0-indexed boundaries.'
      });
    }

    // 4. Floating point comparison == in C++
    if (language === 'cpp' && /[a-zA-Z0-9_]+\s*==\s*[0-9]+\.[0-9]+/i.test(code)) {
      findings.push({
        type: 'float_precision',
        severity: 'medium',
        title: 'Exact Float Equality Comparison',
        description: 'Comparing floating-point values using `==` frequently fails due to IEEE 754 precision inaccuracies.',
        recommendation: 'Compare difference against an epsilon, e.g. `fabs(a - b) < 1e-9`.'
      });
    }

    return findings;
  },

  /**
   * Generates a comprehensive code review response with transparent verification levels.
   */
  async reviewSolution(rawText) {
    const { code, language } = this.extractCode(rawText);
    const syntax = await this.checkSyntax(code, language);
    const bugs = this.analyzeCommonBugs(code, language);

    return {
      language,
      code,
      syntax,
      bugs,
      hasBugs: bugs.length > 0 || (syntax.supported && !syntax.passed),
      verificationNotice: 'Static Reasoning & Compiler Syntax Review (This code has not been submitted to an online judge against hidden test vectors).'
    };
  }
};
