/**
 * App Generator Agent Module
 * 
 * Workspace-aware, tool-first agent foundation for App Generator.
 * 
 * ARCHITECTURE OVERVIEW:
 * - WorkspaceContextManager: Manages workspace state (files, metadata)
 * - AgentOrchestrator: Coordinates agent execution with tool support
 * - AgentRules: Defines and enforces foundational agent principles
 * 
 * TECH STACK ASSUMPTIONS:
 * - Frontend: Next.js + Monaco (UI layer - not modified in this refactor)
 * - Backend: Agent Orchestrator abstraction (this module)
 * - Runtime: Container-per-project model (interface defined, implementation deferred)
 * - Storage: File system for workspace state (can be abstracted to database/object storage)
 * 
 * USAGE:
 * ```typescript
 * import { WorkspaceContextManager, AgentOrchestrator } from '@/lib/appGeneratorAgent'
 * 
 * const workspace = new WorkspaceContextManager(projectId)
 * const orchestrator = new AgentOrchestrator(workspace)
 * 
 * const response = await orchestrator.execute(prompt, {
 *   workspaceContext: workspace,
 *   enableCheckpoints: true,
 * })
 * ```
 */

export { WorkspaceContextManager } from './workspaceContext'
export type { WorkspaceContext, WorkspaceFile } from './workspaceContext'

export { AgentOrchestrator } from './orchestrator'
export type { AgentResponse, ToolCall, AgentExecutionOptions } from './orchestrator'

export { AGENT_RULES, getAgentSystemInstruction, validateToolCall } from './agentRules'
export type { ToolCallValidation } from './agentRules'

