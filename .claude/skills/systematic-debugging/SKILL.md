---
name: systematic-debugging
description: Implements a 4-phase systematic debugging framework for analyzing errors, tracing root causes, and implementing verified fixes.
when_to_use: "Use when addressing application errors, failing tests, unexpected behavior, system crashes, or logical inconsistencies."
---

# Systematic Debugging Framework

When analyzing a bug or a failing test, do not jump directly to changing lines of code. Follow this 4-phase systematic debugging methodology to ensure you understand the root cause and write robust, regression-free fixes.

---

## 🔍 Phase 1: Information Gathering & Discovery

Acknowledge the issue and gather all available evidence before proposing any changes:
1. **Analyze Error Logs / Stack Traces:** Identify exactly where the exception was thrown (file name, line number, and stack frame).
2. **Review Code Around the Blast Radius:** Read the surrounding 50 lines of code to understand the local variables, state flow, and execution path.
3. **Trace Inputs & State:** What are the arguments passed into the failing function? What is the current database or state configuration?

---

## 🧪 Phase 2: Hypothesis & Root Cause Analysis

Formulate and document clear hypotheses about the root cause:
- **What went wrong?** (e.g., "The API response was undefined because of a network timeout, which caused `response.data` to throw a TypeError").
- **Why did it go wrong?** (e.g., "No default fallback structure was provided for failed network requests").
- **State the Evidence:** Point directly to the lines of code or log output supporting your hypothesis.

---

## 🛠️ Phase 3: Implementing & Verifying the Fix

Draft a targeted fix adhering to the following rules:
1. **Target the Root Cause:** Fix the actual source of the problem, not just the symptom (avoid wrapping everything in silent try-catch blocks without error handling).
2. **Minimal Invasiveness:** Change the minimum amount of code necessary to solve the issue without breaking existing functionality.
3. **Verify by Execution:** 
   - Propose commands to compile/run the application or execute the test suite (e.g., `npm run test`, `npm run dev`).
   - Confirm that the error is resolved and no regressions were introduced.

---

## 📝 Phase 4: Retro & Regression Prevention

Once the fix is validated, prevent the bug from occurring again:
- **Write a Unit Test:** Draft a test case that replicates the failure state and proves the new code handles it properly.
- **Edge Case Check:** Consider other areas of the codebase using the same module or pattern. Ensure they are safe.
- **Update Documentation:** If the fix involves a config file change or api change, update any relevant `README.md` or comments.
