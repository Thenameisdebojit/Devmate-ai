/**
 * PHASE F′-3: Intent Reshaper
 * 
 * Reshapes user intents based on AI role to prevent the model
 * from naturally wanting to break rules.
 */

import type { AIRole } from '../ProjectEvolutionEngine'

/**
 * Reshape user intent based on AI role
 * 
 * This prevents the AI from wanting to break rules by reframing
 * the user's request in a way that naturally fits the role's constraints.
 */
export function reshapeIntent(userInput: string, role: AIRole): string {
  const lowerInput = userInput.toLowerCase().trim()
  
  switch (role) {
    case 'observer':
      // Reframe as questions or observations
      if (lowerInput.includes('add') || lowerInput.includes('create') || lowerInput.includes('modify')) {
        return `I understand you want to: ${userInput}. However, I'm currently in observer mode and cannot make changes. Could you help me understand: What is your goal with this request? What would you like to achieve?`
      }
      if (lowerInput.includes('?') || lowerInput.endsWith('?')) {
        return userInput // Already a question
      }
      return `I'm observing the project. Could you clarify: ${userInput}?`
    
    case 'explainer':
      // Reframe as "explain X" requests
      if (lowerInput.startsWith('explain') || lowerInput.startsWith('what is') || lowerInput.startsWith('how does')) {
        return userInput // Already an explanation request
      }
      if (lowerInput.includes('add') || lowerInput.includes('create') || lowerInput.includes('modify')) {
        return `I understand you want to: ${userInput}. Let me explain the current project structure so you can make these changes manually. Which part of the project would you like me to explain first?`
      }
      return `Explain: ${userInput}`
    
    case 'assistant':
      // Reframe as "modify allowed files" requests
      if (lowerInput.includes('add') && !lowerInput.includes('file')) {
        // "add calculator logic" → "modify App.tsx to add calculator logic"
        return `Modify the relevant existing file to: ${userInput}`
      }
      if (lowerInput.includes('improve') || lowerInput.includes('redesign')) {
        // "improve UI" → "modify styling files to improve UI"
        return `Modify styling/CSS files to: ${userInput}`
      }
      if (lowerInput.includes('fix')) {
        // "fix bug" → "modify the file with the bug to fix it"
        return `Modify the file with the issue to: ${userInput}`
      }
      // Default: assume it's a modification request
      return `Modify existing files to: ${userInput}`
    
    case 'architect':
      // Reframe as "design a plan" requests
      if (lowerInput.includes('plan') || lowerInput.includes('design') || lowerInput.includes('architecture')) {
        return userInput // Already a planning request
      }
      if (lowerInput.includes('add') && lowerInput.includes('feature')) {
        return `Design a plan to: ${userInput}. Include which files to create, which to modify, and the step-by-step approach.`
      }
      if (lowerInput.includes('migrate') || lowerInput.includes('convert')) {
        return `Design a migration plan to: ${userInput}. Include all steps, file changes, and dependencies.`
      }
      if (lowerInput.includes('redesign')) {
        return `Design a redesign plan to: ${userInput}. Include UI/UX changes, component restructuring, and styling updates.`
      }
      // Default: frame as evolution request
      return `Design an evolution plan to: ${userInput}`
    
    default:
      return userInput
  }
}

/**
 * Check if intent reshaping is needed
 */
export function shouldReshapeIntent(role: AIRole): boolean {
  // Always reshape for observer and explainer (they have strict constraints)
  // Reshape for assistant and architect when the intent suggests actions outside their scope
  return true // Always reshape to be safe
}
