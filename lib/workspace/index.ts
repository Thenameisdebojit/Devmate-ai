/**
 * Workspace Intelligence Layer (WIL)
 * 
 * Main entry point for workspace-native AI system.
 * Replaces "App Generator" semantics with workspace intelligence.
 */

export {
  WorkspaceIntelligenceDaemon,
  getWorkspaceDaemon,
  stopWorkspaceDaemon,
  type WorkspaceEvent,
  type WorkspaceState,
  type FileState,
  type EditorState,
  type RuntimeState,
  type BuildState,
  type DependencyState,
  type TerminalState,
  type IntentScore,
} from './workspaceDaemon'

export {
  ResidentAgent,
  getResidentAgent,
  destroyResidentAgent,
  type AgentState,
  type ReasoningTask,
  type AgentSuggestion,
} from './residentAgent'

