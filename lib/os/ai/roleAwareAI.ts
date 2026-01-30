/**
 * PHASE F′-3: Role-Aware AI Wrapper
 * 
 * Wraps AI calls with role-specific prompts, intent reshaping, and output validation.
 */

import { callAIModel, streamAIModel, type AIRequest, type AIModel } from '@/lib/aiOrchestrator'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { combineSystemPrompts } from './rolePrompts'
import { reshapeIntent } from './intentReshaper'
import { validateOutput, sanitizeOutput } from './outputValidator'
import type { AIRole } from '../ProjectEvolutionEngine'

/**
 * Extended AI request with project context
 */
export interface RoleAwareAIRequest extends Omit<AIRequest, 'prompt' | 'systemInstruction'> {
  prompt: string
  systemInstruction?: string
  projectId?: string
  rootPath?: string
  skipRoleInjection?: boolean // For generation mode where we want full control
}

/**
 * Call AI model with role-aware prompting and validation
 */
export async function callAIModelWithRole(
  model: AIModel,
  request: RoleAwareAIRequest,
  retryCount: number = 0
): Promise<string> {
  const { projectId, rootPath, skipRoleInjection, prompt, systemInstruction, ...rest } = request

  // If skipRoleInjection is true (e.g., for generation), use original call
  if (skipRoleInjection || !projectId || !rootPath) {
    return callAIModel(model, {
      prompt,
      systemInstruction,
      ...rest,
    }, retryCount)
  }

  try {
    // Get AI role from ProjectEvolutionEngine
    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const role = pee.getAIRole()

    // PHASE F′-5: Get goal context and enhance system prompt
    let goalEnhancedSystemInstruction = systemInstruction
    try {
      const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
      const goalContext = await GoalAwareIntentRouter.getGoalContext(projectId)
      goalEnhancedSystemInstruction = GoalAwareIntentRouter.enhanceSystemPromptWithGoals(
        systemInstruction || '',
        goalContext,
        role
      )
    } catch (error: any) {
      // If goal system fails, log but continue without goal context
      console.warn('[RoleAwareAI] Failed to load goal context:', error)
    }

    // Reshape user intent based on role
    const reshapedPrompt = reshapeIntent(prompt, role)

    // Combine role prompt with goal-enhanced system instruction
    const combinedSystemInstruction = combineSystemPrompts(role, goalEnhancedSystemInstruction)

    // Call AI with role-aware and goal-aware prompts
    const response = await callAIModel(model, {
      prompt: reshapedPrompt,
      systemInstruction: combinedSystemInstruction,
      ...rest,
    }, retryCount)

    // Validate output based on role
    const validation = validateOutput(response, role)
    
    if (!validation.valid) {
      // Output violates role constraints - sanitize it
      console.warn(`[RoleAwareAI] Output validation failed for role ${role}:`, validation.reason)
      const sanitized = sanitizeOutput(response, role)
      
      // If validation suggests improvement but output is still usable, return with note
      if (validation.reason?.includes('should') || validation.reason?.includes('Consider')) {
        return sanitized
      }
      
      // For hard violations, return sanitized version with explanation
      return sanitized
    }

    return response
  } catch (error: any) {
    // If role-aware processing fails, fall back to direct call
    console.warn('[RoleAwareAI] Failed to apply role-aware processing, falling back to direct call:', error)
    return callAIModel(model, {
      prompt,
      systemInstruction,
      ...rest,
    }, retryCount)
  }
}

/**
 * Stream AI model with role-aware prompting
 */
export async function* streamAIModelWithRole(
  model: AIModel,
  request: RoleAwareAIRequest
): AsyncGenerator<string, void, unknown> {
  const { projectId, rootPath, skipRoleInjection, prompt, systemInstruction, ...rest } = request

  // If skipRoleInjection is true, use original stream
  if (skipRoleInjection || !projectId || !rootPath) {
    yield* streamAIModel(model, {
      prompt,
      systemInstruction,
      ...rest,
    })
    return
  }

  try {
    // Get AI role from ProjectEvolutionEngine
    const peeManager = getProjectEvolutionEngineManager()
    const pee = await peeManager.getEngine(projectId, rootPath)
    const role = pee.getAIRole()

    // PHASE F′-5: Get goal context and enhance system prompt
    let goalEnhancedSystemInstruction = systemInstruction
    try {
      const { GoalAwareIntentRouter } = await import('@/lib/os/goals/GoalAwareIntentRouter')
      const goalContext = await GoalAwareIntentRouter.getGoalContext(projectId)
      goalEnhancedSystemInstruction = GoalAwareIntentRouter.enhanceSystemPromptWithGoals(
        systemInstruction || '',
        goalContext,
        role
      )
    } catch (error: any) {
      // If goal system fails, log but continue without goal context
      console.warn('[RoleAwareAI] Failed to load goal context:', error)
    }

    // Reshape user intent based on role
    const reshapedPrompt = reshapeIntent(prompt, role)

    // Combine role prompt with goal-enhanced system instruction
    const combinedSystemInstruction = combineSystemPrompts(role, goalEnhancedSystemInstruction)

    // Stream AI with role-aware and goal-aware prompts
    let fullResponse = ''
    for await (const chunk of streamAIModel(model, {
      prompt: reshapedPrompt,
      systemInstruction: combinedSystemInstruction,
      ...rest,
    })) {
      fullResponse += chunk
      yield chunk
    }

    // Validate full output after streaming completes
    const validation = validateOutput(fullResponse, role)
    if (!validation.valid) {
      console.warn(`[RoleAwareAI] Streamed output validation failed for role ${role}:`, validation.reason)
      // Note: We've already yielded chunks, so we can't sanitize the stream
      // This is a limitation of streaming - validation happens after the fact
    }
  } catch (error: any) {
    // If role-aware processing fails, fall back to direct stream
    console.warn('[RoleAwareAI] Failed to apply role-aware processing, falling back to direct stream:', error)
    yield* streamAIModel(model, {
      prompt,
      systemInstruction,
      ...rest,
    })
  }
}
