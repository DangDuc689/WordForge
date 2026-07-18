---
name: system-design-review
description: "Review a project's system design, architecture, and real-world feasibility, not code syntax or line-level bugs. Use whenever the user wants a second opinion on whether a design will actually hold up, especially when an AI/LLM API call (Gemini, OpenAI, etc.) generates content, a roadmap, or recommendations that get saved and trusted downstream with little checking. Trigger for 'review kiến trúc dự án', 'review thiết kế', 'đánh giá tính khả thi', 'sao thấy dự án này chưa ổn', 'does this design make sense', 'is this AI pipeline safe to build on', or whenever the user pastes a spec, README, or PROJECT_CONTEXT.md and asks for a critical look, even without the word architecture. Also use after a feature is built, to audit whether the design was sound, since working code can still rest on a flawed decision. Complementary to line-level code-review skills (syntax, SOLID, security on a diff); this one evaluates decisions, data flow, and dependency risk, for any project, not one specific codebase."
---

# System Design Review

## Why this is a different job than code review

Code review asks: *is this code well-written?* Design review asks: *is this decision going to work?*

A project can have spotless code — clean functions, no SOLID violations, no SQL injection — and still fail in production, embarrass its owner in a demo, or quietly produce garbage for users, because the underlying **decision** was flawed. The classic failure pattern that motivates this skill: a system makes one AI API call to generate something important (a learning roadmap, a set of quiz questions, a diagnosis suggestion, a recommendation), saves the result straight to the database, and trusts it completely from then on. Every line of code in that pipeline can be clean and still the system is fragile, because nothing ever checks whether the AI's output was actually any good.

Design review exists to catch that class of problem *before* it ships, or to explain *why* a shipped project turned out weaker than expected even though "the code worked."

## When to reach for this

- **Before implementation** — sanity-check a plan or spec while it's still cheap to change.
- **After a feature is built** — audit whether the design will cause real problems even though the code runs fine, especially useful when revisiting a past project to understand what went wrong.
- **Any time an AI/LLM call sits in the core flow** — content generation, roadmaps, recommendations, scoring, extraction. This is the highest-leverage place to look.
- **Before defending or presenting a project** — to find where a critical reviewer would poke first.

## How to run a review

**Step 1 — Gather context.** Ask for or read whatever describes the design: a spec, README, PROJECT_CONTEXT.md, a diagram, or just a plain-language walkthrough of the data flow. Full codebase access is not required — a clear description of the critical decisions and data flow is usually enough. If the user only gives a vague one-liner ("review kiến trúc dự án mình đi"), ask them to paste the flow or point to the relevant files before writing the report; don't guess at a design that hasn't been described.

**Step 2 — Map the critical path.** Identify which components are *load-bearing*: if this piece fails, misbehaves, or returns something unexpected, what actually breaks downstream? Spend disproportionate attention here. A messy CSS file matters far less than an AI call whose malformed output silently corrupts every user's data with no way to recover.

**Step 3 — Interrogate every external dependency.** For each AI API call, third-party service, or write of AI/user-generated content, ask one question: *"What happens when this returns something empty, malformed, wrong, or just delayed?"* This single question surfaces most fatal design flaws fast. If the honest answer is "nothing checks it, it just gets used" — that's a critical finding.

**Step 4 — Walk the review dimensions below**, using judgment about depth. A simple CRUD feature might need two minutes on data feasibility and nothing else. A project whose core value proposition depends on an AI call deserves the full pipeline checklist. Don't force every dimension onto every project — that produces bloated, low-signal reports.

**Step 5 — Write the report** using the format in "Output format" below.

## Review dimensions

### A. AI/LLM pipeline soundness
Applies whenever an AI/LLM API call sits anywhere in the core flow. Load `references/ai-pipeline-checklist.md` for the full checklist — covers single-point-of-failure generation, output validation, fallback behavior, human-in-the-loop gating, trust boundaries, cost/quota blast radius, and prompt/content versioning.

### B. Domain & data feasibility
Applies to every project, AI or not. Load `references/domain-feasibility-checklist.md` for the full checklist — covers whether business rules actually measure what they claim, edge cases in the real workflow, data model durability, and timeline/scope realism.

### C. Architecture & coupling
- Is failure isolated to one component, or does it cascade through the system?
- Is the scale of the design matched to actual expected usage — watch for both over-engineering (unnecessary complexity for a course project or 50-user MVP) and under-engineering (a critical path with no redundancy at all)?
- Are integration points (external APIs, third-party services) isolated enough to mock, swap, or disable without a rewrite? (A good sign: the user already had to disable one integration for a demo and it was easy. A bad sign: disabling it meant faking data throughout the stack.)
- Is state managed coherently, or does the same fact live in multiple places that can drift out of sync?

### D. Product reality check
- Does the plan match what will actually ship and be demoed? Watch specifically for silent mismatches — e.g., a spec that still describes a feature as fully working after a "demo pivot" quietly disabled it.
- Is the scope realistic for the time and team actually available?
- Would a real user's actual behavior break an assumption baked into the design (e.g., assuming users always finish a flow in one sitting, always have good network, never retry)?

### E. Defense-readiness (most relevant for academic/capstone projects, skip for others)
- What's the first question a skeptical evaluator or code reviewer would ask?
- Does the team have a genuinely good answer, or does the design paper over the weak spot?
- Are there choices made purely for demo convenience (like disabling a feature) that need to be disclosed and explained rather than hidden?

## Output format

Match the language the user is writing in — default to Vietnamese when the user writes in Vietnamese, matching how they naturally talk about their project. Use this structure:

```markdown
# Đánh giá thiết kế: [tên dự án/tính năng]

## Tóm tắt nhanh
[1–2 câu: về tổng thể thiết kế có ổn không, có lỗ hổng cấu trúc hay chỉ là những điểm cần tinh chỉnh]

## Điểm mạnh
- [Những quyết định thiết kế thực sự hợp lý — đừng bỏ qua phần này, một thiết kế có thể vừa có điểm mạnh vừa có rủi ro]

## 🔴 Rủi ro nghiêm trọng
[Với mỗi rủi ro:]
**[Tên ngắn gọn]**
- Vấn đề: ...
- Vì sao nguy hiểm: ...
- Hậu quả cụ thể nếu không sửa: ...
- Hướng khắc phục: ...

## 🟡 Nên cải thiện
[Cùng cấu trúc, mức độ nhẹ hơn]

## 🟢 Có thể cân nhắc
[Nice-to-have hoặc tranh cãi được — nêu rõ đánh đổi hai chiều]

## Câu hỏi nên chuẩn bị trả lời
[Chỉ thêm mục này nếu là đồ án/báo cáo học thuật — danh sách câu hỏi phản biện có khả năng cao sẽ bị hỏi]
```

## Writing guidance

- **Be concrete.** Point to the specific mechanism ("roadmap được lưu thẳng vào DB ngay sau 1 lần gọi Gemini, không có bước validate schema hay range check") rather than vague language ("nên robust hơn").
- **Explain why, not just what.** State the failure mode and its real consequence, not just "this is risky."
- **Don't manufacture severity.** If a design is genuinely solid, say so clearly. A report that calls everything "critical" is as useless as one that finds nothing — the goal is to help the person spend their limited time on what actually matters.
- **Prioritize ruthlessly.** Most reviews should surface 2–4 truly critical findings, not twenty. If the list is long, that itself is a signal the design needs a rework, not more nitpicks.
- **Acknowledge constraints.** A student project with a two-week deadline and a project with a dedicated engineering team don't get held to the same bar — factor in what's realistic, and say so explicitly when a "critical" issue for production is actually acceptable for the context at hand.

## Relationship to code-level review

If the user wants line-level bug, security, or style checking on a `git diff`, that's a different job — hand that off to a code-review skill instead. This skill's job is the layer above the code: the decisions, the data flow, and what happens when a dependency misbehaves.
