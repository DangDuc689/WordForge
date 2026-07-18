---
name: project-planning
description: Outlines architectural planning and Socratic execution workflows to analyze user requests, break down tasks with verifiable inputs/outputs, and outline file structures.
when_to_use: "Use when starting new features, creating plans, establishing architectures, or designing major system integrations."
---

# Project Planning & Architecture Skill

Use this planning methodology before writing source code for any new feature, integration, or refactoring task.

---

## 🛑 Phase 0: Socratic Gate (Discovery)

Before writing any code or proposing solutions, always ask 1-3 strategic questions if requirements or constraints are unclear:
- **Purpose:** What exact business goal or problem are we solving?
- **Users:** Who will interact with this component, and what is their happy-path flow?
- **Scope & Stack:** What are the must-have features vs nice-to-have, and are there tech stack constraints?

---

## 📐 Phase 1: Architectural Design

Map out how the system should function:
1. **Component Mapping:** Group components logically (e.g., frontend components, database tables, api endpoints, state store).
2. **Data Flow & Abstractions:** How does data enter the system, transform, and exit? What interfaces/types are needed?
3. **File Layout:** Propose a directory structure indicating where new and modified files will reside.

---

## 📝 Phase 2: Verifiable Task Breakdown

Break down the plan into small, sequential tasks (ideally 2-10 minutes each) that can be easily tested and reverted. Each task must specify:
- **`task_id` / Name:** A descriptive name.
- **Dependencies:** What must be completed first? (e.g., DB Schema must exist before API endpoint).
- **Input:** What is required to start?
- **Output:** What is the concrete result of this task?
- **Verify:** How can the user or an automated test verify that the task was done correctly? (Provide exact terminal commands or visual inspection details).

---

## 🧪 Phase 3: Final Verification Checklist

Define a comprehensive definition-of-done checklist to run after all tasks are completed:
- **Compilation / Build:** Does the project build successfully without errors or warnings (`npm run build`, `tsc --noEmit`)?
- **Tests & Quality:** Do all new and existing tests pass (`npm run test`)?
- **Security Check:** Verify no private credentials or unvalidated inputs are left behind.
- **UX Validation:** Check responsive visual styling, contrast compliance, and smooth transitions on active UI elements.
