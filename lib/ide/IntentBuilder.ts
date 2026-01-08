/**
 * PHASE 1: Execution Intent Builder
 * 
 * Converts user commands into structured ExecutionIntent objects.
 * This is the bridge between UI actions and agent execution.
 */

export type ExecutionIntent =
  | { type: 'generate'; platform?: 'web' | 'android' | 'backend'; description: string }
  | { type: 'mutate'; files: string[]; description: string }
  | { type: 'run'; command?: string; description: string }
  | { type: 'debug'; description: string }
  | { type: 'explain'; target?: string; description: string }
  | { type: 'fix'; errors?: string[]; description: string }

/**
 * Parse user input into ExecutionIntent
 * 
 * Rules:
 * - If action is provided, use it directly
 * - Otherwise, infer from keywords in input
 * - Always include description for context
 */
export class IntentBuilder {
  static build(
    action: 'generate' | 'run' | 'fix' | 'explain',
    input?: string
  ): ExecutionIntent {
    const description = input || ''
    const lowerInput = description.toLowerCase()

    switch (action) {
      case 'generate': {
        // Detect platform from keywords
        let platform: 'web' | 'android' | 'backend' | undefined
        if (lowerInput.includes('web') || lowerInput.includes('react') || lowerInput.includes('next')) {
          platform = 'web'
        } else if (lowerInput.includes('android') || lowerInput.includes('mobile')) {
          platform = 'android'
        } else if (lowerInput.includes('backend') || lowerInput.includes('api') || lowerInput.includes('server')) {
          platform = 'backend'
        }

        return {
          type: 'generate',
          platform,
          description: description || 'Create a new project', // PHASE -1: Allow empty description for bootstrap
        }
      }

      case 'run': {
        // Extract command if provided
        const commandMatch = description.match(/run\s+(.+)/i)
        const command = commandMatch ? commandMatch[1] : undefined

        return {
          type: 'run',
          command,
          description: description || 'Run the project',
        }
      }

      case 'fix': {
        // Extract error references if provided
        const errorPatterns = [
          /error[s]?\s+(?:in|at|for)\s+([^\s]+)/gi,
          /fix\s+(?:the\s+)?(?:error[s]?|bug[s]?|issue[s]?)/gi,
        ]
        const errors: string[] = []
        
        errorPatterns.forEach((pattern) => {
          const matches = description.matchAll(pattern)
          for (const match of matches) {
            if (match[1]) errors.push(match[1])
          }
        })

        return {
          type: 'fix',
          errors: errors.length > 0 ? errors : undefined,
          description: description || 'Fix errors in the project',
        }
      }

      case 'explain': {
        // Extract target file/function if provided
        const targetMatch = description.match(/(?:explain|what\s+is)\s+([^\s]+)/i)
        const target = targetMatch ? targetMatch[1] : undefined

        return {
          type: 'explain',
          target,
          description: description || 'Explain the code',
        }
      }

      default:
        // Fallback: infer from input
        return IntentBuilder.inferFromInput(description)
    }
  }

  /**
   * Infer intent from natural language input
   */
  static inferFromInput(input: string): ExecutionIntent {
    const lowerInput = input.toLowerCase()

    // Fix errors
    if (lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
      return IntentBuilder.build('fix', input)
    }

    // Run
    if (lowerInput.includes('run') || lowerInput.includes('execute') || lowerInput.includes('start')) {
      return IntentBuilder.build('run', input)
    }

    // Explain
    if (lowerInput.includes('explain') || lowerInput.includes('what') || lowerInput.includes('how')) {
      return IntentBuilder.build('explain', input)
    }

    // Generate keywords: build, create, make, generate, website, app, calculator, etc.
    if (lowerInput.includes('build') || lowerInput.includes('create') || 
        lowerInput.includes('make') || lowerInput.includes('generate') ||
        lowerInput.includes('website') || lowerInput.includes('app') ||
        lowerInput.includes('calculator') || lowerInput.includes('project')) {
      return IntentBuilder.build('generate', input)
    }

    // Default: generate (most common action)
    return IntentBuilder.build('generate', input)
  }

  /**
   * Validate intent before execution
   */
  static validate(intent: ExecutionIntent): { valid: boolean; error?: string } {
    switch (intent.type) {
      case 'generate':
        // PHASE -1: Allow empty description for bootstrap (will create starter project)
        // Description is optional for generate
        break

      case 'mutate':
        if (!intent.files || intent.files.length === 0) {
          return { valid: false, error: 'Mutate intent requires at least one file' }
        }
        break

      case 'run':
      case 'debug':
      case 'explain':
      case 'fix':
        // These can have empty descriptions (will use defaults)
        break
    }

    return { valid: true }
  }
}

