/**
 * PHASE 1: Execution Intent Builder
 * 
 * Converts user commands into structured ExecutionIntent objects.
 * This is the bridge between UI actions and agent execution.
 */

export type ExecutionIntent =
  | { type: 'generate'; platform?: 'web' | 'android' | 'backend'; description: string; context?: { type: string; data: any }; isEmptyIntent?: boolean } // PHASE C: Flag for UI-level handling
  | { type: 'mutate'; files: string[]; description: string; context?: { type: string; data: any } }
  | { type: 'run'; command?: string; description: string; context?: { type: string; data: any } }
  | { type: 'debug'; description: string; context?: { type: string; data: any } }
  | { type: 'explain'; target?: string; description: string; context?: { type: string; data: any } }
  | { type: 'fix'; errors?: string[]; description: string; context?: { type: string; data: any } }
  // PHASE F: Project evolution intents
  | { type: 'expand_features'; description: string; features?: string[]; context?: { type: string; data: any } }
  | { type: 'redesign_ui'; description: string; scope?: string[]; context?: { type: string; data: any } }
  | { type: 'migrate_framework'; description: string; targetFramework?: string; context?: { type: string; data: any } }

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
        // PHASE C: Detect empty/new project intents (UI-level actions)
        const isEmptyIntent = 
          !description.trim() ||
          lowerInput === 'create a new project' ||
          lowerInput === 'new project' ||
          lowerInput === 'create project' ||
          lowerInput.startsWith('create project') ||
          lowerInput.startsWith('new project')

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
          isEmptyIntent, // PHASE C: Flag for UI-level handling
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
   * 
   * PHASE F: Checks evolution intents first
   */
  static inferFromInput(input: string): ExecutionIntent {
    const lowerInput = input.toLowerCase()

    // PHASE F: Check evolution intents first
    const evolutionIntent = this.classifyEvolutionIntent(input)
    if (evolutionIntent) {
      return evolutionIntent
    }

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

    // Generate keywords: build, create, make, generate, website, app, calculator, game, snake, todo, etc.
    if (lowerInput.includes('build') || lowerInput.includes('create') || 
        lowerInput.includes('make') || lowerInput.includes('generate') ||
        lowerInput.includes('website') || lowerInput.includes('web') ||
        lowerInput.includes('app') || lowerInput.includes('application') ||
        lowerInput.includes('calculator') || lowerInput.includes('project') ||
        lowerInput.includes('game') || lowerInput.includes('snake') ||
        lowerInput.includes('todo') || lowerInput.includes('blog') ||
        lowerInput.includes('portfolio') || lowerInput.includes('landing') ||
        lowerInput.includes('page') || lowerInput.includes('site')) {
      return IntentBuilder.build('generate', input)
    }

    // Default: generate (most common action for natural language)
    return IntentBuilder.build('generate', input)
  }

  /**
   * PHASE F: Classify user input into evolution intents
   * 
   * Rules:
   * - "add features", "add calculator logic" → expand_features
   * - "improve UI/UX", "redesign interface" → redesign_ui
   * - "convert to React", "use Next.js" → migrate_framework
   */
  static classifyEvolutionIntent(input: string): ExecutionIntent | null {
    const lowerInput = input.toLowerCase()

    // Check for expand_features
    if (
      lowerInput.includes('add feature') ||
      lowerInput.includes('add functionality') ||
      lowerInput.includes('add function') ||
      lowerInput.includes('implement') ||
      lowerInput.includes('add calculator') ||
      lowerInput.includes('add todo') ||
      lowerInput.includes('add button') ||
      lowerInput.includes('add form')
    ) {
      return this.build('expand_features', input)
    }

    // Check for redesign_ui
    if (
      lowerInput.includes('redesign') ||
      lowerInput.includes('improve ui') ||
      lowerInput.includes('improve ux') ||
      lowerInput.includes('improve interface') ||
      lowerInput.includes('improve layout') ||
      lowerInput.includes('better ui') ||
      lowerInput.includes('better design') ||
      lowerInput.includes('update ui') ||
      lowerInput.includes('update design')
    ) {
      return this.build('redesign_ui', input)
    }

    // Check for migrate_framework
    if (
      lowerInput.includes('convert to') ||
      lowerInput.includes('migrate to') ||
      lowerInput.includes('use react') ||
      lowerInput.includes('use next') ||
      lowerInput.includes('use vue') ||
      lowerInput.includes('use angular') ||
      lowerInput.includes('switch to react') ||
      lowerInput.includes('switch to next')
    ) {
      return this.build('migrate_framework', input)
    }

    return null
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
      // PHASE F: Evolution intents
      case 'expand_features':
      case 'redesign_ui':
      case 'migrate_framework':
        // These can have empty descriptions (will use defaults)
        break
    }

    return { valid: true }
  }
}

