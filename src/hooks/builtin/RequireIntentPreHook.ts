import { HookContext, HookDecision, PreToolHook } from "../types"

const MUTATING_TOOLS = new Set(["write_to_file", "execute_command"])

export class RequireIntentPreHook implements PreToolHook {
	name = "require-intent-pre-hook"

	run(context: HookContext): HookDecision {
		if (!MUTATING_TOOLS.has(context.toolName)) {
			return { allow: true }
		}

		const declaredIntentId = context.toolArgs.intent_id
		const activeIntentId = context.taskActiveIntentId
		const intentId =
			typeof declaredIntentId === "string" && declaredIntentId.trim().length > 0
				? declaredIntentId
				: activeIntentId

		if (!intentId || typeof intentId !== "string") {
			return {
				allow: false,
				code: "INTENT_REQUIRED",
				reason:
					"Mutating tool call blocked: no active intent in task state. " +
					"Call select_active_intent(intent_id, mutation_class) before mutating tools.",
			}
		}

		return {
			allow: true,
			contextPatch: {
				active_intent_id: intentId,
				resolved_intent_id: intentId,
				resolved_mutation_class: context.taskActiveMutationClass,
			},
		}
	}
}
