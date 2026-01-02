# App Generator Agent Architecture

## Overview

The App Generator has been refactored from a simple prompt-based generator into a **workspace-aware agent foundation** that follows strict architectural principles for agentic AI systems.

## Core Principles (Agent Rules)

### 1. Tool-First, Text-Second
- **Rule**: All file operations MUST use tool calls (write_file, read_file, list_files, delete_file)
- **Enforcement**: Text responses are ONLY for explanations. File operations go through tools.
- **Rationale**: Separates planning/explanation from execution, enabling traceability and validation.

### 2. No File State Assumptions
- **Rule**: The LLM must never assume what files exist or their content
- **Enforcement**: Always use tools: `list_files()`, `read_file()`, etc.
- **Rationale**: Prevents hallucinations and ensures the agent works with actual workspace state.

### 3. Traceable Changes
- **Rule**: All code changes must be traceable with tool name, timestamp, checkpoint reference, and checksum
- **Enforcement**: Workspace context manager logs all updates with full metadata
- **Rationale**: Enables debugging, rollback, and audit trails.

### 4. Mandatory Checkpoints
- **Rule**: Checkpoints are required before any write or delete operation
- **Enforcement**: Orchestrator enforces checkpoint creation before write tool calls
- **Rationale**: Enables state recovery and rollback capabilities.

### 5. Workspace Context Building
- **Rule**: Context is built through explicit tool calls, never inferred
- **Enforcement**: Workspace context manager requires tool calls for all operations
- **Rationale**: Ensures the agent has accurate, up-to-date workspace state.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                   │
│  - AppGeneratorPanel.tsx (UI - unchanged in refactor)   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              API Route (generate-app)                    │
│  - Workspace context initialization                      │
│  - Agent orchestrator coordination                       │
│  - Tool call processing hooks                            │
│  - Checkpoint management                                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│          Agent Orchestrator Abstraction                  │
│  - WorkspaceContextManager                               │
│  - AgentOrchestrator                                     │
│  - Agent rules enforcement                               │
│  - Tool call validation                                  │
└─────┬─────────────────────────────────────┬──────────────┘
      │                                     │
┌─────▼─────────────┐           ┌──────────▼──────────────┐
│ Python Agent      │           │ Direct AI Generation    │
│ (if available)    │           │ (fallback)              │
│ - LangGraph       │           │ - OpenAI/Anthropic      │
│ - Checkpoints     │           │ - Tool calling support  │
└───────────────────┘           └─────────────────────────┘
```

## Key Components

### WorkspaceContextManager
- **Location**: `lib/appGeneratorAgent/workspaceContext.ts`
- **Purpose**: Manages workspace state (files, metadata, checkpoints)
- **Key Methods**:
  - `listFiles()`: Discover workspace structure (tool-first)
  - `fileExists(path)`: Check file existence (never assume)
  - `updateFromToolResult()`: Update state from tool execution (traceable)
  - `markCheckpoint()`: Create checkpoint before writes

### AgentOrchestrator
- **Location**: `lib/appGeneratorAgent/orchestrator.ts`
- **Purpose**: Coordinates agent execution with tool support and rule enforcement
- **Key Methods**:
  - `execute()`: Execute agent with tool call support
  - `stream()`: Stream agent execution for real-time updates
  - `createCheckpoint()`: Create checkpoint before writes
  - `validateToolCall()`: Enforce agent rules

### AgentRules
- **Location**: `lib/appGeneratorAgent/agentRules.ts`
- **Purpose**: Defines and enforces foundational agent principles
- **Key Features**:
  - System instruction templates with embedded rules
  - Tool call validation
  - Rule violation detection

## Tech Stack Assumptions

### Frontend
- **Framework**: Next.js
- **Editor**: Monaco (no UI changes in this refactor)
- **State**: React hooks and context

### Backend
- **Abstraction**: Agent Orchestrator (this module)
- **Implementation Options**:
  - Python agent (LangGraph workflow) - if available
  - Direct AI generation (OpenAI/Anthropic) - fallback
- **Storage**: File system for workspace state (can be abstracted to database/object storage)

### Runtime
- **Model**: Container-per-project (interface defined, implementation deferred)
- **Isolation**: Each project runs in isolated workspace
- **State**: Persistent workspace state with checkpoints

## Integration Points

### API Route (`app/api/generate-app/route.ts`)
- Initializes workspace context
- Creates initial checkpoint
- Processes tool calls (if provided)
- Coordinates with Python agent or direct AI
- Updates workspace context with generated files

### Python Agent (`autonomus-dev-agent/api_wrapper.py`)
- Provides Python backend for agent execution
- Integrates with LangGraph workflow
- Supports checkpoints and state management
- Returns structured project data

## Future Enhancements (Not in Scope)

The following are intentionally deferred:
- Full tool call execution implementation (interface ready)
- Runtime container execution (interface defined)
- UI changes (Monaco integration unchanged)
- Database persistence (file system for now)
- Advanced checkpoint restoration (basic implementation)

## Migration Notes

### Backward Compatibility
- Existing direct AI generation still works
- Python agent integration unchanged
- API contract preserved (with optional new fields)

### Breaking Changes
- None (this is a foundational refactor, not a breaking change)

## Testing Strategy

1. **Unit Tests**: Test workspace context manager operations
2. **Integration Tests**: Test agent orchestrator with mock tools
3. **Rule Validation**: Test agent rule enforcement
4. **Checkpoint Tests**: Test checkpoint creation and restoration

## Documentation

- Architecture decisions documented in code comments
- Agent rules documented in `agentRules.ts`
- Tech stack assumptions documented in each module

