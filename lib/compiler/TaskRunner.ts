/**
 * Task Runner
 * 
 * Executes build tasks and manages task dependencies.
 */

import { spawn, ChildProcess } from 'child_process'
import { BuildTask } from './BuildConfig'
import { EventEmitter } from 'events'

export interface TaskExecution {
  taskId: string
  process: ChildProcess
  startedAt: number
  output: string
  errors: string
}

export interface TaskResult {
  taskId: string
  success: boolean
  output: string
  errors: string
  duration: number
  exitCode?: number
}

/**
 * Task Runner
 * 
 * Executes build tasks with dependency management.
 */
export class TaskRunner extends EventEmitter {
  private static instance: TaskRunner
  private executions: Map<string, TaskExecution> = new Map()
  private taskResults: Map<string, TaskResult> = new Map()

  private constructor() {
    super()
  }

  static getInstance(): TaskRunner {
    if (!TaskRunner.instance) {
      TaskRunner.instance = new TaskRunner()
    }
    return TaskRunner.instance
  }

  /**
   * Execute a task
   */
  async executeTask(task: BuildTask, cwd: string): Promise<TaskResult> {
    const startTime = Date.now()

    // Execute dependencies first
    if (task.dependsOn && task.dependsOn.length > 0) {
      for (const depId of task.dependsOn) {
        // Dependencies should be executed by caller
        // This is just a placeholder for dependency checking
      }
    }

    // Execute the task
    const result = await this.runTask(task, cwd, startTime)

    // Store result
    this.taskResults.set(task.id, result)

    this.emit('task-complete', { taskId: task.id, result })

    return result
  }

  /**
   * Run a task
   */
  private async runTask(
    task: BuildTask,
    cwd: string,
    startTime: number
  ): Promise<TaskResult> {
    return new Promise((resolve) => {
      const command = task.command
      const args = task.args || []
      const process = spawn(command, args, {
        cwd: task.cwd || cwd,
        env: {
          ...process.env,
          ...task.env,
        },
        shell: true,
      })

      const execution: TaskExecution = {
        taskId: task.id,
        process,
        startedAt: startTime,
        output: '',
        errors: '',
      }

      this.executions.set(task.id, execution)

      process.stdout.on('data', (data) => {
        const output = data.toString()
        execution.output += output
        this.emit('task-output', { taskId: task.id, data: output })
      })

      process.stderr.on('data', (data) => {
        const output = data.toString()
        execution.errors += output
        this.emit('task-error', { taskId: task.id, data: output })
      })

      process.on('close', (code) => {
        this.executions.delete(task.id)
        resolve({
          taskId: task.id,
          success: code === 0,
          output: execution.output,
          errors: execution.errors,
          duration: Date.now() - startTime,
          exitCode: code || undefined,
        })
      })

      process.on('error', (error) => {
        this.executions.delete(task.id)
        resolve({
          taskId: task.id,
          success: false,
          output: execution.output,
          errors: error.message,
          duration: Date.now() - startTime,
        })
      })
    })
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    const execution = this.executions.get(taskId)
    if (execution) {
      execution.process.kill()
      this.executions.delete(taskId)
      this.emit('task-cancelled', { taskId })
    }
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.taskResults.get(taskId)
  }
}

/**
 * Get Task Runner instance
 */
export function getTaskRunner(): TaskRunner {
  return TaskRunner.getInstance()
}
