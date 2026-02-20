import * as fs from "fs"
import * as path from "path"

import { parse as parseYaml } from "yaml"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"

import { BaseTool, ToolCallbacks } from "./BaseTool"

interface ActiveIntent {
	id: string
	name?: string
	status?: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

interface ActiveIntentsFile {
	active_intents?: ActiveIntent[]
}

interface SelectActiveIntentParams {
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION"
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

function listToXml(tagName: string, itemTagName: string, items: string[] | undefined): string[] {
	const safeItems = items?.filter((item) => item && item.trim().length > 0) ?? []
	if (safeItems.length === 0) {
		return [`  <${tagName}></${tagName}>`]
	}

	return [
		`  <${tagName}>`,
		...safeItems.map((item) => `    <${itemTagName}>${escapeXml(item)}</${itemTagName}>`),
		`  </${tagName}>`,
	]
}

function buildIntentContextXml(
	intent: ActiveIntent,
	mutationClass: SelectActiveIntentParams["mutation_class"],
): string {
	const lines = [
		"<intent_context>",
		`  <intent_id>${escapeXml(intent.id)}</intent_id>`,
		`  <name>${escapeXml(intent.name ?? "Unnamed Intent")}</name>`,
		`  <status>${escapeXml(intent.status ?? "UNKNOWN")}</status>`,
		`  <mutation_class>${escapeXml(mutationClass)}</mutation_class>`,
		...listToXml("owned_scope", "path", intent.owned_scope),
		...listToXml("constraints", "constraint", intent.constraints),
		...listToXml("acceptance_criteria", "criterion", intent.acceptance_criteria),
		"</intent_context>",
	]

	return lines.join("\n")
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id: intentId, mutation_class: mutationClass } = params
		const { pushToolResult, handleError } = callbacks

		if (!intentId) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
			return
		}

		if (!mutationClass) {
			task.consecutiveMistakeCount++
			task.recordToolError("select_active_intent")
			pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "mutation_class"))
			return
		}

		const intentsPath = path.join(task.cwd, ".orchestration", "active_intents.yaml")

		try {
			const raw = await fs.promises.readFile(intentsPath, "utf-8")
			const parsed = parseYaml(raw) as ActiveIntentsFile
			const activeIntents = parsed.active_intents ?? []

			const selectedIntent = activeIntents.find((intent) => intent.id === intentId)
			if (!selectedIntent) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				const knownIds = activeIntents.map((intent) => intent.id).filter(Boolean)
				pushToolResult(
					formatResponse.toolError(
						`Invalid intent_id '${intentId}'. ` +
							`No matching entry found in .orchestration/active_intents.yaml. ` +
							`Known IDs: [${knownIds.join(", ")}].`,
					),
				)
				return
			}

			task.setActiveIntent(intentId, mutationClass)
			task.consecutiveMistakeCount = 0
			pushToolResult(buildIntentContextXml(selectedIntent, mutationClass))
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			await handleError(
				"loading active intent context",
				new Error(
					`Unable to load .orchestration/active_intents.yaml at '${intentsPath}': ${message}. ` +
						`Create the sidecar file and define at least one active intent.`,
				),
			)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
