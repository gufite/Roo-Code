export type HookPhase = "preToolUse" | "postToolUse"

export interface FileReadSnapshot {
	sha256: string
	capturedAt: string
}

export interface HookContext {
	taskId: string
	toolName: string
	toolArgs: Record<string, unknown>
	cwd?: string
	timestamp: string
	taskActiveIntentId?: string
	taskActiveMutationClass?: "AST_REFACTOR" | "INTENT_EVOLUTION"
	taskFileReadSnapshots?: Record<string, FileReadSnapshot>
}

export type BlockCode = "INTENT_REQUIRED" | "SCOPE_VIOLATION" | "STALE_CONTEXT" | "DESTRUCTIVE_BLOCKED" | "HOOK_ERROR"

export type HookDecision =
	| {
			allow: true
			contextPatch?: Record<string, unknown>
	  }
	| {
			allow: false
			reason: string
			code: BlockCode
	  }

export interface PreToolHook {
	name: string
	run(context: HookContext): Promise<HookDecision> | HookDecision
}

export interface PostToolHookContext extends HookContext {
	toolResult: unknown
	changedFiles: string[]
}

export interface PostToolHook {
	name: string
	run(context: PostToolHookContext): Promise<void> | void
}
