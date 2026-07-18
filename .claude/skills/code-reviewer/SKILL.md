---
name: code-reviewer
description: Conducts thorough code reviews focusing on logic correctness, performance, security best practices (OWASP), clean code architecture, and visual aesthetics.
when_to_use: "Use when reviewing code changes, pull requests, refactoring candidates, or auditing UI designs and security settings."
---

# Code Review & Audit Checklist

When reviewing code, pull requests, or design files, use this multi-tiered audit protocol to identify logic issues, performance bottlenecks, security vulnerabilities, and visual non-compliance.

---

## 🧹 TIER 1: Clean Code & Architecture

Verify that the code is readable, maintainable, and follows dry-principles:
- **Simplicity:** Ensure no unnecessary abstractions or over-engineered patterns.
- **Naming Conventions:** Variables, functions, and files must be self-documenting and match repository conventions.
- **Formatting & Types:** Ensure complete TypeScript declarations, no fallback `any` types, and proper formatting.
- **Dependency Blast Radius:** Check how changes affect other files in the codebase (cross-reference the main system structure).

---

## 🔒 TIER 2: Security & OWASP Standards

Scan the changes for security weaknesses:
- **Secrets & Credentials:** Ensure no hardcoded passwords, tokens, API keys, or private files are staged.
- **Input Validation:** Prevent SQL injection, Cross-Site Scripting (XSS), and Remote Code Execution (RCE) by sanitizing inputs.
- **Authentication/Session Security:** Check that session cookies, tokens, and storage permissions conform to modern secure practices.

---

## 🚀 TIER 3: Performance & Core Web Vitals

Analyze code efficiency:
- **Complexity:** Identify nested loops ($O(N^2)$), expensive operations, or redundant API fetches.
- **React/Next.js Optimizations:** Look out for redundant rendering waterfalls, state recalculations (use `useMemo` where appropriate), or massive bundles.
- **Database Queries:** Check for $N+1$ queries, missing database indices, or unoptimized JOIN statements.

---

## 🎨 TIER 4: Design, UI & Accessibility (UX Audit)

For all user interface (UI) changes, perform a visual and user experience sanity check:
- **Harmonious Color Palette:** Avoid generic primary colors (e.g., pure red `#FF0000` or blue `#0000FF`). Use subtle HSL tailored colors.
- **Color Restrictions (Purple Ban):** Do NOT introduce or use pure violet, purple, or deep lavender colors unless specifically requested by the user.
- **Contrast & Accessibility (WCAG AA):** Check that text and background color contrasts are readable (minimum 4.5:1 ratio).
- **Interactive Micro-animations:** Ensure hover and active states exist for interactive components with smooth transitions (e.g., `transition: all 0.2s ease-in-out`).
- **Device Responsiveness:** Verify layout adaptability on mobile, tablet, and desktop views.
- **Typography:** Ensure a premium modern font is utilized (e.g., Inter, Outfit) instead of default browser fallbacks.
