#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const orchestrationDir = path.join(repoRoot, ".orchestration")

const requiredFiles = ["active_intents.yaml", "agent_trace.jsonl", "intent_map.md"]
const sharedBrainCandidates = ["shared_brain.md", "shared_brain.yaml", "shared_brain.json", "knowledge_base.md"]

function fail(message) {
	console.error(`[orchestration:validate] ${message}`)
	process.exitCode = 1
}

function ensureSha256(value) {
	return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
}

function parseActiveIntentIds(yamlText) {
	const ids = []
	const idRegex = /^\s*-\s+id:\s*["']?([^"'\n]+)["']?\s*$/gm
	let match
	while ((match = idRegex.exec(yamlText)) !== null) {
		ids.push(match[1].trim())
	}
	return ids
}

async function exists(filePath) {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

async function main() {
	if (!(await exists(orchestrationDir))) {
		fail(`Missing directory: ${orchestrationDir}`)
		return
	}

	for (const file of requiredFiles) {
		const p = path.join(orchestrationDir, file)
		if (!(await exists(p))) {
			fail(`Missing required artifact: .orchestration/${file}`)
		}
	}

	const foundSharedBrain = (
		await Promise.all(sharedBrainCandidates.map(async (f) => ({ f, ok: await exists(path.join(orchestrationDir, f)) })))
	).find((entry) => entry.ok)

	if (!foundSharedBrain) {
		fail(
			`Missing shared brain artifact. Expected one of: ${sharedBrainCandidates
				.map((f) => `.orchestration/${f}`)
				.join(", ")}`,
		)
	}

	const intentsRaw = await fs.readFile(path.join(orchestrationDir, "active_intents.yaml"), "utf8")
	const parsedIntentIds = parseActiveIntentIds(intentsRaw)
	if (parsedIntentIds.length === 0) {
		fail("active_intents.yaml has no active_intents entries")
	}

	const intentIds = new Set()
	for (const intentId of parsedIntentIds) {
		if (!intentId || intentId.trim().length === 0) {
			fail("active_intents.yaml intent is missing a valid id")
		} else {
			intentIds.add(intentId)
		}
	}

	const traceRaw = await fs.readFile(path.join(orchestrationDir, "agent_trace.jsonl"), "utf8")
	const traceLines = traceRaw
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)

	if (traceLines.length === 0) {
		fail("agent_trace.jsonl is empty; expected at least one machine-generated trace record")
	}

	const traceIds = new Set()
	let previousTs = 0
	for (let index = 0; index < traceLines.length; index++) {
		let record
		try {
			record = JSON.parse(traceLines[index])
		} catch {
			fail(`agent_trace.jsonl line ${index + 1} is not valid JSON`)
			continue
		}

		if (typeof record.id !== "string" || record.id.length === 0) {
			fail(`agent_trace.jsonl line ${index + 1} missing id`)
		} else if (traceIds.has(record.id)) {
			fail(`agent_trace.jsonl has duplicate id '${record.id}'`)
		} else {
			traceIds.add(record.id)
		}

		const ts = Date.parse(record.timestamp)
		if (Number.isNaN(ts)) {
			fail(`agent_trace.jsonl line ${index + 1} has invalid timestamp`)
		} else if (ts < previousTs) {
			fail(`agent_trace.jsonl line ${index + 1} timestamp is earlier than previous entry`)
		}
		previousTs = Number.isNaN(ts) ? previousTs : ts

		if (typeof record.intent_id !== "string" || !intentIds.has(record.intent_id)) {
			fail(
				`agent_trace.jsonl line ${index + 1} references unknown intent_id '${String(record.intent_id)}' (not in active_intents.yaml)`,
			)
		}

		const files = Array.isArray(record.files) ? record.files : []
		if (files.length === 0) {
			fail(`agent_trace.jsonl line ${index + 1} has no files array entries`)
		}

		for (const f of files) {
			const conversations = Array.isArray(f?.conversations) ? f.conversations : []
			for (const convo of conversations) {
				const ranges = Array.isArray(convo?.ranges) ? convo.ranges : []
				for (const r of ranges) {
					if (!ensureSha256(r?.content_hash)) {
						fail(
							`agent_trace.jsonl line ${index + 1} has invalid content_hash '${String(
								r?.content_hash,
							)}' (expected sha256:<64-hex>)`,
						)
					}
				}

				const related = Array.isArray(convo?.related) ? convo.related : []
				for (const relation of related) {
					if (relation?.type === "specification" && typeof relation?.value === "string" && !intentIds.has(relation.value)) {
						fail(
							`agent_trace.jsonl line ${index + 1} related specification '${relation.value}' not found in active_intents.yaml`,
						)
					}
				}
			}
		}
	}

	const intentMapRaw = await fs.readFile(path.join(orchestrationDir, "intent_map.md"), "utf8")
	for (const intentId of intentIds) {
		if (!intentMapRaw.includes(intentId)) {
			fail(`intent_map.md does not reference active intent '${intentId}'`)
		}
	}

	if (process.exitCode && process.exitCode !== 0) {
		return
	}

	console.log("[orchestration:validate] PASS")
}

await main()
