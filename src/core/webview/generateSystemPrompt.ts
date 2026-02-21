// import * as vscode from "vscode"
// import { WebviewMessage } from "../../shared/WebviewMessage"
// import { defaultModeSlug } from "../../shared/modes"
// import { buildApiHandler } from "../../api"

// import { SYSTEM_PROMPT } from "../prompts/system"
// import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
// import { Package } from "../../shared/package"

// import { ClineProvider } from "./ClineProvider"

// export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
// 	const {
// 		apiConfiguration,
// 		customModePrompts,
// 		customInstructions,
// 		mcpEnabled,
// 		experiments,
// 		language,
// 		enableSubfolderRules,
// 	} = await provider.getState()

// 	const diffStrategy = new MultiSearchReplaceDiffStrategy()

// 	const cwd = provider.cwd

// 	const mode = message.mode ?? defaultModeSlug
// 	const customModes = await provider.customModesManager.getCustomModes()

// 	const rooIgnoreInstructions = provider.getCurrentTask()?.rooIgnoreController?.getInstructions()

// 	// Create a temporary API handler to check model info for stealth mode.
// 	// This avoids relying on an active Cline instance which might not exist during preview.
// 	let modelInfo: { isStealthModel?: boolean } | undefined
// 	try {
// 		const tempApiHandler = buildApiHandler(apiConfiguration)
// 		modelInfo = tempApiHandler.getModel().info
// 	} catch (error) {
// 		console.error("Error fetching model info for system prompt preview:", error)
// 	}

// 	const systemPrompt = await SYSTEM_PROMPT(
// 		provider.context,
// 		cwd,
// 		false, // supportsComputerUse — browser removed
// 		mcpEnabled ? provider.getMcpHub() : undefined,
// 		diffStrategy,
// 		mode,
// 		customModePrompts,
// 		customModes,
// 		customInstructions,
// 		experiments,
// 		language,
// 		rooIgnoreInstructions,
// 		{
// 			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
// 			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
// 			enableSubfolderRules: enableSubfolderRules ?? false,
// 			newTaskRequireTodos: vscode.workspace
// 				.getConfiguration(Package.name)
// 				.get<boolean>("newTaskRequireTodos", false),
// 			isStealthModel: modelInfo?.isStealthModel,
// 		},
// 		undefined, // todoList
// 		undefined, // modelId
// 		provider.getSkillsManager(),
// 	)
// 	// MANDATORY HANDSHAKE INSTRUCTION (add this block)
// const handshakeInstruction = `
// CRITICAL GOVERNANCE RULES - READ CAREFULLY AND OBEY:

// You are an Intent-Driven Architect. You operate under strict rules.

// You CANNOT:
// - Write code
// - Edit files
// - Execute commands
// - Call any other tool
// - Plan or reason step-by-step

// UNTIL you have called the MANDATORY FIRST TOOL:

// select_active_intent(intent_id: string)

// This tool loads the active intent context (constraints, owned scope, acceptance criteria) from .orchestration/active_intents.yaml.

// Your FIRST response MUST be to call this tool with a valid intent_id.

// Format: [tool_call name="select_active_intent"]{"intent_id": "INT-001"}[/tool_call]

// Do NOT skip this step. If you do, the system will block and remind you.

// After context is loaded, you may proceed ONLY within the loaded intent's scope and constraints.

// Available tools (after select_active_intent):
// - write_to_file(path: string, content: string): Write file
// - execute_command(command: string): Run shell command
// - ... other tools

// Start now: Call select_active_intent with the most relevant intent_id for this request.
// `;

// // Prepend to the system prompt
// systemPrompt = handshakeInstruction + '\n\n' + systemPrompt;

// 	return systemPrompt
// }
import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug } from "../../shared/modes"
import { buildApiHandler } from "../../api"

import { SYSTEM_PROMPT } from "../prompts/system"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { Package } from "../../shared/package"

import { ClineProvider } from "./ClineProvider"

export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		mcpEnabled,
		experiments,
		language,
		enableSubfolderRules,
	} = await provider.getState()

	const diffStrategy = new MultiSearchReplaceDiffStrategy()

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()

	const rooIgnoreInstructions = provider.getCurrentTask()?.rooIgnoreController?.getInstructions()

	// Create a temporary API handler to check model info for stealth mode.
	let modelInfo: { isStealthModel?: boolean } | undefined
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration)
		modelInfo = tempApiHandler.getModel().info
	} catch (error) {
		console.error("Error fetching model info for system prompt preview:", error)
	}

	// Use let here so we can modify it
	let systemPrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		false, // supportsComputerUse — browser removed
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		experiments,
		language,
		rooIgnoreInstructions,
		{
			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
			enableSubfolderRules: enableSubfolderRules ?? false,
			newTaskRequireTodos: vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false),
			isStealthModel: modelInfo?.isStealthModel,
		},
		undefined, // todoList
		undefined, // modelId
		provider.getSkillsManager(),
	)

	// MANDATORY HANDSHAKE INSTRUCTION
	const handshakeInstruction = `
CRITICAL GOVERNANCE RULES - READ CAREFULLY AND OBEY:

You are an Intent-Driven Architect. You operate under strict rules.

You CANNOT:
- Write code
- Edit files
- Execute commands
- Call any other tool
- Plan or reason step-by-step

UNTIL you have called the MANDATORY FIRST TOOL:

select_active_intent(intent_id: string)

This tool loads the active intent context (constraints, owned scope, acceptance criteria) from .orchestration/active_intents.yaml.

Your FIRST response MUST be to call this tool with a valid intent_id.

Format: [tool_call name="select_active_intent"]{"intent_id": "INT-001"}[/tool_call]

Do NOT skip this step. If you do, the system will block and remind you.

After context is loaded, you may proceed ONLY within the loaded intent's scope and constraints.

Available tools (after select_active_intent):
- write_to_file(path: string, content: string): Write file
- execute_command(command: string): Run shell command
- ... other tools

Start now: Call select_active_intent with the most relevant intent_id for this request.
`

	// Re-assign with let
	systemPrompt = handshakeInstruction + "\n\n" + systemPrompt

	return systemPrompt
}
