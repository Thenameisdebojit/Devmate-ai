/**
 * Terminal Tasks
 * 
 * Defines and manages terminal tasks (build, test, run, etc.).
 */

export interface TerminalTask {
  id: string
  name: string
  command: string
  cwd?: string
  env?: Record<string, string>
  problemMatcher?: string[]
  isBackground?: boolean
  presentation?: {
    echo: boolean
    reveal: 'always' | 'silent' | 'never'
    focus: boolean
    panel: 'shared' | 'dedicated' | 'new'
  }
}

/**
 * Predefined terminal tasks
 */
export const PREDEFINED_TASKS: Record<string, TerminalTask> = {
  'build': {
    id: 'build',
    name: 'Build',
    command: 'npm run build',
    problemMatcher: ['$tsc', '$eslint'],
    presentation: {
      echo: true,
      reveal: 'always',
      focus: false,
      panel: 'shared',
    },
  },
  'test': {
    id: 'test',
    name: 'Test',
    command: 'npm test',
    problemMatcher: [],
    presentation: {
      echo: true,
      reveal: 'always',
      focus: false,
      panel: 'shared',
    },
  },
  'run': {
    id: 'run',
    name: 'Run',
    command: 'npm start',
    isBackground: true,
    presentation: {
      echo: true,
      reveal: 'always',
      focus: false,
      panel: 'dedicated',
    },
  },
  'clean': {
    id: 'clean',
    name: 'Clean',
    command: 'npm run clean || rm -rf dist build .next',
    presentation: {
      echo: true,
      reveal: 'silent',
      focus: false,
      panel: 'shared',
    },
  },
}

/**
 * Terminal Task Manager
 */
export class TerminalTaskManager {
  private static instance: TerminalTaskManager
  private tasks: Map<string, TerminalTask> = new Map()
  private runningTasks: Map<string, { taskId: string; startedAt: number }> = new Map()

  private constructor() {
    // Initialize with predefined tasks
    Object.values(PREDEFINED_TASKS).forEach((task) => {
      this.tasks.set(task.id, task)
    })
  }

  static getInstance(): TerminalTaskManager {
    if (!TerminalTaskManager.instance) {
      TerminalTaskManager.instance = new TerminalTaskManager()
    }
    return TerminalTaskManager.instance
  }

  /**
   * Register a task
   */
  registerTask(task: TerminalTask): void {
    this.tasks.set(task.id, task)
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TerminalTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TerminalTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * Execute a task
   */
  async executeTask(taskId: string, sessionId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    // Mark task as running
    this.runningTasks.set(sessionId, { taskId, startedAt: Date.now() })

    // Task execution is handled by the terminal session
    // This just tracks the task state
  }

  /**
   * Stop a running task
   */
  stopTask(sessionId: string): void {
    this.runningTasks.delete(sessionId)
  }

  /**
   * Get running task for a session
   */
  getRunningTask(sessionId: string): { taskId: string; startedAt: number } | undefined {
    return this.runningTasks.get(sessionId)
  }
}

/**
 * Get Terminal Task Manager instance
 */
export function getTerminalTaskManager(): TerminalTaskManager {
  return TerminalTaskManager.getInstance()
}
