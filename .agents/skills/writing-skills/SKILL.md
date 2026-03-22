---
name: writing-skills
description: Use when creating new skills, editing existing skills, or establishing reusable patterns and techniques for future use.
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (compliance), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools. Skills help future instances find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides

**Skills are NOT:** Narratives about how you solved a problem once

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in project docs)

## Skill Types

### Technique
How to apply a specific method. Has clear steps, before/after, verification.

### Pattern
Mental model for decisions. Has decision criteria, trade-offs, examples.

### Reference
API docs, syntax guides, configuration references. Heavy factual content.

## Directory Structure

```
.agents/
  skills/
    skill-name/
      SKILL.md              # Main reference (required)
      supporting-file.*     # Only if needed
```

**Flat namespace** — all skills searchable

**Separate files for:**
1. Heavy reference (100+ lines) — API docs, comprehensive syntax
2. Reusable tools — Scripts, utilities, templates

**Keep inline:**
- Principles and concepts
- Code patterns (< 50 lines)
- Everything else

## SKILL.md Structure

**Frontmatter (YAML):**
- Only two fields: `name` and `description`
- `name`: Use letters, numbers, and hyphens only
- `description`: Describes ONLY when to use (NOT what it does). Start with "Use when..."

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
Bullet list with SYMPTOMS and use cases
When NOT to use

## Core Pattern (for techniques/patterns)
Before/after code comparison

## Quick Reference
Table or bullets for scanning

## Common Mistakes
What goes wrong + fixes

## Integration
Related skills and when to chain them
```

## Key Principles

- **Concise over comprehensive** — Agent context is precious
- **Triggers over process** — Description says WHEN, body says HOW
- **Tables over prose** — Faster to scan
- **Loophole closing** — Address every rationalization
- **Integration** — Reference related skills

## Skill Creation Checklist

- [ ] Clear name with hyphens
- [ ] Description starts with "Use when..."
- [ ] Overview states core principle in 1-2 sentences
- [ ] When to Use includes triggering conditions
- [ ] Common rationalizations addressed
- [ ] Related skills referenced
- [ ] Saves to `.agents/skills/<name>/SKILL.md`

## The Bottom Line

Skills are reusable, composable documentation that makes your agent better at recurring tasks. Write them when you discover a pattern worth preserving. Keep them focused, scannable, and honest about when they apply.
