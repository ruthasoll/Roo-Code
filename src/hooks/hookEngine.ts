// import * as vscode from 'vscode';
// import * as path from 'path';
// import * as fs from 'fs/promises';
// import * as yaml from 'js-yaml';
// import * as crypto from 'crypto';
// import { minimatch } from 'minimatch';
// import { exec } from 'child_process';  // for getGitSha

// class HookEngine {
//   /**
//    * Classify if a tool is destructive (requires HITL)
//    */
//   private isDestructive(toolName: string): boolean {
//     return ['write_to_file', 'execute_command', 'delete_file'].includes(toolName);
//   }

//   /**
//    * PreToolUse: Gatekeeper, scope check, HITL for destructive actions
//    */
//   async preToolUse(toolName: string, params: any): Promise<any> {
//     const activeIntentId = vscode.workspace.getConfiguration().get<string>('roo.activeIntentId');

//     // Gatekeeper: Block everything except select_active_intent if no intent
//     if (toolName !== 'select_active_intent' && !activeIntentId) {
//       const msg = 'MANDATORY: Call select_active_intent(intent_id) FIRST before any other action.';
//       vscode.window.showWarningMessage(msg);
//       return { error: 'tool_error', message: msg };
//     }

//     // Special handling for select_active_intent (already in tool itself)
//     if (toolName === 'select_active_intent') {
//       return null; // proceed to tool execution
//     }

//     // Load current intent for scope check
//     const intent = await this.loadActiveIntent(activeIntentId!);
//     if (!intent) {
//       return { error: 'intent_not_found', message: `Intent ${activeIntentId} not found` };
//     }

//     // Scope Enforcement for write_file
//     if (toolName === 'write_to_file') {
//       const targetPath = params.path;
//       const isAllowed = intent.owned_scope.some((pattern: string) =>
//         minimatch(targetPath, pattern, { matchBase: true })
//       );
//       if (!isAllowed) {
//         const msg = `Scope Violation: ${targetPath} is not in owned_scope of ${activeIntentId}`;
//         vscode.window.showErrorMessage(msg);
//         return { error: 'scope_violation', message: msg };
//       }
//     }

//     // HITL (Human-in-the-Loop) for destructive actions
//     if (this.isDestructive(toolName)) {
//       const approval = await vscode.window.showWarningMessage(
//         `Approve destructive action "${toolName}"?`,
//         'Approve',
//         'Reject'
//       );
//       if (approval !== 'Approve') {
//         const msg = `User rejected ${toolName}. Propose alternative plan.`;
//         return { error: 'rejected', message: msg };
//       }
//     }

//     return null; // allow execution
//   }

//   /**
//    * PostToolUse: Append trace record for mutations (Phase 3)
//    */
//   async postToolUse(toolName: string, result: any): Promise<any> {
//     // Only trace mutating actions
//     if (toolName === 'write_to_file' || toolName === 'execute_command') {
//       const activeIntentId = vscode.workspace.getConfiguration().get<string>('roo.activeIntentId');
//       if (!activeIntentId) return result;

//       const tracePath = path.join(process.cwd(), '.orchestration', 'agent_trace.jsonl');

//       const traceRecord = {
//         id: crypto.randomUUID(),
//         timestamp: new Date().toISOString(),
//         vcs: {
//           revision_id: await this.getGitSha()
//         },
//         files: [
//           {
//             relative_path: result.path || 'unknown',
//             conversations: [
//               {
//                 url: 'session_' + Date.now(), // TODO: replace with real session ID if available
//                 contributor: {
//                   entity_type: 'AI',
//                   model_identifier: 'claude-3-5-sonnet' // TODO: update with real model name
//                 },
//                 ranges: [
//                   {
//                     start_line: result.startLine || 0,
//                     end_line: result.endLine || 0,
//                     content_hash: this.computeHash(result.content || '')
//                   }
//                 ],
//                 related: [
//                   { type: 'specification', value: activeIntentId }
//                 ]
//               }
//             ]
//           }
//         ]
//       };

//       try {
//         await fs.appendFile(tracePath, JSON.stringify(traceRecord) + '\n');
//         console.log(`Trace appended for ${toolName} → intent ${activeIntentId}`);
//       } catch (err) {
//         console.error('Failed to append trace:', err);
//       }
//     }

//     return result;
//   }

//   /**
//    * Compute SHA-256 hash of content (spatial independence)
//    */
//   private computeHash(content: string): string {
//     return crypto.createHash('sha256').update(content).digest('hex');
//   }

//   /**
//    * Get current Git commit SHA
//    */
//   private async getGitSha(): Promise<string> {
//     return new Promise((resolve, reject) => {
//       exec('git rev-parse HEAD', (err, stdout) => {
//         if (err) {
//           console.error('Failed to get git SHA:', err);
//           resolve('unknown');
//         } else {
//           resolve(stdout.trim());
//         }
//       });
//     });
//   }

//   /**
//    * Load active intent from file
//    */
//   private async loadActiveIntent(intentId: string): Promise<any> {
//     const filePath = path.join(process.cwd(), '.orchestration', 'active_intents.yaml');
//     try {
//       const content = await fs.readFile(filePath, 'utf8');
//       const data = yaml.load(content) as { active_intents: any[] };
//       return data.active_intents.find((i: any) => i.id === intentId);
//     } catch (err) {
//       console.error('Failed to load active_intents.yaml:', err);
//       return null;
//     }
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
import { exec } from "child_process"

class HookEngine {
	private isDestructive(toolName: string): boolean {
		return ["write_to_file", "execute_command", "delete_file"].includes(toolName)
	}

	async preToolUse(toolName: string, params: any): Promise<any> {
		const activeIntentId = vscode.workspace.getConfiguration().get<string>("roo.activeIntentId")

		if (toolName !== "select_active_intent" && !activeIntentId) {
			const msg = "MANDATORY: Call select_active_intent(intent_id) FIRST before any other action."
			vscode.window.showWarningMessage(msg)
			return { error: "tool_error", message: msg }
		}

		if (toolName === "select_active_intent") {
			return null
		}

		const intent = await this.loadActiveIntent(activeIntentId!)
		if (!intent) {
			return { error: "intent_not_found", message: `Intent ${activeIntentId} not found` }
		}

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

			// Optimistic locking (Phase 4)
			let currentContent = ""
			try {
				currentContent = await fs.readFile(targetPath, "utf8")
			} catch (err) {
				currentContent = ""
			}
			const currentHash = this.computeHash(currentContent)

			const originalHashKey = `roo.originalFileHash_${targetPath}`
			const originalHash = vscode.workspace.getConfiguration().get<string>(originalHashKey)

			if (originalHash && currentHash !== originalHash) {
				const msg = `Stale File: ${targetPath} was modified by another agent or user. Re-read and retry.`
				vscode.window.showWarningMessage(msg)
				return { error: "stale_file", message: msg }
			}

			await vscode.workspace
				.getConfiguration()
				.update(originalHashKey, currentHash, vscode.ConfigurationTarget.Workspace)
		}

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

		return null
	}

	async postToolUse(toolName: string, result: any, params?: any): Promise<any> {
		// Phase 3: Trace logging
		if (toolName === "write_to_file" || toolName === "execute_command") {
			const activeIntentId = vscode.workspace.getConfiguration().get<string>("roo.activeIntentId")
			if (!activeIntentId) return result

			const tracePath = path.join(process.cwd(), ".orchestration", "agent_trace.jsonl")

			const traceRecord = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				vcs: { revision_id: await this.getGitSha() },
				files: [
					{
						relative_path: result.path || "unknown",
						conversations: [
							{
								url: "session_" + Date.now(),
								contributor: { entity_type: "AI", model_identifier: "claude-3-5-sonnet" },
								ranges: [
									{
										start_line: result.startLine || 0,
										end_line: result.endLine || 0,
										content_hash: this.computeHash(result.content || ""),
									},
								],
								related: [{ type: "specification", value: activeIntentId }],
							},
						],
					},
				],
			}

			try {
				await fs.appendFile(tracePath, JSON.stringify(traceRecord) + "\n")
				console.log(`Trace appended for ${toolName} → intent ${activeIntentId}`)
			} catch (err) {
				console.error("Failed to append trace:", err)
			}
		}

		// Phase 4: Lesson Recording
		if (result?.error || result?.lintError || result?.testFailed) {
			const agentBrainPath = path.join(process.cwd(), "AGENT.md")
			const lesson = `
## Lesson Learned (${new Date().toISOString()})
- Tool: ${toolName}
- Params: ${JSON.stringify(params || {})}
- Error/Result: ${result?.error || result?.lintError || result?.testFailed || "Unknown"}
- Action: Auto-fix attempted or manual review needed
`
			try {
				await fs.appendFile(agentBrainPath, lesson)
				console.log(`Lesson appended to AGENT.md`)
			} catch (err) {
				console.error("Failed to append lesson:", err)
			}
		}

		return result
	}

	private computeHash(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}

	private async getGitSha(): Promise<string> {
		return new Promise((resolve) => {
			exec("git rev-parse HEAD", (err, stdout) => {
				if (err) {
					console.warn("git rev-parse failed:", err)
					resolve("unknown")
				} else {
					resolve(stdout.trim())
				}
			})
		})
	}

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
