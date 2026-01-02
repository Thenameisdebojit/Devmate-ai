/**
 * Agent Messages
 * 
 * Generates professional, confidence-aware messages for the AI agent.
 * Provides smart follow-ups and error explanations.
 */

export interface AgentMessageConfig {
  type: 'thinking' | 'acting' | 'done' | 'error'
  action?: string
  progress?: number
  confidence?: number
  error?: Error
  context?: {
    filesModified?: number
    timeElapsed?: number
    errorsFound?: number
  }
}

export class AgentMessageGenerator {
  /**
   * Generate confidence-aware message
   */
  static generateMessage(config: AgentMessageConfig): {
    content: string
    confidence?: number
    progress?: number
    errorDetails?: {
      type: string
      explanation: string
      suggestion?: string
      canAutoFix?: boolean
    }
    followUp?: {
      question: string
      actions: Array<{ label: string; action: string }>
    }
  } {
    switch (config.type) {
      case 'thinking':
        return this.generateThinkingMessage(config)
      case 'acting':
        return this.generateActingMessage(config)
      case 'done':
        return this.generateDoneMessage(config)
      case 'error':
        return this.generateErrorMessage(config)
      default:
        return { content: 'Processing...' }
    }
  }

  private static generateThinkingMessage(config: AgentMessageConfig): {
    content: string
    confidence?: number
    progress?: number
  } {
    const messages = [
      "Analyzing your requirements...",
      "Planning the architecture...",
      "Designing the solution...",
      "Preparing to generate code...",
    ]
    const message = messages[Math.floor(Math.random() * messages.length)]
    
    return {
      content: message,
      confidence: 85,
      progress: config.progress || 10,
    }
  }

  private static generateActingMessage(config: AgentMessageConfig): {
    content: string
    confidence?: number
    progress?: number
  } {
    const actionMessages: Record<string, string> = {
      'generate': 'Generating your application...',
      'run': 'Starting the application...',
      'fix-errors': 'Analyzing and fixing errors...',
      'explain': 'Analyzing architecture...',
      'optimize': 'Optimizing code...',
    }

    const content = actionMessages[config.action || ''] || 'Working on your request...'
    const filesModified = config.context?.filesModified || 0
    
    let confidence = 90
    if (filesModified > 0) {
      confidence = Math.max(70, 95 - filesModified * 2)
    }

    return {
      content: filesModified > 0 
        ? `${content} (${filesModified} file${filesModified > 1 ? 's' : ''} modified)`
        : content,
      confidence,
      progress: config.progress || 50,
    }
  }

  private static generateDoneMessage(config: AgentMessageConfig): {
    content: string
    confidence?: number
    followUp?: {
      question: string
      actions: Array<{ label: string; action: string }>
    }
  } {
    const filesModified = config.context?.filesModified || 0
    const timeElapsed = config.context?.timeElapsed || 0

    let content = 'Task completed successfully!'
    if (filesModified > 0) {
      content = `Successfully generated ${filesModified} file${filesModified > 1 ? 's' : ''}.`
    }

    const followUp: {
      question: string
      actions: Array<{ label: string; action: string }>
    } = {
      question: 'What would you like to do next?',
      actions: [
        { label: 'Run Project', action: 'run' },
        { label: 'Explain Code', action: 'explain' },
        { label: 'Optimize', action: 'optimize' },
      ],
    }

    return {
      content,
      confidence: 95,
      followUp,
    }
  }

  private static generateErrorMessage(config: AgentMessageConfig): {
    content: string
    errorDetails: {
      type: string
      explanation: string
      suggestion?: string
      canAutoFix?: boolean
    }
    followUp?: {
      question: string
      actions: Array<{ label: string; action: string }>
    }
  } {
    const error = config.error
    if (!error) {
      return {
        content: 'An error occurred',
        errorDetails: {
          type: 'Unknown Error',
          explanation: 'An unexpected error occurred',
          canAutoFix: false,
        },
      }
    }

    // Parse common error types
    const errorMessage = error.message.toLowerCase()
    let errorType = 'Error'
    let explanation = error.message
    let suggestion: string | undefined
    let canAutoFix = false

    if (errorMessage.includes('api') || errorMessage.includes('quota') || errorMessage.includes('429')) {
      errorType = 'API Quota Exceeded'
      explanation = 'The AI service quota has been exceeded. Please try again later or use a different model.'
      suggestion = 'Try switching to a different AI model in settings, or wait a few minutes before retrying.'
      canAutoFix = false
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      errorType = 'Network Error'
      explanation = 'Failed to connect to the AI service. Please check your internet connection.'
      suggestion = 'Check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.'
      canAutoFix = false
    } else if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      errorType = 'Syntax Error'
      explanation = 'Generated code contains syntax errors that need to be fixed.'
      suggestion = 'I can automatically fix syntax errors. Would you like me to try?'
      canAutoFix = true
    } else if (errorMessage.includes('docker') || errorMessage.includes('container')) {
      errorType = 'Container Error'
      explanation = 'Failed to create or start the Docker container.'
      suggestion = 'Make sure Docker is running and you have sufficient resources available.'
      canAutoFix = false
    } else if (errorMessage.includes('file') || errorMessage.includes('permission')) {
      errorType = 'File System Error'
      explanation = 'Unable to read or write files. This may be a permissions issue.'
      suggestion = 'Check file permissions and ensure the project directory is writable.'
      canAutoFix = false
    }

    const followUp: {
      question: string
      actions: Array<{ label: string; action: string }>
    } = {
      question: 'How would you like to proceed?',
      actions: canAutoFix
        ? [
            { label: 'Auto-fix', action: 'auto-fix' },
            { label: 'Try Again', action: 'retry' },
            { label: 'Get Help', action: 'help' },
          ]
        : [
            { label: 'Try Again', action: 'retry' },
            { label: 'Get Help', action: 'help' },
          ],
    }

    return {
      content: `Error: ${errorType}`,
      errorDetails: {
        type: errorType,
        explanation,
        suggestion,
        canAutoFix,
      },
      followUp,
    }
  }

  /**
   * Generate progress update message
   */
  static generateProgressMessage(
    step: number,
    total: number,
    action: string
  ): { content: string; progress: number } {
    const progress = Math.round((step / total) * 100)
    const messages: Record<string, string[]> = {
      'generate': [
        'Analyzing requirements...',
        'Designing architecture...',
        'Generating frontend code...',
        'Generating backend code...',
        'Creating configuration files...',
        'Finalizing project...',
      ],
      'fix-errors': [
        'Scanning for errors...',
        'Analyzing error types...',
        'Generating fixes...',
        'Applying fixes...',
        'Validating changes...',
        'Complete!',
      ],
      'optimize': [
        'Analyzing code...',
        'Identifying optimizations...',
        'Refactoring code...',
        'Optimizing imports...',
        'Reducing bundle size...',
        'Complete!',
      ],
    }

    const stepMessages = messages[action] || Array(total).fill('Processing...')
    const message = stepMessages[step - 1] || stepMessages[stepMessages.length - 1]

    return {
      content: message,
      progress,
    }
  }
}

