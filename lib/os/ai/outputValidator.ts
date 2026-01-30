/**
 * PHASE F′-3: Output Validator
 * 
 * Validates AI outputs to ensure they don't violate role constraints.
 * Rejects outputs that contain forbidden content (code blocks, plans, etc.)
 * based on the AI's current role.
 */

import type { AIRole } from '../ProjectEvolutionEngine'

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  reason?: string
  sanitizedOutput?: string
}

/**
 * Validate AI output based on role constraints
 */
export function validateOutput(output: string, role: AIRole): ValidationResult {
  // Check for code blocks (```code``` or ```json```)
  const codeBlockRegex = /```[\s\S]*?```/g
  const hasCodeBlocks = codeBlockRegex.test(output)
  
  // Check for file paths that suggest file creation/modification
  const filePathRegex = /(?:create|add|modify|write|update)\s+(?:file|files?)\s+(?:named|called|at)?\s*['"]?([^\s'"]+\.(?:ts|tsx|js|jsx|css|json|md|py|html))/gi
  const hasFilePaths = filePathRegex.test(output)
  
  // Check for multi-step plans
  const planRegex = /(?:step\s+\d+|plan|roadmap|strategy|approach|steps?):/i
  const hasPlan = planRegex.test(output)
  
  switch (role) {
    case 'observer':
      // Observer: No code blocks, no file operations, no plans
      if (hasCodeBlocks) {
        return {
          valid: false,
          reason: 'Observer role cannot output code blocks. Please ask clarifying questions instead.',
          sanitizedOutput: output.replace(codeBlockRegex, '[Code removed - observer mode]')
        }
      }
      if (hasFilePaths) {
        return {
          valid: false,
          reason: 'Observer role cannot suggest file operations. Please ask questions about the project instead.',
          sanitizedOutput: output.replace(filePathRegex, '[File operation removed - observer mode]')
        }
      }
      if (hasPlan) {
        return {
          valid: false,
          reason: 'Observer role cannot create plans. Please observe and ask questions instead.',
          sanitizedOutput: output.replace(planRegex, '[Plan removed - observer mode]')
        }
      }
      return { valid: true }
    
    case 'explainer':
      // Explainer: No code blocks for modification, no file operations, no automation plans
      if (hasCodeBlocks) {
        // Check if code blocks are for explanation (inline examples) vs modification
        const modificationKeywords = /(?:modify|change|update|add|create|implement|write|fix)/i
        if (modificationKeywords.test(output)) {
          return {
            valid: false,
            reason: 'Explainer role cannot output code for modification. Please explain the existing code instead.',
            sanitizedOutput: output.replace(codeBlockRegex, '[Code modification removed - explainer mode]')
          }
        }
        // Allow code blocks for explanation purposes (showing existing code)
      }
      if (hasFilePaths && /(?:create|add|write|modify)/i.test(output)) {
        return {
          valid: false,
          reason: 'Explainer role cannot suggest file operations. Please explain existing files instead.',
          sanitizedOutput: output.replace(filePathRegex, '[File operation removed - explainer mode]')
        }
      }
      if (hasPlan && /(?:execute|implement|apply|run)/i.test(output)) {
        return {
          valid: false,
          reason: 'Explainer role cannot create execution plans. Please explain what needs to be done manually instead.',
          sanitizedOutput: output.replace(planRegex, '[Execution plan removed - explainer mode]')
        }
      }
      return { valid: true }
    
    case 'assistant':
      // Assistant: Code blocks allowed, but should be scoped diffs only
      // No multi-file plans, no new file creation suggestions
      if (hasPlan && /(?:create|add)\s+(?:new\s+)?files?/i.test(output)) {
        return {
          valid: false,
          reason: 'Assistant role cannot create new files. Please modify existing files only.',
          sanitizedOutput: output.replace(/(?:create|add)\s+(?:new\s+)?files?[^\n]*/gi, '[New file creation removed - assistant mode]')
        }
      }
      // Allow code blocks and file modifications (that's what assistant does)
      return { valid: true }
    
    case 'architect':
      // Architect: Everything allowed, but should include plan structure
      // If output has code but no plan, suggest adding a plan
      if (hasCodeBlocks && !hasPlan && output.length > 500) {
        // Large output with code but no plan structure - suggest adding plan
        return {
          valid: true, // Still valid, but could be improved
          reason: 'Architect role should present a plan before code. Consider adding a step-by-step plan.',
        }
      }
      return { valid: true }
    
    default:
      return { valid: true }
  }
}

/**
 * Sanitize output by removing role-violating content
 */
export function sanitizeOutput(output: string, role: AIRole): string {
  const validation = validateOutput(output, role)
  
  if (validation.valid) {
    return output
  }
  
  // Return sanitized version if available, otherwise return explanation
  if (validation.sanitizedOutput) {
    return `${validation.sanitizedOutput}\n\n[Note: ${validation.reason}]`
  }
  
  return `[Output removed: ${validation.reason}]`
}
