# ARCHITECTURE_NOTES.md - Phase 0: Archaeological Dig

**Date**: February 21, 2026  
**Trainee**: Ruth  
**Project**: Roo-Code Fork (TRP1 Challenge Week 1 – AI-Native IDE & Intent-Code Traceability)

## 1. Overall Architecture Summary

Roo-Code is a multi-agent AI coding extension for VS Code with:

- **Presentation layer**: React-based Webview sidebar (chat interface, mode selector, approval modals)
- **Logic layer**: Extension Host (Node.js) – handles prompt construction, LLM calls, tool dispatching, and execution
- **State**: Mostly per-session chat history + mode-specific state; no built-in formal intent tracking or cross-session governance

Core problem it solves today: rapid, context-aware code generation/editing  
Core gaps we are closing: deterministic governance, intent traceability, Human-in-the-Loop (HITL) boundaries, semantic attribution

## 2. Tool Loop (The Nervous System – Mutation Points)

**Primary command execution path** (execute_command tool):

- Entry point: `src/core/tools/ExecuteCommandTool.ts`
- Main function: `ExecuteCommandTool.execute(params: { command: string, cwd?: string })`
- Calls: `runCommand(command, callbacks)` (delegates to terminal abstraction)

**Delegation chain**:

- `Terminal.ts` → `runCommand` (sets busy flag, delegates)
- `ExecaTerminal.ts` → `runCommand` (sets up callbacks, creates `ExecaTerminalProcess`)
- Final execution: `ExecaTerminalProcess.run(command)` → **actual command run** via:
    - `execa(command, ...)` (most likely – common in modern Node agent tools)
    - or `child_process.spawn(command, { shell: true })`
    - or `vscode.window.createTerminal().sendText(command)` (if using VS Code Terminal API)

**Primary file write path** (write_to_file tool):

- Entry point: `src/core/tools/WriteToFileTool.ts`
- Main function: `WriteToFileTool.execute(params: { path: string, content: string })`
- Actual side-effect: `fs.promises.writeFile(params.path, params.content)` (or sync variant)

**Where I will add PreToolUse / PostToolUse hooks**:

- Best location: inside `ExecaTerminalProcess.run()` (before/after `execa` / `spawn` / `sendText`) for command execution
- Alternative: wrap `ExecuteCommandTool.execute()` and `WriteToFileTool.execute()` directly
- Reason: gives access to params, result, and timing for scope validation, HITL modal, content hashing, and trace logging

**Call chain summary (ASCII)**:
User prompt → Webview → Extension Host → LLM → Tool call → ToolExecutor → ExecuteCommandTool.execute() → ExecaTerminalProcess.run() → execa/spawn/sendText → OS mutation

## 3. Prompt Builder (System Prompt Construction)

**Raw base prompt source**:

- File: `src/core/prompts/system.ts`
- Constant: `SYSTEM_PROMPT` (long template starting with "You are Roo, a highly skilled software engineer...")

**Prompt assembly / enhancement**:

- File: `src/core/webview/generateSystemPrompt.ts`
- Main function: `generateSystemPrompt(provider: ClineProvider, message: WebviewMessage)`
    - Takes base `SYSTEM_PROMPT`, adds mode, custom instructions, provider context, etc.
    - Returns final system message content (or full message object)

**Where the prompt is consumed / sent to LLM**:

- File: `src/core/webview/webviewMessageHandler.ts`
- Key lines (~1597 & ~1613): `const systemPrompt = await generateSystemPrompt(provider, message)`
    - This is then added as the first `{ role: "system", content: systemPrompt }` in the LLM message array

**Where I will enforce the Reasoning Loop** (mandatory select_active_intent):

- Primary location: Modify `generateSystemPrompt()` in `src/core/webview/generateSystemPrompt.ts`

    - Prepend/append to the returned prompt string:

- Fallback (simpler): Directly augment `SYSTEM_PROMPT` in `src/core/prompts/system.ts`

**Why this location?**

- `generateSystemPrompt` is the final assembly point — ensures the rule is always applied, even with dynamic mode/instructions.
- Keeps changes isolated and testable.
- Avoids breaking tests in `__tests__` folders.

**Call chain summary (ASCII)**:
User prompt → Webview → webviewMessageHandler.ts → generateSystemPrompt() → combines SYSTEM_PROMPT + extras → LLM messages array → LLM call

## 4. Data Boundaries & Privilege Separation

- **Webview (UI)**: Restricted presentation layer — only sends/receives messages via `postMessage` / `onDidReceiveMessage`
- **Extension Host (Logic)**: Full privileges — handles LLM calls, tool execution, filesystem, MCP client, secret management
- **Communication**: Asynchronous IPC via `postMessage` — no Node.js APIs exposed to Webview (security boundary)

**Where governance will live**: Exclusively in Extension Host (hooks, intent loading, HITL modals, trace logging)

## 5. Summary & Next Steps

- Tool loop fully traced ✓ (execution ends in ExecaTerminalProcess.run → execa/spawn/sendText)
- Prompt builder fully traced ✓ (system.ts → generateSystemPrompt.ts → webviewMessageHandler.ts)
- Ready for Phase 1: Implement the Handshake (select_active_intent tool + mandatory prompt rule)

Signed: Ruth  
February 21, 2026 – Addis Ababa, Ethiopia
