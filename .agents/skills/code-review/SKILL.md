---
name: code-review
description: Use when reviewing code changes - between tasks, before commits, before PRs, or when receiving feedback on your code. Covers both requesting and receiving code review.
---

# Code Review

## Overview

Code review is quality assurance, not nitpicking. Review against the plan, report issues by severity.

**Core principle:** Catch issues early, fix them now. Critical issues block progress.

## Requesting Code Review

### Pre-Review Checklist

Before requesting review, verify:

- [ ] All tests pass (fresh run, not cached)
- [ ] No linter warnings or errors
- [ ] Build succeeds
- [ ] Code matches the plan specification
- [ ] No debugging artifacts (console.logs, TODOs, commented-out code)
- [ ] Commit messages are descriptive
- [ ] No unrelated changes included

### What to Include

Provide reviewers with:
1. **Context** — What problem does this solve?
2. **Changes** — Summary of what changed and why
3. **Testing** — What was tested and how
4. **Concerns** — Anything you're unsure about

### Review Format

```markdown
## Code Review Request

**Ticket/Feature:** [description]
**Files Changed:** [list]
**Tests:** [pass/fail count]

### Changes
- [Summary of each change]

### Testing Done
- [What was verified]

### Concerns
- [Anything uncertain]
```

## Performing Code Review

### Review Priorities

Review in this order:

1. **Correctness** — Does it do what it should?
2. **Completeness** — Are all requirements met?
3. **Edge Cases** — What about errors, nulls, empty states?
4. **Performance** — Any obvious bottlenecks?
5. **Readability** — Can someone else understand this?
6. **Style** — Consistent with codebase conventions?

### Issue Severity

| Severity | Meaning | Action |
|----------|---------|--------|
| 🔴 **Critical** | Bug, security issue, data loss risk | BLOCKS progress. Fix immediately. |
| 🟡 **Important** | Missing edge case, poor performance | Should fix before merge. |
| 🔵 **Suggestion** | Style, naming, minor improvement | Nice to have, not blocking. |

### Review Output

```markdown
## Review Results

**Verdict:** ✅ Approved / ❌ Changes Required

### Critical Issues
- [Must fix before proceeding]

### Important Issues  
- [Should fix before merge]

### Suggestions
- [Nice to have improvements]

### Strengths
- [What was done well]
```

## Receiving Code Review

### Rules

1. **Read ALL feedback** — Don't skim
2. **Don't take it personally** — Reviews improve code, not judge you
3. **Fix critical issues first** — They block progress
4. **Explain disagreements** — With reasoning, not defensiveness
5. **Don't ignore suggestions** — Consider each one, decide deliberately

### Handling Disagreements

If you disagree with feedback:

1. **Understand first** — Make sure you understand the concern
2. **Explain your reasoning** — Why you chose this approach
3. **Propose alternative** — If you disagree, suggest a different solution
4. **Accept gracefully** — If the reviewer has a point, fix it

## Anti-Patterns

- Rubber-stamping reviews ("LGTM" without reading)
- Only reviewing style, not logic
- Reviewing while distracted
- Ignoring edge cases because "it works for now"
- Defensive reactions to feedback
- Requesting review with failing tests
