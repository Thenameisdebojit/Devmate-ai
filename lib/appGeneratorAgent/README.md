# App Generator Agent Foundation

Workspace-aware, tool-first agent foundation for the App Generator domain.

## Quick Start

```typescript
import { WorkspaceContextManager, AgentOrchestrator } from '@/lib/appGeneratorAgent'

// Initialize workspace
const workspace = new WorkspaceContextManager('project-id')
const orchestrator = new AgentOrchestrator(workspace)

// Create checkpoint before writes
const checkpointId = orchestrator.createCheckpoint()

// Execute agent
const response = await orchestrator.execute('Build a todo app', {
  workspaceContext: workspace,
  enableCheckpoints: true,
  checkpointId,
})
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Agent Rules

1. **Tool-First**: Use tools for all file operations
2. **No Assumptions**: Never assume file state
3. **Traceability**: All changes are logged
4. **Checkpoints**: Required before writes
5. **Context Building**: Explicit tool calls only

## Module Structure

- `workspaceContext.ts`: Workspace state management
- `orchestrator.ts`: Agent execution coordination
- `agentRules.ts`: Rule definitions and validation
- `index.ts`: Public API exports

## Tech Stack

- **Frontend**: Next.js + Monaco (unchanged)
- **Backend**: Agent Orchestrator abstraction
- **Runtime**: Container-per-project (interface only)
- **Storage**: File system (can be abstracted)

