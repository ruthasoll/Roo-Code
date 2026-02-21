# ARCHITECTURE_NOTES.md - Phase 0: Archaeological Dig

**Date**: February 18, 2026  
**Project**: Roo-Code Fork

## 1. Tool Loop (The Nervous System)

**Main Tool Execution Files**:

- `src/core/tools/ExecuteCommandTool.ts`
- `src/core/tools/WriteToFileTool.ts`

**Execution Function for execute_command**:  
`ExecuteCommandTool.execute`

**Execution Function for write_to_file**:  
`WriteToFileTool.execute`

**Where I will add PreToolUse / PostToolUse hooks**:  
(inside the `.execute()` functions above — this is the exact middleware boundary)

## 2. Prompt Builder

**System Prompt File**:  
`src/core/prompts/system.ts`

**Main Function / Constant**:  
`SYSTEM_PROMPT`

**Where I will enforce the Reasoning Loop** (select_active_intent):  
(modify `SYSTEM_PROMPT` in this file to force the handshake: "You MUST first call select_active_intent(intent_id) before any other action")

## 3. Flow Diagram (ASCII)

User Prompt → Webview → Extension Host → Prompt Builder (SYSTEM_PROMPT) → LLM → Tool Call → ToolExecutor → ExecuteCommandTool.execute / WriteToFileTool.execute → OS (terminal / filesystem)

## 4. Summary & Next Steps

- Tool loop found and mapped ✓
- Prompt builder found and mapped ✓
- Ready for Phase 1 (Handshake + select_active_intent tool)

Signed: [Your Name]

## Phase 4 – Optimistic Locking & Lesson Recording

- **Optimistic locking** has been incorporated into `hookEngine.preToolUse()` for write
  operations. The hook computes a SHA‑256 hash of the current file contents and compares
  it against an original hash stored in workspace configuration. If a parallel agent or
  user modified the file in the meantime the hook returns a `stale_file` error, forcing
  the agent to re‑read and retry.
- **Lesson recording** lives in `hookEngine.postToolUse()`. Any tool result that includes
  an error (or lint/test failure) triggers an append to `AGENT.md` with a timestamp, the
  failing tool name, its parameters and a brief description of the problem. This forms
  the shared “agent brain” for future analysis.
- At the middleware boundary we now enforce scope, HITL approval, optimistic locking,
  trace logging and lesson capture – Phase 4 completes the Hook Engine requirements.
- Next step: begin work on parallel orchestration and final submission prep.
