import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

import { HookContext, HookDecision, PreToolHook } from "../types"

const WRITE_TOOLS = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
])

const PATCH_FILE_MARKERS = ["*** Add File: ", "*** Delete File: ", "*** Update File: ", "*** Move to: "] as const

function normalizePath(cwd: string, targetPath: string): string {
	return path.relative(cwd, path.resolve(cwd, targetPath)).replace(/\\/g, "/")
}

function extractFilePathsFromPatch(patchContent: string): string[] {
	const filePaths: string[] = []
	const lines = patchContent.split("\n")

	for (const line of lines) {
		for (const marker of PATCH_FILE_MARKERS) {
			if (line.startsWith(marker)) {
				const filePath = line.substring(marker.length).trim()
				if (filePath) filePaths.push(filePath)
				break
			}
		}
	}

	return filePaths
}

function extractTargetPaths(toolName: string, toolArgs: Record<string, unknown>): string[] {
	const paths = new Set<string>()

	const singlePath = toolArgs["path"]
	if (typeof singlePath === "string" && singlePath.length > 0) {
		paths.add(singlePath)
	}

	const filePath = toolArgs["file_path"]
	if (typeof filePath === "string" && filePath.length > 0) {
		paths.add(filePath)
	}

	const multiPaths = toolArgs["paths"]
	if (Array.isArray(multiPaths)) {
		for (const p of multiPaths) {
			if (typeof p === "string" && p.length > 0) {
				paths.add(p)
			}
		}
	}

	if (toolName === "apply_patch" && typeof toolArgs["patch"] === "string") {
		for (const p of extractFilePathsFromPatch(toolArgs["patch"] as string)) {
			paths.add(p)
		}
	}

	return Array.from(paths)
}

export class StaleReadPreHook implements PreToolHook {
	name = "stale-read-pre-hook"

	async run(context: HookContext): Promise<HookDecision> {
		if (!WRITE_TOOLS.has(context.toolName)) {
			return { allow: true }
		}

		const cwd = context.cwd
		const snapshots = context.taskFileReadSnapshots

		if (!cwd || !snapshots || Object.keys(snapshots).length === 0) {
			return { allow: true }
		}

		const targetPaths = extractTargetPaths(context.toolName, context.toolArgs)
		if (targetPaths.length === 0) {
			return { allow: true }
		}

		for (const targetPath of targetPaths) {
			const relPath = normalizePath(cwd, targetPath)
			const snapshot = snapshots[relPath]
			if (!snapshot) {
				continue
			}

			try {
				const content = await fs.readFile(path.resolve(cwd, relPath))
				const currentHash = crypto.createHash("sha256").update(content).digest("hex")
				if (currentHash !== snapshot.sha256) {
					return {
						allow: false,
						code: "STALE_CONTEXT",
						reason:
							`Stale Context: '${relPath}' changed after it was read at ${snapshot.capturedAt}. ` +
							"Call read_file again before applying edits.",
					}
				}
			} catch {
				return {
					allow: false,
					code: "STALE_CONTEXT",
					reason:
						`Stale Context: '${relPath}' is no longer readable after it was read at ${snapshot.capturedAt}. ` +
						"Call read_file again before applying edits.",
				}
			}
		}

		return { allow: true }
	}
}
