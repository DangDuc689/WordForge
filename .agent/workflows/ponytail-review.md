---
description: Review code diffs strictly for over-engineering, unnecessary abstractions, and complexity bloat.
---

# /ponytail-review — Hunt Over-Engineering

$ARGUMENTS

---

## Instructions

Activate the `ponytail-review` skill to review diffs and files specifically for complexity and over-engineering.

### Review Focus:
- Reinvented standard library / platform features.
- Speculative abstractions (classes/interfaces with only 1 implementation).
- Dead flexibility or unused configs.
- Unnecessary dependencies.

### Output Format (1 line per finding):
`L<line>: <tag> <what>. <replacement>.`

Tags: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`
