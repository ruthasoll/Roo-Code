// src/core/tools/SelectActiveIntentTool.ts
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import * as vscode from "vscode"

export class SelectActiveIntentTool {
	name = "select_active_intent"
	description =
		"MANDATORY FIRST STEP: Select and load context for an active intent ID from .orchestration/active_intents.yaml. Call this before ANY other action."

	schema = {
		type: "object",
		properties: {
			intent_id: {
				type: "string",
				description: "Exact intent ID (e.g. INT-001)",
			},
		},
		required: ["intent_id"],
	}

	async execute(params: { intent_id: string }) {
		try {
			const filePath = path.join(process.cwd(), ".orchestration", "active_intents.yaml")
			const content = await fs.readFile(filePath, "utf8")
			const data = yaml.load(content) as { active_intents: any[] }

			const intent = data.active_intents?.find((i: any) => i.id === params.intent_id)
			if (!intent) {
				return `Error: Intent "${params.intent_id}" not found.`
			}

			// Format as XML for prompt injection
			const xml = `
<intent_context>
  <id>${intent.id}</id>
  <name>${intent.name}</name>
  <status>${intent.status}</status>
  <constraints>${intent.constraints?.join("\n- ") || "None"}</constraints>
  <owned_scope>${intent.owned_scope?.join("\n- ") || "None"}</owned_scope>
  <acceptance_criteria>${intent.acceptance_criteria?.join("\n- ") || "None"}</acceptance_criteria>
</intent_context>
      `.trim()

			// Store active intent ID in VS Code workspace state (for gatekeeper)
			await vscode.workspace
				.getConfiguration()
				.update("roo.activeIntentId", params.intent_id, vscode.ConfigurationTarget.Workspace)

			return xml
		} catch (err: any) {
			return `Error loading intent: ${err.message}`
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
