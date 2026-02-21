# GitHub Fulfillment Checklist (Governance)

This checklist ensures repository-level GitHub controls match the governance implementation.

## Required Branch Protection (main)

- Require pull request reviews before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Restrict force-push and branch deletion on `main`.

## Required Status Checks

- `governance-gate` (from `.github/workflows/code-qa.yml`)
- `compile`
- `platform-unit-test (ubuntu-latest)`
- `platform-unit-test (windows-latest)`

## Local Verification Before Push

```bash
pnpm governance:ci
```

## What `governance-gate` Enforces

- Governance integration tests and parser/assistant-message regression tests.
- Type-check of `src`.
- `.orchestration` artifact integrity:
    - required files exist
    - trace JSONL lines are parseable
    - `intent_id` references are consistent with `active_intents.yaml`
    - `content_hash` is SHA-256 format
    - `intent_map.md` references all active intents
