---
name: simplify-code
description: Streamlines over-engineered components, flattens deep nested blocks, eliminates dead code, and reduces complex logic abstractions to clean, readable code.
when_to_use: "Use when code contains high cyclomatic complexity, deep nesting, confusing logical expressions, or excessive, unnecessary abstractions."
---

# Code Simplification & Refactoring Skill

This skill outlines guidelines for reducing code complexity, eliminating over-engineering, and improving code maintainability without changing its functional behavior.

---

## 🛑 Rule of Simplicity

Always choose the simplest path that is correct and readable. Avoid premature abstraction:
- **No Over-Engineering:** Do not create general classes, generic functions, or multi-layered abstractions for simple, single-use logic.
- **Self-Documenting Code:** Write clean variable and function names so that the code speaks for itself. Comments should explain *why* something is done, not *what* the code does.

---

## 🥞 Flatten Nested Structures

Deep nesting (indentation levels of 3 or more) is hard to read and scan. Flatten nested blocks using these techniques:
1. **Guard Clauses / Early Returns:** Return early on errors or special conditions to avoid wrapping the primary logic in large `if` statements.
2. **Helper Functions:** If a block within a loop or condition contains more than 10 lines of distinct logic, extract it into a small, focused private helper function.

### Nested (Bad)
```typescript
function processUser(user) {
    if (user !== null) {
        if (user.isActive) {
            if (user.hasPermission) {
                // Core logic here...
            }
        }
    }
}
```

### Flat (Good)
```typescript
function processUser(user) {
    if (!user || !user.isActive || !user.hasPermission) return;
    
    // Core logic here...
}
```

---

## 🗑️ Dead Code & Redundancy Clean-up

Always clean up unused logic:
- **Remove Commented-out Code:** Do not leave old blocks of commented-out code in files. Trust Git history for backup.
- **Remove Unused Imports & Variables:** Audit imports and local variables before completing any task.
- **Consolidate Duplicate Expressions:** If an expression is repeated multiple times, extract it to a local const variable.
