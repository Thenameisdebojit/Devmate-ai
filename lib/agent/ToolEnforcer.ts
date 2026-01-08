/**
 * PHASE 2: Tool-First Enforcement
 * 
 * Ensures agent execution uses tools only:
 * - read_file
 * - patch_file
 * - run_command
 * - create_checkpoint
 * 
 * If the LLM attempts to output raw code, discard it and log an error.
 */

export type AllowedTool = 'read_file' | 'patch_file' | 'run_command' | 'create_checkpoint'

export interface ToolCall {
  tool: AllowedTool
  args: Record<string, any>
}

/**
 * Tool Enforcer
 * 
 * Validates that agent actions use only approved tools.
 * Rejects raw code output.
 */
export class ToolEnforcer {
  private readonly allowedTools: Set<AllowedTool> = new Set([
    'read_file',
    'patch_file',
    'run_command',
    'create_checkpoint',
  ])

  /**
   * Validate tool call
   * 
   * Returns true if tool is allowed, false otherwise.
   */
  validateToolCall(toolCall: ToolCall): { valid: boolean; error?: string } {
    if (!this.allowedTools.has(toolCall.tool)) {
      return {
        valid: false,
        error: `Tool '${toolCall.tool}' is not allowed. Allowed tools: ${Array.from(this.allowedTools).join(', ')}`,
      }
    }

    // Validate tool-specific arguments
    switch (toolCall.tool) {
      case 'read_file':
        if (!toolCall.args.path || typeof toolCall.args.path !== 'string') {
          return { valid: false, error: 'read_file requires a path argument' }
        }
        break

      case 'patch_file':
        if (!toolCall.args.path || typeof toolCall.args.path !== 'string') {
          return { valid: false, error: 'patch_file requires a path argument' }
        }
        if (!toolCall.args.diff && !toolCall.args.content) {
          return { valid: false, error: 'patch_file requires either diff or content argument' }
        }
        break

      case 'run_command':
        if (!toolCall.args.command || typeof toolCall.args.command !== 'string') {
          return { valid: false, error: 'run_command requires a command argument' }
        }
        break

      case 'create_checkpoint':
        // No required arguments
        break
    }

    return { valid: true }
  }

  /**
   * Check if raw code output should be rejected
   * 
   * If LLM attempts to output raw code (not via tools), reject it.
   */
  validateAgentOutput(output: any): { valid: boolean; error?: string } {
    // Check if output contains raw code blocks without tool calls
    if (typeof output === 'string') {
      // Look for code blocks (```) that aren't part of tool calls
      const codeBlockPattern = /```[\s\S]*?```/g
      const hasCodeBlocks = codeBlockPattern.test(output)

      // Look for tool call indicators
      const hasToolCalls = output.includes('tool:') || output.includes('toolCall:') || output.includes('function_call')

      if (hasCodeBlocks && !hasToolCalls) {
        return {
          valid: false,
          error: 'Raw code output detected. Agent must use tools (read_file, patch_file) instead of outputting raw code.',
        }
      }
    }

    // Check if output is an object with raw code
    if (typeof output === 'object' && output !== null) {
      // If it has code/content but no tool field, reject
      if (('code' in output || 'content' in output) && !('tool' in output)) {
        return {
          valid: false,
          error: 'Raw code output detected. Agent must use patch_file tool instead of outputting raw code.',
        }
      }
    }

    return { valid: true }
  }

  /**
   * Extract tool calls from agent output
   * 
   * Parses agent output to extract tool calls.
   * Returns empty array if no valid tool calls found.
   */
  extractToolCalls(output: any): ToolCall[] {
    const toolCalls: ToolCall[] = []

    if (typeof output === 'string') {
      // Try to parse JSON tool calls from string
      try {
        const parsed = JSON.parse(output)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.tool && this.allowedTools.has(item.tool)) {
              toolCalls.push({ tool: item.tool, args: item.args || {} })
            }
          }
        } else if (parsed.tool && this.allowedTools.has(parsed.tool)) {
          toolCalls.push({ tool: parsed.tool, args: parsed.args || {} })
        }
      } catch {
        // Not JSON, try to extract from text
        // Look for patterns like "tool: read_file" or "function: patch_file"
        const toolPattern = /(?:tool|function)[:\s]+(\w+)/gi
        const matches = output.matchAll(toolPattern)
        for (const match of matches) {
          const toolName = match[1] as AllowedTool
          if (this.allowedTools.has(toolName)) {
            toolCalls.push({ tool: toolName, args: {} })
          }
        }
      }
    } else if (typeof output === 'object' && output !== null) {
      // Direct object with tool field
      if (output.tool && this.allowedTools.has(output.tool)) {
        toolCalls.push({ tool: output.tool, args: output.args || {} })
      }

      // Array of tool calls
      if (Array.isArray(output)) {
        for (const item of output) {
          if (item.tool && this.allowedTools.has(item.tool)) {
            toolCalls.push({ tool: item.tool, args: item.args || {} })
          }
        }
      }
    }

    return toolCalls
  }

  /**
   * Log error when raw code is detected
   */
  logRawCodeRejection(output: any, context?: string): void {
    console.error('[ToolEnforcer] Raw code output rejected:', {
      context: context || 'unknown',
      outputType: typeof output,
      outputPreview: typeof output === 'string' ? output.substring(0, 200) : JSON.stringify(output).substring(0, 200),
    })
  }
}

// Singleton instance
let toolEnforcerInstance: ToolEnforcer | null = null

export function getToolEnforcer(): ToolEnforcer {
  if (!toolEnforcerInstance) {
    toolEnforcerInstance = new ToolEnforcer()
  }
  return toolEnforcerInstance
}

