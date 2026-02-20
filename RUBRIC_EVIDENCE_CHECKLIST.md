# TRP1 Rubric Evidence Checklist

This checklist maps governance rubric criteria to concrete implementation and automated tests in this repository.

## 1) Intent Handshake Before Mutation

- Success criteria:
    - Mutating tools are blocked when no active intent is declared or resolved from task state.
    - Mutating tool schemas require `intent_id` and `mutation_class`.
- Implementation evidence:
    - `src/hooks/builtin/RequireIntentPreHook.ts`
    - `src/core/prompts/system.ts`
    - `src/core/prompts/tools/native-tools/write_to_file.ts`
    - `src/core/prompts/tools/native-tools/apply_diff.ts`
    - `src/core/prompts/tools/native-tools/edit.ts`
    - `src/core/prompts/tools/native-tools/search_replace.ts`
    - `src/core/prompts/tools/native-tools/edit_file.ts`
    - `src/core/prompts/tools/native-tools/apply_patch.ts`
    - `src/core/prompts/tools/native-tools/execute_command.ts`
- Test evidence:
    - `src/hooks/__tests__/HookEngine.test.ts`
    - `src/core/tools/__tests__/selectActiveIntentTool.spec.ts`

## 2) Scope Enforcement

- Success criteria:
    - Mutations outside `owned_scope` are blocked with `SCOPE_VIOLATION`.
    - Patch operations enforce scope for file headers and move targets.
- Implementation evidence:
    - `src/hooks/builtin/ScopeEnforcementPreHook.ts`
- Test evidence:
    - `src/hooks/__tests__/GovernanceIntegration.test.ts`

## 3) Stale-Context Protection (Optimistic Locking)

- Success criteria:
    - Mutations against previously read files are blocked when file content changed since last read.
    - Sequential in-agent edits continue working by refreshing snapshots after successful writes.
- Implementation evidence:
    - `src/hooks/builtin/StaleReadPreHook.ts`
    - `src/core/task/Task.ts`
    - `src/core/tools/ReadFileTool.ts`
    - `src/core/tools/WriteToFileTool.ts`
    - `src/core/tools/ApplyDiffTool.ts`
    - `src/core/tools/EditTool.ts`
    - `src/core/tools/SearchReplaceTool.ts`
    - `src/core/tools/EditFileTool.ts`
    - `src/core/tools/ApplyPatchTool.ts`
- Test evidence:
    - `src/hooks/__tests__/HookEngine.test.ts`
    - `src/hooks/__tests__/GovernanceIntegration.test.ts`

## 4) Append-Only Traceability

- Success criteria:
    - Every successful mutating tool execution appends a record to `.orchestration/agent_trace.jsonl`.
    - Trace record includes `intent_id`, `mutation_class`, VCS revision, touched files, and `sha256` hash.
- Implementation evidence:
    - `src/hooks/builtin/TraceMutationPostHook.ts`
- Test evidence:
    - `src/hooks/__tests__/GovernanceIntegration.test.ts`

## 5) Hook Safety Contract

- Success criteria:
    - Pre-hook failures are fail-closed (blocked execution).
    - Post-hook failures are fail-safe (do not crash loop).
- Implementation evidence:
    - `src/hooks/HookEngine.ts`
- Test evidence:
    - `src/hooks/__tests__/HookEngine.test.ts`

## Verification Commands

Run these commands to validate rubric evidence:

```bash
pnpm governance:ci
```
