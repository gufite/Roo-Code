import crypto from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"

import { HookEngine } from "../HookEngine"
import { RequireIntentPreHook } from "../builtin/RequireIntentPreHook"
import { ScopeEnforcementPreHook } from "../builtin/ScopeEnforcementPreHook"
import { StaleReadPreHook } from "../builtin/StaleReadPreHook"
import { TraceMutationPostHook } from "../builtin/TraceMutationPostHook"
import type { HookContext, PostToolHookContext } from "../types"

function createEngine(): HookEngine {
	const engine = new HookEngine()
	engine.registerPreHook(new RequireIntentPreHook())
	engine.registerPreHook(new ScopeEnforcementPreHook())
	engine.registerPreHook(new StaleReadPreHook())
	engine.registerPostHook(new TraceMutationPostHook())
	return engine
}

function createReadSnapshot(content: string) {
	return {
		sha256: crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex"),
		capturedAt: "2026-02-20T00:00:00Z",
	}
}

function baseContext(overrides: Partial<HookContext>): HookContext {
	return {
		taskId: "task-gov-e2e",
		toolName: "apply_diff",
		toolArgs: {},
		timestamp: "2026-02-20T00:00:00Z",
		...overrides,
	}
}

describe("Governance integration (intent + scope + stale + trace)", () => {
	it("enforces intent/scope/stale checks and writes trace for successful mutation", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gov-e2e-"))
		try {
			const orchestrationDir = path.join(tempDir, ".orchestration")
			const targetRelPath = "src/app.ts"
			const targetAbsPath = path.join(tempDir, targetRelPath)
			const initialContent = "export const value = 1\n"
			const updatedContent = "export const value = 2\n"
			const externallyChangedContent = "export const value = 3\n"

			await fs.mkdir(path.dirname(targetAbsPath), { recursive: true })
			await fs.mkdir(orchestrationDir, { recursive: true })
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				[
					"active_intents:",
					'  - id: "INT-001"',
					'    name: "Refactor app"',
					'    status: "ACTIVE"',
					"    owned_scope:",
					'      - "src/**"',
				].join("\n"),
				"utf8",
			)
			await fs.writeFile(targetAbsPath, initialContent, "utf8")

			const engine = createEngine()

			const preCtx: HookContext = baseContext({
				cwd: tempDir,
				toolName: "apply_diff",
				toolArgs: {
					path: targetRelPath,
					diff: "<<<<<<< SEARCH\nvalue = 1\n=======\nvalue = 2\n>>>>>>> REPLACE",
					intent_id: "INT-001",
					mutation_class: "AST_REFACTOR",
				},
				taskFileReadSnapshots: {
					[targetRelPath]: createReadSnapshot(initialContent),
				},
			})

			const preDecision = await engine.runPreHooks(preCtx)
			expect(preDecision.allow).toBe(true)

			// Simulate successful mutation before post-hooks execute.
			await fs.writeFile(targetAbsPath, updatedContent, "utf8")

			const postCtx: PostToolHookContext = {
				...preCtx,
				toolResult: undefined,
				changedFiles: [targetRelPath],
			}
			await engine.runPostHooks(postCtx)

			const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")
			const traceContent = await fs.readFile(tracePath, "utf8")
			const lines = traceContent
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
			expect(lines.length).toBeGreaterThanOrEqual(1)

			const latestRecord = JSON.parse(lines.at(-1) || "{}")
			expect(latestRecord.intent_id).toBe("INT-001")
			expect(latestRecord.mutation_class).toBe("AST_REFACTOR")
			expect(Array.isArray(latestRecord.files)).toBe(true)
			expect(latestRecord.files[0]?.relative_path).toBe(targetRelPath)
			expect(latestRecord.files[0]?.conversations?.[0]?.ranges?.[0]?.content_hash).toBe(
				"sha256:" + crypto.createHash("sha256").update(updatedContent, "utf8").digest("hex"),
			)

			// Simulate external file change after read snapshot; stale pre-hook should now block.
			await fs.writeFile(targetAbsPath, externallyChangedContent, "utf8")
			const staleDecision = await engine.runPreHooks(preCtx)
			expect(staleDecision.allow).toBe(false)
			if (!staleDecision.allow) {
				expect(staleDecision.code).toBe("STALE_CONTEXT")
			}
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true })
		}
	})

	it("blocks scope violations even when intent_id is present", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gov-scope-"))
		try {
			const orchestrationDir = path.join(tempDir, ".orchestration")
			await fs.mkdir(orchestrationDir, { recursive: true })
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				[
					"active_intents:",
					'  - id: "INT-001"',
					'    name: "Scoped intent"',
					'    status: "ACTIVE"',
					"    owned_scope:",
					'      - "src/**"',
				].join("\n"),
				"utf8",
			)

			const engine = createEngine()
			const decision = await engine.runPreHooks(
				baseContext({
					cwd: tempDir,
					toolName: "write_to_file",
					toolArgs: {
						path: "outside/config.json",
						content: "{}",
						intent_id: "INT-001",
						mutation_class: "AST_REFACTOR",
					},
				}),
			)

			expect(decision.allow).toBe(false)
			if (!decision.allow) {
				expect(decision.code).toBe("SCOPE_VIOLATION")
			}
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true })
		}
	})
})
