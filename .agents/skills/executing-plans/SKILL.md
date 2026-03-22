---
name: executing-plans
description: Use when you have an approved implementation plan and need to execute it task-by-task. Provides structured execution with checkpoints, review between tasks, and progress tracking.
---

# Executing Plans

## Overview

Execute implementation plans task-by-task with discipline. Each task is completed, verified, and committed before moving to the next.

**Core principle:** One task at a time, fully verified, then proceed.

## When to Use

- You have an approved implementation plan
- Plan has discrete, ordered tasks
- Each task has clear success criteria

## The Process

```
FOR each task in plan:
  1. READ task completely before starting
  2. EXECUTE each step in order
  3. VERIFY after each step (run tests, check output)
  4. COMMIT when task passes all verification
  5. UPDATE progress (check off completed items)
  6. REVIEW before next task (are we still on track?)
```

## Execution Rules

### Before Starting

- [ ] Read the ENTIRE plan once
- [ ] Verify prerequisite tasks are complete
- [ ] Check current codebase state matches expectations
- [ ] Ensure test baseline is green

### Per Task

1. **Read** — Understand the full task before touching code
2. **Test First** — Follow TDD: write failing test, verify it fails
3. **Implement** — Write minimal code to pass the test
4. **Verify** — Run ALL tests, not just the new one
5. **Clean** — No warnings, no errors, no TODO comments
6. **Commit** — Atomic commit with descriptive message

### Between Tasks

- Run full test suite — all previous tests still pass?
- Review: does implementation match the plan?
- If deviating from plan: STOP, discuss with user
- Check: are we over-building? YAGNI.

### Checkpoints

**After every 3-5 tasks**, pause and:
- Summarize progress to user
- Report any concerns or deviations
- Get confirmation to continue
- Update task tracking

## Self-Review Checklist

Before marking a task complete:

- [ ] All steps executed in order
- [ ] Tests written BEFORE code
- [ ] All tests pass (new AND existing)
- [ ] Code matches plan specification
- [ ] No extra features added (YAGNI)
- [ ] Clean commit with descriptive message
- [ ] No console.logs, TODOs, or debugging artifacts

## When Things Go Wrong

| Situation | Action |
|-----------|--------|
| Test won't pass | Use **systematic-debugging** skill |
| Plan seems wrong | STOP, discuss with user |
| Task too complex | Break into smaller steps |
| Missing information | Ask user before guessing |
| Existing tests break | Fix before proceeding |

## Red Flags — STOP

- Skipping TDD ("I'll add tests later")
- Implementing features not in the plan
- Moving to next task with failing tests
- Making "quick fixes" without understanding
- Deviating from plan without user approval
- Expressing completion without running verification

## Integration

- **writing-plans** creates the plan this skill executes
- **test-driven-development** is used for each task's implementation
- **verification-before-completion** is used before marking tasks done
- **systematic-debugging** is used when things go wrong
- **code-review** is used at checkpoints
