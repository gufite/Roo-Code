import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"

import type { ToolUse } from "../../../shared/tools"
import { selectActiveIntentTool } from "../SelectActiveIntentTool"

describe("selectActiveIntentTool", () => {
	let tempDir: string
	let mockTask: any
	let pushToolResult: ReturnType<typeof vi.fn>
	let handleError: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-select-intent-"))

		mockTask = {
			cwd: tempDir,
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("missing param"),
		}

		pushToolResult = vi.fn()
		handleError = vi.fn()
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("returns an intent_context XML block for a valid intent", async () => {
		const orchestrationDir = path.join(tempDir, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })
		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			[
				"active_intents:",
				'  - id: "INT-001"',
				'    name: "JWT Authentication Migration"',
				'    status: "IN_PROGRESS"',
				"    owned_scope:",
				'      - "src/auth/**"',
				"    constraints:",
				'      - "Must maintain backward compatibility"',
				"    acceptance_criteria:",
				'      - "Unit tests in tests/auth/ pass"',
			].join("\n"),
			"utf-8",
		)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			partial: false,
			nativeArgs: {
				intent_id: "INT-001",
				mutation_class: "AST_REFACTOR",
			},
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError,
			pushToolResult,
		})

		const output = pushToolResult.mock.calls[0]?.[0]
		expect(typeof output).toBe("string")
		expect(output).toContain("<intent_context>")
		expect(output).toContain("<intent_id>INT-001</intent_id>")
		expect(output).toContain("<mutation_class>AST_REFACTOR</mutation_class>")
		expect(output).toContain("<owned_scope>")
		expect(output).toContain("<constraints>")
		expect(output).toContain("<acceptance_criteria>")
		expect(mockTask.consecutiveMistakeCount).toBe(0)
		expect(handleError).not.toHaveBeenCalled()
	})

	it("returns structured tool error when intent_id does not exist", async () => {
		const orchestrationDir = path.join(tempDir, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })
		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			["active_intents:", '  - id: "INT-001"', '    name: "Only Intent"'].join("\n"),
			"utf-8",
		)

		const block: ToolUse<"select_active_intent"> = {
			type: "tool_use",
			name: "select_active_intent",
			params: {},
			partial: false,
			nativeArgs: {
				intent_id: "INT-999",
				mutation_class: "INTENT_EVOLUTION",
			},
		}

		await selectActiveIntentTool.handle(mockTask, block, {
			askApproval: vi.fn(),
			handleError,
			pushToolResult,
		})

		const output = pushToolResult.mock.calls[0]?.[0]
		expect(typeof output).toBe("string")
		const parsed = JSON.parse(output)
		expect(parsed.status).toBe("error")
		expect(parsed.error).toContain("INT-999")
		expect(mockTask.recordToolError).toHaveBeenCalledWith("select_active_intent")
		expect(mockTask.consecutiveMistakeCount).toBe(1)
	})
})
