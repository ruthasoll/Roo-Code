// // src/hooks/hookEngine.ts
// import * as vscode from 'vscode';
// import * as path from 'path';
// import * as fs from 'fs/promises';
// import * as yaml from 'js-yaml';

// /**
//  * HookEngine - Central middleware for intercepting tool executions.
//  * Implements the PreToolUse / PostToolUse boundary for governance.
//  */
// class HookEngine {
//   /**
//    * Called BEFORE any tool is executed.
//    * - Enforces gatekeeper: no tool allowed without selected intent
//    * - Handles special case for select_active_intent (loads & returns context)
//    * - Can block execution and return structured error
//    */
//   async preToolUse(toolName: string, params: any): Promise<any> {
//     // Get currently selected intent ID from VS Code workspace configuration
//     const activeIntentId = vscode.workspace.getConfiguration().get<string>('roo.activeIntentId');

//     // Gatekeeper: Block ALL tools except select_active_intent if no intent is selected
//     if (toolName !== 'select_active_intent' && !activeIntentId) {
//       const errorMessage = 'MANDATORY: Call select_active_intent(intent_id) FIRST before any other action. No intent is currently selected.';

//       // Show visible warning in VS Code
//       vscode.window.showWarningMessage(errorMessage);

//       // Return structured error for LLM to see (prompt-based recovery)
//       return {
//         error: 'tool_error',
//         message: errorMessage,
//         details: 'Use select_active_intent to load an intent context first.'
//       };
//     }

//     // Special handling for the mandatory handshake tool
//     if (toolName === 'select_active_intent') {
//       const intentId = params?.intent_id;
//       if (!intentId || typeof intentId !== 'string') {
//         return {
//           error: 'invalid_params',
//           message: 'intent_id must be a valid string (e.g. "INT-001")'
//         };
//       }

//       try {
//         const filePath = path.join(process.cwd(), '.orchestration', 'active_intents.yaml');
//         const content = await fs.readFile(filePath, 'utf8');
//         const data = yaml.load(content) as { active_intents: any[] };

//         const intent = data.active_intents?.find((i: any) => i.id === intentId);
//         if (!intent) {
//           return {
//             error: 'not_found',
//             message: `Intent "${intentId}" not found in active_intents.yaml`
//           };
//         }

//         // Format as XML block (easy for LLM to parse and use)
//         const xmlContext = `
// <intent_context>
//   <id>${intent.id}</id>
//   <name>${intent.name}</name>
//   <status>${intent.status}</status>
//   <constraints>${intent.constraints?.join('\n- ') || 'None'}</constraints>
//   <owned_scope>${intent.owned_scope?.join('\n- ') || 'None'}</owned_scope>
//   <acceptance_criteria>${intent.acceptance_criteria?.join('\n- ') || 'None'}</acceptance_criteria>
// </intent_context>
//         `.trim();

//         // Store the selected intent ID in VS Code workspace state
//         // (used by gatekeeper in future calls)
//         await vscode.workspace.getConfiguration().update(
//           'roo.activeIntentId',
//           intentId,
//           vscode.ConfigurationTarget.Workspace
//         );

//         // Optional: Show success notification
//         vscode.window.showInformationMessage(`Intent loaded: ${intent.name} (${intentId})`);

//         return xmlContext;
//       } catch (err: any) {
//         return {
//           error: 'load_failed',
//           message: `Failed to load intent: ${err.message}`
//         };
//       }
//     }

//     // For all other tools: proceed normally (scope check can be added in Phase 2)
//     return null; // null means "allow execution"
//   }

//   /**
//    * Called AFTER a tool executes successfully.
//    * - Placeholder for Phase 3: append to agent_trace.jsonl
//    * - Can be used for auto-formatting, linting, etc.
//    */
//   async postToolUse(toolName: string, result: any): Promise<any> {
//     // Later phases will add:
//     // - Compute content_hash
//     // - Append trace record to .orchestration/agent_trace.jsonl
//     // - Update intent_map.md or AGENT.md if needed

//     // For now: just return the original result
//     return result;
//   }

//   /**
//    * Optional: Reset active intent (e.g. after task complete)
//    */
//   async resetActiveIntent() {
//     await vscode.workspace.getConfiguration().update(
//       'roo.activeIntentId',
//       undefined,
//       vscode.ConfigurationTarget.Workspace
//     );
//     vscode.window.showInformationMessage('Active intent cleared.');
//   }
// }

// export const hookEngine = new HookEngine();
// src/hooks/hookEngine.ts
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import * as crypto from "crypto"
import { minimatch } from "minimatch"
class HookEngine {
	/**
	 * Classify if a tool is destructive (requires HITL)
	 */
	private isDestructive(toolName: string): boolean {
		return ["write_to_file", "execute_command", "delete_file"].includes(toolName)
	}

	/**
	 * PreToolUse: Gatekeeper, scope check, HITL for destructive actions
	 */
	async preToolUse(toolName: string, params: any): Promise<any> {
		const activeIntentId = vscode.workspace.getConfiguration().get<string>("roo.activeIntentId")

		// Gatekeeper: Block everything except select_active_intent if no intent
		if (toolName !== "select_active_intent" && !activeIntentId) {
			const msg = "MANDATORY: Call select_active_intent(intent_id) FIRST before any other action."
			vscode.window.showWarningMessage(msg)
			return { error: "tool_error", message: msg }
		}

		// Special handling for select_active_intent (already in tool itself)
		if (toolName === "select_active_intent") {
			return null // proceed to tool execution
		}

		// Load current intent for scope check
		const intent = await this.loadActiveIntent(activeIntentId!)
		if (!intent) {
			return { error: "intent_not_found", message: `Intent ${activeIntentId} not found` }
		}

		// Scope Enforcement for write_file
		if (toolName === "write_to_file") {
			const targetPath = params.path
			const isAllowed = intent.owned_scope.some((pattern: string) =>
				minimatch(targetPath, pattern, { matchBase: true }),
			)
			if (!isAllowed) {
				const msg = `Scope Violation: ${targetPath} is not in owned_scope of ${activeIntentId}`
				vscode.window.showErrorMessage(msg)
				return { error: "scope_violation", message: msg }
			}
		}

		// HITL (Human-in-the-Loop) for destructive actions
		if (this.isDestructive(toolName)) {
			const approval = await vscode.window.showWarningMessage(
				`Approve destructive action "${toolName}"?`,
				"Approve",
				"Reject",
			)
			if (approval !== "Approve") {
				const msg = `User rejected ${toolName}. Propose alternative plan.`
				return { error: "rejected", message: msg }
			}
		}

		return null // allow execution
	}

	/**
	 * PostToolUse: Trace logging, auto-recovery prep
	 */
	async postToolUse(toolName: string, result: any): Promise<any> {
		// Placeholder for Phase 3: append to agent_trace.jsonl
		// (we'll expand this in Phase 3)
		return result
	}

	/**
	 * Load active intent from file
	 */
	private async loadActiveIntent(intentId: string): Promise<any> {
		const filePath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")
		try {
			const content = await fs.readFile(filePath, "utf8")
			const data = yaml.load(content) as { active_intents: any[] }
			return data.active_intents.find((i: any) => i.id === intentId)
		} catch (err) {
			console.error("Failed to load active_intents.yaml:", err)
			return null
		}
	}
}

export const hookEngine = new HookEngine()
