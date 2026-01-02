/**
 * Workspace Intelligence Daemon
 * 
 * Main exports for workspace daemon
 */

export {
  WorkspaceDaemon,
  getWorkspaceDaemon,
  stopWorkspaceDaemon,
  type WorkspaceState,
  type WorkspaceEvent,
  type FileState,
  type EditorState,
  type RuntimeState,
  type BuildState,
  type IntentState,
  WorkspaceEventBus,
} from './WorkspaceDaemon'

export {
  AgentObserver,
  getAgentObserver,
  destroyAgentObserver,
  type AgentObservation,
} from './AgentObserver'

