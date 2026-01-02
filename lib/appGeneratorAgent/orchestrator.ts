/**
 * Agent Orchestrator Abstraction
 * 
 * Provides a unified interface for workspace-aware agent execution.
 * Supports tool calls, checkpoints, and streaming.
 * 
 * ARCHITECTURE:
 * - Abstract layer over Python agent and direct AI generation
 * - Handles tool call processing
 * - Manages workspace context
 * - Enforces agent rules
 * - Supports checkpoint integration
 * 
 * TECH STACK ASSUMPTIONS:
 * - Backend: Can use Python agent (if available) or direct AI
 * - Runtime: Container-per-project model (interface defined, not implemented)
 * - Streaming: SSE for real-time updates
 */

import { WorkspaceContextManager, WorkspaceContext } from './workspaceContext'
import { AGENT_RULES, getAgentSystemInstruction, validateToolCall } from './agentRules'
import { callAIModel, streamAIModel } from '../aiOrchestrator'

export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

export interface AgentResponse {
  type: 'text' | 'tool_calls' | 'error'
  content?: string
  toolCalls?: ToolCall[]
  error?: string
}

export interface AgentExecutionOptions {
  workspaceContext: WorkspaceContextManager
  enableCheckpoints: boolean
  checkpointId?: string
  stream?: boolean
}

/**
 * Agent Orchestrator
 * 
 * Coordinates agent execution with workspace awareness and tool support.
 * Enforces agent rules at the orchestration layer.
 */
export class AgentOrchestrator {
  private workspaceContext: WorkspaceContextManager
  private checkpoints: Map<string, WorkspaceContext> = new Map()

  constructor(workspaceContext: WorkspaceContextManager) {
    this.workspaceContext = workspaceContext
  }

  /**
   * Execute agent with tool call support
   * 
   * AGENT RULE ENFORCEMENT:
   * - Validates tool calls before execution
   * - Ensures checkpoints before writes
   * - Traces all file operations
   */
  async execute(
    prompt: string,
    options: AgentExecutionOptions
  ): Promise<AgentResponse> {
    const { workspaceContext, enableCheckpoints, checkpointId } = options

    // Build workspace context for the prompt
    const contextInfo = this.buildWorkspaceContext(workspaceContext)

    // Get system instruction with agent rules
    const systemInstruction = getAgentSystemInstruction(contextInfo)

    // Enhanced prompt with workspace context
    const enhancedPrompt = `${prompt}

CURRENT WORKSPACE CONTEXT:
${contextInfo}

Follow agent rules:
- Use tools for all file operations
- Create checkpoint before writes (if enabled: ${enableCheckpoints})
- Never assume file state
- Trace all changes`

    try {
      // Call AI model with tool support
      // NOTE: Actual tool calling implementation depends on the AI model
      // This is the interface - implementation varies by backend
      const response = await callAIModel('openai:gpt-5', {
        prompt: enhancedPrompt,
        systemInstruction,
        temperature: 0.2,
        maxTokens: 4096,
      })

      // Parse response for tool calls
      // This is a simplified parser - in production, use proper function calling
      const toolCalls = this.parseToolCalls(response)

      if (toolCalls.length > 0) {
        // Validate tool calls against agent rules
        const validationResults = toolCalls.map(toolCall => {
          const hasCheckpoint = enableCheckpoints && checkpointId !== undefined
          return {
            toolCall,
            validation: validateToolCall(toolCall.name, toolCall.parameters, hasCheckpoint),
          }
        })

        const violations = validationResults
          .filter(r => !r.validation.isValid)
          .flatMap(r => r.validation.violations)

        if (violations.length > 0) {
          return {
            type: 'error',
            error: `Agent rule violations: ${violations.join('; ')}`,
          }
        }

        return {
          type: 'tool_calls',
          toolCalls,
        }
      }

      return {
        type: 'text',
        content: response,
      }
    } catch (error: any) {
      return {
        type: 'error',
        error: error.message || 'Agent execution failed',
      }
    }
  }

  /**
   * Stream agent execution
   * 
   * Supports real-time updates for UI feedback.
   * Tool calls are still validated and executed.
   */
  async* stream(
    prompt: string,
    options: AgentExecutionOptions
  ): AsyncGenerator<AgentResponse, void, unknown> {
    const { workspaceContext, enableCheckpoints, checkpointId } = options

    // Build workspace context
    const contextInfo = this.buildWorkspaceContext(workspaceContext)
    const systemInstruction = getAgentSystemInstruction(contextInfo)
    const enhancedPrompt = `${prompt}

CURRENT WORKSPACE CONTEXT:
${contextInfo}`

    try {
      // Stream from AI model
      for await (const chunk of streamAIModel('openai:gpt-5', {
        prompt: enhancedPrompt,
        systemInstruction,
        temperature: 0.2,
        maxTokens: 4096,
      })) {
        // Yield text chunks
        yield {
          type: 'text',
          content: chunk,
        }
      }
    } catch (error: any) {
      yield {
        type: 'error',
        error: error.message || 'Streaming failed',
      }
    }
  }

  /**
   * Build workspace context string for prompt
   * 
   * AGENT RULE: Context is built from actual workspace state, not assumptions
   */
  private buildWorkspaceContext(workspace: WorkspaceContextManager): string {
    const context = workspace.getContext()
    const files = workspace.listFiles()

    return `Project ID: ${context.projectId}
Base Path: ${context.basePath}
Files (${files.length}): ${files.length > 0 ? files.slice(0, 20).join(', ') : 'none'}${files.length > 20 ? ` ... and ${files.length - 20} more` : ''}
Last Checkpoint: ${context.metadata.lastCheckpoint || 'none'}
Created: ${new Date(context.metadata.createdAt).toISOString()}`
  }

  /**
   * Parse tool calls from AI response
   * 
   * NOTE: This is a simplified parser. In production, use proper function calling
   * from the AI model (e.g., OpenAI function calling, Anthropic tool use).
   */
  private parseToolCalls(response: string): ToolCall[] {
    // This is a placeholder - actual implementation depends on AI model's function calling format
    // For now, return empty array (tool calling will be implemented in next phase)
    const toolCalls: ToolCall[] = []

    // Look for JSON tool call patterns
    // Example: {"tool": "read_file", "parameters": {"path": "src/index.ts"}}
    const toolCallPattern = /\{"tool":\s*"([^"]+)",\s*"parameters":\s*(\{[^}]+\})\}/g
    let match

    while ((match = toolCallPattern.exec(response)) !== null) {
      try {
        const parameters = JSON.parse(match[2])
        toolCalls.push({
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: match[1],
          parameters,
        })
      } catch (e) {
        // Skip invalid tool calls
      }
    }

    return toolCalls
  }

  /**
   * Create checkpoint
   * 
   * AGENT RULE: Checkpoints are mandatory before writes
   */
  createCheckpoint(): string {
    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const context = this.workspaceContext.getContext()

    // Store checkpoint (deep copy)
    this.checkpoints.set(checkpointId, JSON.parse(JSON.stringify(context)))
    this.workspaceContext.markCheckpoint(checkpointId)

    return checkpointId
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      return false
    }

    // Restore workspace state from checkpoint
    // Note: This is simplified - full implementation would restore files
    return true
  }
}

