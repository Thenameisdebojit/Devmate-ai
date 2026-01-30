/**
 * PHASE F′-1: Devmate P-OS Kernel
 * 
 * Project Evolution Engine (PEE) — The foundational governance layer of Devmate P-OS,
 * the world's first Project-Native Autonomous Development Operating System.
 * 
 * This kernel is pure, deterministic logic that:
 * - Knows what a project is
 * - Knows what stage the project is in
 * - Knows what capabilities are allowed
 * - Knows what role the AI may play
 * - Arbitrates execution without modifying existing behavior
 * 
 * RULES:
 * - NO UI imports
 * - NO FileMutationKernel imports
 * - NO AgentExecutionRouter imports
 * - NO OpenAI calls
 * - NO disk writes
 * - NO workspace state mutations
 * - Pure logic only
 */

import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

/**
 * 1️⃣ ProjectDescriptor (IDENTITY)
 * 
 * Rules:
 * - Created once
 * - Never inferred by AI
 * - Never auto-mutated
 */
export type ProjectDescriptor = {
  projectId: string
  template: "static-web" | "node" | "react" | "custom"
  language: "js" | "ts" | "py"
  runtime: "browser" | "node" | "python"
}

/**
 * PHASE F′-9: Autonomy Mode
 * 
 * Controls long-horizon autonomy behavior.
 * Default: manual (user must prompt each step)
 */
export type AutonomyMode = "manual" | "guided" | "long-horizon"

/**
 * 2️⃣ ProjectStage (LIFECYCLE — AUTHORITATIVE)
 * 
 * Rules:
 * - Single source of truth
 * - No implicit transitions
 * - Stage changes must be explicit API calls
 */
export type ProjectStage =
  | "empty"
  | "bootstrapped"
  | "editable"
  | "evolving"
  | "locked"

/**
 * 3️⃣ Capability Matrix (LAW)
 * 
 * Capabilities MUST be derived ONLY from ProjectStage.
 * No UI, agent, or intent may override this.
 */
export type Capabilities = {
  userEdit: boolean
  aiWrite: false | "scoped" | "planned"
  run: boolean
  regenerate: boolean
}

/**
 * 4️⃣ AI Role Resolver (INTELLIGENCE GOVERNOR)
 * 
 * Strict mapping enforced by kernel.
 */
export type AIRole =
  | "observer"
  | "explainer"
  | "assistant"
  | "architect"

/**
 * 5️⃣ ExecutionRequest (AUTHORITY ENTRY POINT)
 */
export type ExecutionRequest = {
  actor: "user" | "ai"
  intent: ExecutionIntent
  targetFiles?: string[]
}

/**
 * 6️⃣ AuthorizationResult (OS DECISION)
 */
export type AuthorizationResult =
  | { status: "allow" }
  | { status: "deny"; reason: string }
  | { status: "defer"; reason: string }
  | { status: "downgrade"; role: AIRole; reason: string }

/**
 * PROJECT EVOLUTION ENGINE — KERNEL IMPLEMENTATION
 * 
 * Pure, deterministic OS-level kernel that governs project evolution.
 */
export class ProjectEvolutionEngine {
  private descriptor: ProjectDescriptor
  private stage: ProjectStage
  private autonomyMode: AutonomyMode // PHASE F′-9: Autonomy mode (read-only from outside)

  constructor(descriptor: ProjectDescriptor, autonomyMode: AutonomyMode = "manual") {
    this.descriptor = descriptor
    // Initialize stage based on descriptor (default to empty)
    this.stage = "empty"
    this.autonomyMode = autonomyMode // PHASE F′-9: Initialize autonomy mode
  }

  /**
   * Get current project stage
   */
  getStage(): ProjectStage {
    return this.stage
  }

  /**
   * Set project stage (explicit transition only)
   */
  setStage(stage: ProjectStage): void {
    this.stage = stage
  }

  /**
   * Get capabilities derived from current stage
   * 
   * Capability Matrix:
   * - empty: userEdit=false, aiWrite=false, run=false, regenerate=false
   * - bootstrapped: userEdit=true, aiWrite=false, run=true, regenerate=false
   * - editable: userEdit=true, aiWrite="scoped", run=true, regenerate=false
   * - evolving: userEdit=true, aiWrite="planned", run=true, regenerate=true
   * - locked: userEdit=false, aiWrite=false, run=true, regenerate=false
   */
  getCapabilities(): Capabilities {
    switch (this.stage) {
      case "empty":
        return {
          userEdit: false,
          aiWrite: false,
          run: false,
          regenerate: false,
        }
      
      case "bootstrapped":
        return {
          userEdit: true,
          aiWrite: false,
          run: true,
          regenerate: false,
        }
      
      case "editable":
        return {
          userEdit: true,
          aiWrite: "scoped",
          run: true,
          regenerate: false,
        }
      
      case "evolving":
        return {
          userEdit: true,
          aiWrite: "planned",
          run: true,
          regenerate: true,
        }
      
      case "locked":
        return {
          userEdit: false,
          aiWrite: false,
          run: true,
          regenerate: false,
        }
      
      default:
        // Fallback to most restrictive
        return {
          userEdit: false,
          aiWrite: false,
          run: false,
          regenerate: false,
        }
    }
  }

  /**
   * Get AI role based on current stage
   * 
   * Strict mapping:
   * - empty → observer
   * - bootstrapped → explainer
   * - editable → assistant
   * - evolving → architect
   * - locked → observer
   */
  /**
   * PHASE F′-9: Get autonomy mode (read-only)
   */
  getAutonomyMode(): AutonomyMode {
    return this.autonomyMode
  }

  /**
   * PHASE F′-9: Set autonomy mode (only allowed in editable stage)
   */
  setAutonomyMode(mode: AutonomyMode): void {
    if (this.stage === "locked" || this.stage === "empty") {
      throw new Error(`Cannot set autonomy mode in ${this.stage} stage`)
    }
    this.autonomyMode = mode
  }

  getAIRole(): AIRole {
    switch (this.stage) {
      case "empty":
        return "observer"
      
      case "bootstrapped":
        return "explainer"
      
      case "editable":
        return "assistant"
      
      case "evolving":
        return "architect"
      
      case "locked":
        return "observer"
      
      default:
        return "observer"
    }
  }

  /**
   * Authorize execution request
   * 
   * Rules:
   * - NEVER throws
   * - NEVER performs side effects
   * - Returns structured decisions only
   */
  authorizeExecution(req: ExecutionRequest): AuthorizationResult {
    const capabilities = this.getCapabilities()
    const aiRole = this.getAIRole()
    const { actor, intent } = req

    // User actions are always allowed (user has ultimate authority)
    if (actor === "user") {
      // Check if user action is allowed by capabilities
      switch (intent.type) {
        case "generate":
          // Generation allowed in empty stage or if regenerate is enabled
          if (this.stage === "empty" || capabilities.regenerate) {
            return { status: "allow" }
          }
          return { status: "deny", reason: "Generation not allowed in current stage" }
        
        case "mutate":
        case "fix":
          // Mutations require userEdit capability
          if (capabilities.userEdit) {
            return { status: "allow" }
          }
          return { status: "deny", reason: "File editing not allowed in current stage" }
        
        case "run":
          // Run requires run capability
          if (capabilities.run) {
            return { status: "allow" }
          }
          return { status: "deny", reason: "Running not allowed in current stage" }
        
        case "explain":
        case "debug":
          // Read-only operations always allowed
          return { status: "allow" }
        
        case "expand_features":
        case "redesign_ui":
        case "migrate_framework":
          // Evolution intents require evolving stage or regenerate capability
          if (this.stage === "evolving" || capabilities.regenerate) {
            return { status: "allow" }
          }
          // Downgrade to assistant role if in editable stage
          if (this.stage === "editable" && capabilities.aiWrite === "scoped") {
            return {
              status: "downgrade",
              role: "assistant",
              reason: "Evolution intents require evolving stage, downgrading to scoped assistant mode"
            }
          }
          return {
            status: "deny",
            reason: "Evolution intents require evolving stage or regenerate capability"
          }
        
        default:
          return { status: "allow" }
      }
    }

    // AI actions are governed by capabilities and role
    if (actor === "ai") {
      // AI cannot act in empty or locked stages (observer role)
      if (this.stage === "empty" || this.stage === "locked") {
        return {
          status: "deny",
          reason: `AI is in observer role and cannot execute actions in ${this.stage} stage`
        }
      }

      // Check AI write capability
      if (intent.type === "generate" || intent.type === "mutate" || intent.type === "fix") {
        if (capabilities.aiWrite === false) {
          return {
            status: "deny",
            reason: "AI write operations not allowed in current stage"
          }
        }
        
        // Evolution intents require "planned" mode
        if (
          intent.type === "expand_features" ||
          intent.type === "redesign_ui" ||
          intent.type === "migrate_framework"
        ) {
          if (capabilities.aiWrite !== "planned") {
            return {
              status: "deny",
              reason: "Evolution intents require planned AI write mode (evolving stage)"
            }
          }
        }
      }

      // Check if AI role matches intent complexity
      if (intent.type === "explain" || intent.type === "debug") {
        // Read-only operations allowed for explainer and above
        if (aiRole === "observer") {
          return {
            status: "deny",
            reason: "AI observer role cannot perform explain/debug operations"
          }
        }
        return { status: "allow" }
      }

      // Run operations require run capability
      if (intent.type === "run") {
        if (capabilities.run) {
          return { status: "allow" }
        }
        return { status: "deny", reason: "Run operations not allowed in current stage" }
      }

      // Evolution intents require architect role
      if (
        intent.type === "expand_features" ||
        intent.type === "redesign_ui" ||
        intent.type === "migrate_framework"
      ) {
        if (aiRole !== "architect") {
          return {
            status: "downgrade",
            role: aiRole,
            reason: `Evolution intents require architect role, current role is ${aiRole}`
          }
        }
      }

      // Default: allow if capabilities permit
      return { status: "allow" }
    }

    // Unknown actor type
    return {
      status: "deny",
      reason: `Unknown actor type: ${(req as any).actor}`
    }
  }
}

/**
 * Factory function to create ProjectEvolutionEngine instance
 */
export function createProjectEvolutionEngine(
  descriptor: ProjectDescriptor,
  autonomyMode: AutonomyMode = "manual"
): ProjectEvolutionEngine {
  return new ProjectEvolutionEngine(descriptor, autonomyMode)
}
