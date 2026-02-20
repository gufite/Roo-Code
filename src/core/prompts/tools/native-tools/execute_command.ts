import type OpenAI from "openai"

const EXECUTE_COMMAND_DESCRIPTION = `Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Prefer relative commands and paths that avoid location sensitivity for terminal consistency.

Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in

Example: Executing npm run dev
{ "command": "npm run dev", "cwd": null }

Example: Executing ls in a specific directory if directed
{ "command": "ls -la", "cwd": "/home/user/projects" }

Example: Using relative paths
{ "command": "touch ./testdata/example.file", "cwd": null }`

const COMMAND_PARAMETER_DESCRIPTION = `Shell command to execute`

const CWD_PARAMETER_DESCRIPTION = `Optional working directory for the command, relative or absolute`

const INTENT_ID_PARAMETER_DESCRIPTION = `The active intent ID this mutation belongs to (for example: "INT-001").`

const MUTATION_CLASS_PARAMETER_DESCRIPTION = `Mutation class for traceability:
- AST_REFACTOR: code restructuring without new behavior
- INTENT_EVOLUTION: new behavior or requirement change`

export default {
	type: "function",
	function: {
		name: "execute_command",
		description: EXECUTE_COMMAND_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description: COMMAND_PARAMETER_DESCRIPTION,
				},
				cwd: {
					type: ["string", "null"],
					description: CWD_PARAMETER_DESCRIPTION,
				},
				intent_id: {
					type: "string",
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
				mutation_class: {
					type: "string",
					enum: ["AST_REFACTOR", "INTENT_EVOLUTION"],
					description: MUTATION_CLASS_PARAMETER_DESCRIPTION,
				},
			},
			required: ["command", "cwd", "intent_id", "mutation_class"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
