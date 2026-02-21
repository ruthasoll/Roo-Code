// src/mcp/client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import * as vscode from "vscode"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"

let cachedClient: Client | null = null

/**
 * Connects to the 10academy MCP server (or any MCP proxy)
 * Caches the client to avoid repeated connections
 */
export async function getMCPClient(): Promise<Client> {
	if (cachedClient) {
		console.log("[MCP] Using cached client connection")
		return cachedClient
	}

	try {
		// read configuration from workspace settings (defaults supplied by package.json)
		const url =
			vscode.workspace.getConfiguration().get<string>("roo-cline.mcpUrl") ||
			"https://mcppulse.10academy.org/proxy"
		const serverName =
			vscode.workspace.getConfiguration().get<string>("roo-cline.mcpServerName") || "tenxfeedbackanalytics"

		const transport = new StreamableHTTPClientTransport(new URL(url), {
			requestInit: {
				headers: {
					"X-Server-Name": serverName,
					// Add auth if required later (Bearer token, API key, etc.)
					// 'Authorization': 'Bearer YOUR_TOKEN_HERE',
				},
			},
		})

		const client = new Client(
			{
				name: "Roo Code",
				version: vscode.extensions.getExtension("roo-code")?.packageJSON?.version || "0.0.0",
			},
			{ capabilities: {} },
		)

		await client.connect(transport)

		cachedClient = client

		// Optional: Log discovered tools on connect
		const tools: any = await client.listTools()
		console.log(
			"[MCP] Connected to server. Available tools:",
			Array.isArray(tools) ? tools.map((t: any) => t.name) : tools,
		)

		vscode.window.showInformationMessage("MCP client connected to 10academy server")

		return client
	} catch (err: any) {
		console.error("[MCP] Connection failed:", err)
		vscode.window.showErrorMessage(`MCP connection error: ${err.message}`)
		throw err
	}
}

/**
 * Call a tool on the MCP server
 * Example usage: await callMCPTool('get_feedback', { projectId: '123' })
 */
export async function callMCPTool(toolName: string, args: Record<string, unknown> = {}): Promise<any> {
	const client = await getMCPClient()
	try {
		const result = await client.request(
			{
				method: "tools/call",
				params: {
					name: toolName,
					arguments: args,
				},
			},
			CallToolResultSchema,
			{ timeout: 0 },
		)
		return result
	} catch (err: any) {
		console.error(`[MCP] Tool call failed (${toolName}):`, err)
		throw err
	}
}
// ...existing code...
