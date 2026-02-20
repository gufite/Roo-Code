# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Settings View Pattern: When working on `SettingsView`, inputs must bind to the local `cachedState`, NOT the live `useExtensionState()`. The `cachedState` acts as a buffer for user edits, isolating them from the `ContextProxy` source-of-truth until the user explicitly clicks "Save". Wiring inputs directly to the live state causes race conditions.

## Codex Mandatory Law

These rules are non-negotiable for Codex agents in this repo:

1. Intent before mutation:

    - Do not perform mutating operations without an active intent.
    - Mutations must carry `intent_id` and `mutation_class` (directly or resolved from task state).

2. Scope enforcement:

    - Only mutate files within the selected intent `owned_scope`.
    - Out-of-scope changes must be blocked, not silently applied.

3. Traceability required:

    - Every successful mutation must produce append-only trace data in `.orchestration/agent_trace.jsonl`.
    - Trace entries must include intent linkage and content hash (`sha256`).

4. Hook safety:

    - Pre-hooks are fail-closed.
    - Post-hooks are fail-safe.

5. No governance bypass:
    - Never bypass intent, scope, or trace rules for convenience.
