# Domain & Data Feasibility Checklist

Use this checklist for every project, AI or not. It covers whether the design actually solves the problem it claims to, and whether the data model will survive contact with reality.

## 1. Does the metric measure what it claims to measure?

**Question:** If the system calculates a score, recommendation, or metric, does it actually reflect the real-world concept it's supposed to represent?

**What to look for:**
- A "progress" score that only tracks quantity (questions answered) but not quality (did they get them right?)
- A "relevance" score that only looks at keyword matching, not semantic meaning
- A "readiness" metric that ignores critical dependencies or prerequisites

**Why this matters:** Users trust metrics to mean what they say. If a metric claims to measure "mastery" but only counts repetitions, users will be misled.

**Fix:** Define what the metric should actually represent in the real world, then check if the calculation captures that. If not, rename it (e.g., "completion" instead of "mastery") or fix the calculation.

## 2. Edge cases in the real workflow

**Question:** Does the design assume a "happy path" that real users won't follow?

**What to look for:**
- Assuming users complete a flow in one session (what if they close the tab halfway?)
- Assuming users have stable network (what if they go offline mid-flow?)
- Assuming users follow steps in order (what if they skip, go back, or retry?)
- Assuming users provide valid input (what if they leave fields empty, paste garbage, or intentionally break things?)

**Why this matters:** Real users don't follow the happy path. They interrupt flows, lose network, make mistakes, and try unexpected things. If the design only works for the happy path, it will break in production.

**Fix:** Walk through the flow from the user's perspective and ask "what if they..." at every step. Add handling for the most common edge cases (session loss, network failure, invalid input).

## 3. Data model durability

**Question:** If requirements change or scale increases, will the data model need a painful migration?

**What to look for:**
- Hard-coded enums or categories that will need to grow (e.g., "beginner/intermediate/advanced" when the real taxonomy has 10 levels)
- Missing foreign keys or relationships (e.g., a "quiz" table with no link to "topics" when every quiz will eventually need to be tagged)
- No versioning or audit trail (e.g., no way to tell when a record was created, updated, or by whom)
- Denormalized data with no strategy for keeping it in sync (e.g., caching a user's "total score" in multiple places with no update logic)

**Why this matters:** Data models are expensive to change after launch. A schema that works for the MVP can become a nightmare at scale or when requirements evolve.

**Fix:** Design the schema for the *likely* next version of requirements, not just the current MVP. Add versioning/timestamps early (cheap to add now, painful to retrofit). Keep denormalized data to a minimum, or have a clear update strategy.

## 4. Timeline & scope realism

**Question:** Given the time, team, and resources available, is the scope actually achievable?

**What to look for:**
- A two-week deadline with a feature list that would take two months
- A solo developer attempting a multi-service architecture with complex orchestration
- A course project that requires infrastructure (auth, payment, scaling) that's out of scope
- A "must-have" feature list with no prioritization (everything is critical)

**Why this matters:** Unrealistic scope leads to rushed implementations, cut corners, and features that don't actually work. Better to ship a smaller, solid feature set than a half-broken ambitious one.

**Fix:** Prioritize ruthlessly. Identify the *core* value proposition and what's actually required for the demo/deadline. Everything else is nice-to-have. Cut or defer features that aren't load-bearing.

## 5. Business rule consistency

**Question:** Are the business rules consistent across the system, or do they contradict each other?

**What to look for:**
- A rule that says "users must complete topic A before topic B" but no enforcement in the UI or database
- A scoring rule that says "wrong answers don't penalize" but a leaderboard that ranks by "net score" (right - wrong)
- A privacy rule that says "data is deleted after 30 days" but no scheduled job to actually delete it

**Why this matters:** Inconsistent business rules create bugs that are hard to diagnose. Users see one behavior in the UI but a different one in the backend.

**Fix:** Document the business rules in one place (a spec, a CLAUDE.md section, or a code comment). Then check that every part of the system (UI, backend, database constraints) enforces them consistently.

## 6. Dependency on external data

**Question:** Does the system depend on external data sources (APIs, files, user uploads) that could be unavailable, outdated, or wrong?

**What to look for:**
- A feature that requires data from a third-party API with no fallback
- A recommendation engine that depends on "current trends" but no strategy for when the trend data is stale
- A quiz generator that assumes a corpus of questions exists, with no handling for when the corpus is empty or low-quality

**Why this matters:** External dependencies fail. If the system has no fallback or degraded mode, the entire feature breaks when the dependency is unavailable.

**Fix:** Add fallback behavior (cached data, default values, manual entry flow). At minimum, detect when the dependency is unavailable and show a clear message to the user.

## 7. User expectations vs. actual behavior

**Question:** Does the design match what users will actually expect, or will it surprise them in a bad way?

**What to look for:**
- A "save" button that doesn't actually save until you click another "submit" button
- A "delete" action that's not actually reversible, even though most apps make delete reversible
- A "recommended for you" section that shows the same items every time because there's no personalization
- A "progress" bar that jumps backward when you get a question wrong

**Why this matters:** Users have learned expectations from other apps. If your app violates those expectations without a good reason, it will feel broken even if it technically works.

**Fix:** Walk through the UX from the user's perspective. At every interaction, ask "what would a user expect to happen here?" If the actual behavior is different, either change it to match expectations or add explicit messaging to set different expectations.

## Summary

The checklist above focuses on feasibility and realism:
1. **Does the metric measure what it claims to measure?** — avoid misleading names for scores/metrics
2. **Edge cases in the real workflow** — users don't follow the happy path
3. **Data model durability** — will the schema survive the next version of requirements?
4. **Timeline & scope realism** — is the plan achievable given time/team/resources?
5. **Business rule consistency** — are rules enforced consistently across the system?
6. **Dependency on external data** — what happens when external sources fail?
7. **User expectations vs. actual behavior** — does the UX match what users expect?

Walk through each dimension for any project, AI or not.
