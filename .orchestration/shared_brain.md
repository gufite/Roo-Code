# Shared Brain

This machine-managed knowledge base captures reusable governance patterns discovered during implementation.

## Entry 1

- timestamp: 2026-02-20T12:00:00Z
- topic: Intent handshake reliability
- observation: Mutating tools become deterministic when `intent_id` and `mutation_class` are required in schemas and reinforced by pre-hooks.
- reuse_hint: Keep prompt protocol + schema requirements + runtime gatekeeper aligned to avoid bypass paths.

## Entry 2

- timestamp: 2026-02-20T12:10:00Z
- topic: Scope enforcement for patch-based edits
- observation: `apply_patch` must parse file headers (`Add/Update/Delete/Move`) to evaluate scope and trace all touched files.
- reuse_hint: Normalize extracted paths before policy checks to avoid false passes on absolute/relative path mixing.

## Entry 3

- timestamp: 2026-02-20T12:20:00Z
- topic: Stale context prevention
- observation: Optimistic stale-read locks block writes when file hashes drift after `read_file`, reducing accidental overwrite risk.
- reuse_hint: Refresh read snapshots after successful writes so sequential in-agent edits remain unblocked.
