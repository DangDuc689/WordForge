---
name: git-workflow
description: Standardizes Git commands, commit messages (Conventional Commits), branching, and PR creation.
when_to_use: "Use when creating a new Git branch, staging files, drafting commit messages, preparing pull requests, or squash merging."
---

# Git Workflow Automation Skill

This skill assists you in maintaining a clean, descriptive, and highly professional Git history in full compliance with team standards.


## 🛡️ Git Safety Rules

This skill must respect the user's explicit intent and Claude Code's Git safety protocol.

- Do **not** create commits unless the user explicitly asks to commit.
- Do **not** push, force-push, merge, rebase, squash, delete branches, or open/close pull requests unless explicitly requested.
- Do **not** run destructive Git commands such as `git reset --hard`, `git clean`, `git checkout -- <path>`, or branch deletion unless the user clearly authorizes that exact action.
- Prefer staging specific files by path instead of broad commands like `git add .` or `git add -A`.
- Before drafting a commit or PR, inspect `git status`, relevant diffs, and recent commit style.
- If hooks fail, fix the underlying issue instead of bypassing them with `--no-verify`.
- When uncertain whether a Git action affects shared state or user work, ask for confirmation first.

---

## 📋 Git Branch Naming Convention

Always name branches using the kebab-case pattern with one of the following prefixes:

- `feature/` - For new features (e.g., `feature/login-page`)
- `bugfix/` - For bug fixes (e.g., `bugfix/auth-token-leak`)
- `hotfix/` - For critical production hotfixes (e.g., `hotfix/payment-gateway-crash`)
- `docs/` - For documentation changes (e.g., `docs/api-guide`)
- `refactor/` - For code refactoring without behavior change (e.g., `refactor/optimize-imports`)
- `chore/` - For build systems, dependency updates, or internal tools (e.g., `chore/bump-deps`)

---

## ✍️ Conventional Commits Guide

Every commit message must follow the Conventional Commits specification:

```plaintext
<type>(<scope>): <description>

[body]

[footer(s)]
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

### Examples
- `feat(auth): add OAuth2 provider logic for Google login`
- `fix(db): resolve migration deadlock when scaling workers`
- `docs(readme): update deployment instructions for AWS ECS`
- `style(components): re-align grid columns on user profile dashboard`

---

## 📨 Pull Request Template Generator

When asked to draft a Pull Request description, use the following Markdown template to populate the description. Only create the Pull Request if the user explicitly asks you to do so:

```markdown
# 🚀 Pull Request

## 📝 Overview
<!-- Provide a brief description of the goal and impact of these changes. -->

## 🛠️ Proposed Changes
<!-- Detailed bullet points describing what was changed and why. -->
- 
- 

## 🚨 Breaking Changes / Critical Points
<!-- Mention any breaking changes or critical database/config migrations here. -->
> [!NOTE] / [!WARNING]
> 

## ✅ Verification Checklist
<!-- How was this tested? Provide commands, screenshots, or logs. -->
- [ ] Unit Tests: `npm run test` / `pytest`
- [ ] Linting & Type-checking: `npm run lint` / `tsc`
- [ ] Manual Audit: Visual validation on responsive viewports
```

---

## 🛠️ Helpful Commands

```bash
# Preview merged branches locally before deleting anything
git branch --merged | grep -v "\*" | grep -v "main" | grep -v "master"

# Show formatted graphical commit history
git log --graph --oneline --decorate --all -n 15
```
