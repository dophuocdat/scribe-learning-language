---
name: writing-plans
description: Use after design/spec is approved to create detailed implementation plans. Breaks work into bite-sized tasks with exact file paths, complete code, verification steps.
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for the codebase. Document everything they need: which files to touch, code, testing, how to verify. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about the toolset or problem domain.

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Scope Check

If the spec covers multiple independent subsystems, suggest breaking into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for.

- Design units with clear boundaries and well-defined interfaces
- Prefer smaller, focused files over large ones that do too much
- Files that change together should live together. Split by responsibility, not by technical layer
- In existing codebases, follow established patterns

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement the minimal code to make the test pass" — step
- "Run the tests and make sure they pass" — step
- "Commit" — step

## Plan Document Header

Every plan MUST start with:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`
- Test: `tests/exact/path/to/test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
test('specific behavior', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- path/to/test.ts`
Expected: FAIL with "functionName is not defined"

- [ ] **Step 3: Write minimal implementation**

```typescript
export function functionName(input: Type): ReturnType {
    return expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- path/to/test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat: add specific feature"
```
````

## Remember

- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
- Reference relevant skills when applicable

## Plan Review

After writing the plan:

1. Re-read for completeness — every task self-contained?
2. Verify code examples are complete and correct
3. Check all file paths exist or are clearly marked as new
4. Present to user for approval before execution

## Execution Handoff

After user approves the plan:

> "Plan complete and saved to `docs/plans/<filename>.md`. Ready to start executing task by task?"

Then use **executing-plans** skill to implement.
