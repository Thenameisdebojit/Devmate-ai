# Bootstrap Generator Architecture

## Overview

The Bootstrap Generator is a **deterministic, non-AI file generator** that creates minimal runnable project structures for empty workspaces. It is the foundation of the "golden path" execution flow in Devmate AI's App Generator IDE.

## Why BootstrapGenerator Exists

### Problem Statement

Before Phase -1, the App Generator IDE had a critical failure mode:

1. **Empty workspace → Agent fails**: When users opened a fresh project, the agent would fail because:
   - No files exist to provide context
   - Runtime cannot start without files
   - Agent has nothing to read or modify
   - UI shows constant errors

2. **Invalid input → Agent fails**: Users typing casual messages like "hi" would trigger agent execution with invalid intents, causing guaranteed failures.

3. **No guaranteed first execution**: There was no deterministic path from "empty workspace" to "runnable project" without AI involvement.

### Solution: Pre-Agent Bootstrap

The Bootstrap Generator solves this by:

- **Creating files BEFORE agent execution**: When workspace is empty, bootstrap runs first
- **No AI dependency**: Uses deterministic templates, not LLM calls
- **Guaranteed success**: Always creates valid, runnable project structures
- **Fast execution**: No network calls, no AI latency

## Why AI is Not Used for First Execution

### 1. Reliability

- **AI is non-deterministic**: LLM calls can fail, timeout, or produce invalid output
- **Bootstrap must succeed**: The first execution path cannot fail
- **No fallback**: If bootstrap fails, the entire IDE is unusable

### 2. Speed

- **Instant feedback**: Bootstrap completes in milliseconds
- **No network latency**: No API calls to external services
- **Better UX**: Users see files appear immediately

### 3. Cost

- **No token usage**: Bootstrap doesn't consume LLM tokens
- **Free operation**: Works without API keys or credits
- **Scalable**: Can bootstrap thousands of projects without cost

### 4. Architecture Separation

- **Pre-agent vs Agent**: Bootstrap is pre-agent infrastructure
- **Clear boundaries**: Agent only runs after files exist
- **Simpler debugging**: Bootstrap failures are easy to trace (no AI variables)

## How This Mirrors Real IDEs

### Replit

- **Template selection**: Replit shows templates (React, Node, Python) before code generation
- **Instant workspace**: Templates create files immediately
- **Then customization**: Users can then modify or generate custom code

### GitHub Codespaces

- **Repository bootstrap**: Codespaces starts with existing files or templates
- **Never empty**: Workspace always has some initial structure
- **Then development**: Users build on top of existing files

### VS Code

- **Project templates**: VS Code extensions provide project templates
- **Scaffolding**: Tools like Yeoman create initial structure
- **Then editing**: Users modify the scaffolded code

## Implementation Details

### File Structure

```
lib/bootstrap/
  └── BootstrapGenerator.ts
```

### Supported Platforms

1. **Web** (default)
   - `index.html`
   - `style.css`
   - `script.js`
   - Minimal, runnable web app

2. **Node.js**
   - `package.json`
   - `index.js`
   - Simple HTTP server

3. **React (Vite)**
   - `package.json`
   - `vite.config.ts`
   - `index.html`
   - `src/main.tsx`
   - `src/App.tsx`
   - `src/index.css`
   - `src/App.css`
   - Full React + Vite setup

### Integration Points

1. **Generate Intent Handler** (`core/agent/AgentExecutionRouter.ts`)
   ```typescript
   if (fileCount === 0) {
     await BootstrapGenerator.run({ projectId, rootPath, platform })
     return // Don't run AI generation
   }
   ```

2. **Intent Gating** (`core/agent/AgentExecutionRouter.ts`)
   ```typescript
   // mutate, fix, run all check fileCount === 0 and reject
   if (fileCount === 0) {
     throw new Error('Workspace is empty. Generate files first.')
   }
   ```

3. **Command Bar UX** (`components/ide/IDECommandBar.tsx`)
   - Validates input before sending to backend
   - Shows helpful placeholders
   - Allows empty input for generate (triggers bootstrap)

### Execution Flow

```
User clicks "Generate"
  ↓
IntentBuilder.build('generate', input)
  ↓
AgentExecutionRouter.handleGenerate()
  ↓
Check: fileCount === 0?
  ├─ YES → BootstrapGenerator.run()
  │         ↓
  │         Create files via FileMutationKernel
  │         ↓
  │         Emit FILE_CHANGED events
  │         ↓
  │         Return AGENT_DONE
  │
  └─ NO → Continue with AI generation
            ↓
            generateAppDirect()
            ↓
            Apply files via FileMutationKernel
            ↓
            Return AGENT_DONE
```

## Rules & Constraints

### Must NOT

- ❌ Use LLMs or AI
- ❌ Depend on AgentExecutionRouter
- ❌ Use ContextBuilder
- ❌ Make network calls
- ❌ Have non-deterministic behavior

### Must

- ✅ Use FileMutationKernel for all writes
- ✅ Create project root if missing
- ✅ Succeed deterministically
- ✅ Emit FILE_CHANGED events
- ✅ Return clear success/failure

## Testing

### Acceptance Test

1. Open App Generator
2. Fresh project (empty workspace)
3. Click "Generate" (no input)
4. **Expected**: Files appear in sidebar
5. **Expected**: Runtime can start
6. **Expected**: Terminal attaches
7. **Expected**: Preview loads (web)

### Failure Conditions (Must Not Happen)

- ❌ Agent fails on first Generate
- ❌ No files appear on empty workspace
- ❌ Runtime does not start after bootstrap
- ❌ UI allows invalid execution
- ❌ Any AI hallucination in bootstrap

## Future Enhancements

1. **More Platforms**: Python, Go, Rust templates
2. **Custom Templates**: User-defined bootstrap templates
3. **Template Selection UI**: Let users choose platform before bootstrap
4. **Template Versioning**: Support multiple versions of templates

## Related Components

- `FileMutationKernel`: All file writes go through this
- `AgentExecutionRouter`: Routes intents, checks fileCount
- `IntentBuilder`: Creates ExecutionIntent objects
- `WorkspaceRegistry`: Manages workspace state
- `RuntimeKernel`: Starts runtime after files exist
