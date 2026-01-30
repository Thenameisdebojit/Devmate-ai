/**
 * PHASE 2: IDE Settings Schema System
 * 
 * VS Code-identical settings schema with JSON-schema-driven validation.
 * Settings are IDE runtime state, NOT project source files.
 */

export type SettingScope = "user" | "workspace"

export type SettingType = "boolean" | "number" | "string" | "enum"

export interface IDESettingSchema {
  key: string                    // e.g. "editor.fontSize"
  title: string                  // Human readable
  description: string            // Markdown allowed
  type: SettingType
  default: any
  scope: SettingScope
  category: string               // e.g. "Text Editor / Font"
  enum?: string[]
  enumDescriptions?: string[]
  requiresRestart?: boolean
  experimental?: boolean
  minimum?: number               // For number type
  maximum?: number               // For number type
  step?: number                  // For number type (slider step)
}

/**
 * Central Settings Schema Registry
 * 
 * Contains all IDE settings with VS Code parity.
 */
export const SETTINGS_SCHEMA: IDESettingSchema[] = [
  // ========== Text Editor / Font ==========
  {
    key: "editor.fontSize",
    title: "Font Size",
    description: "Controls the font size in pixels.",
    type: "number",
    default: 14,
    scope: "user",
    category: "Text Editor / Font",
    minimum: 8,
    maximum: 100,
    step: 1,
  },
  {
    key: "editor.fontFamily",
    title: "Font Family",
    description: "Controls the font family. Uses system default if not set.",
    type: "string",
    default: "Consolas, 'Courier New', monospace",
    scope: "user",
    category: "Text Editor / Font",
  },
  {
    key: "editor.tabSize",
    title: "Tab Size",
    description: "The number of spaces a tab is equal to.",
    type: "number",
    default: 4,
    scope: "workspace",
    category: "Text Editor",
    minimum: 1,
    maximum: 8,
    step: 1,
  },
  {
    key: "editor.wordWrap",
    title: "Word Wrap",
    description: "Controls how lines should wrap. 'on' wraps at viewport width, 'off' disables wrapping.",
    type: "enum",
    default: "off",
    scope: "user",
    category: "Text Editor",
    enum: ["on", "off", "wordWrapColumn", "bounded"],
    enumDescriptions: [
      "Wrap at viewport width",
      "Disable wrapping",
      "Wrap at wordWrapColumn",
      "Wrap at minimum of viewport and wordWrapColumn",
    ],
  },
  {
    key: "editor.minimap.enabled",
    title: "Minimap Enabled",
    description: "Enable/disable the minimap.",
    type: "boolean",
    default: true,
    scope: "user",
    category: "Text Editor / Minimap",
  },
  {
    key: "editor.lineNumbers",
    title: "Line Numbers",
    description: "Controls the display of line numbers.",
    type: "enum",
    default: "on",
    scope: "user",
    category: "Text Editor",
    enum: ["on", "off", "relative", "interval"],
    enumDescriptions: [
      "Show line numbers",
      "Hide line numbers",
      "Show relative line numbers",
      "Show line numbers at intervals",
    ],
  },
  {
    key: "editor.autoSave",
    title: "Auto Save",
    description: "Controls auto save of dirty files.",
    type: "enum",
    default: "off",
    scope: "user",
    category: "Text Editor",
    enum: ["off", "afterDelay", "onFocusChange", "onWindowChange"],
    enumDescriptions: [
      "Disable auto save",
      "Auto save after a configured delay",
      "Auto save when focus changes",
      "Auto save when window loses focus",
    ],
  },
  {
    key: "editor.autoSaveDelay",
    title: "Auto Save Delay",
    description: "Controls the delay in ms after which a dirty file is saved automatically. Only applies when 'editor.autoSave' is set to 'afterDelay'.",
    type: "number",
    default: 1000,
    scope: "user",
    category: "Text Editor",
    minimum: 100,
    maximum: 10000,
    step: 100,
  },
  
  // ========== Files ==========
  {
    key: "files.exclude",
    title: "Files: Exclude",
    description: "Configure glob patterns for excluding files and folders from the explorer.",
    type: "string",
    default: "**/.git\n**/node_modules\n**/.devmate",
    scope: "workspace",
    category: "Files",
  },
  {
    key: "files.trimTrailingWhitespace",
    title: "Trim Trailing Whitespace",
    description: "When enabled, will trim trailing whitespace when saving a file.",
    type: "boolean",
    default: true,
    scope: "user",
    category: "Files",
  },
  
  // ========== Workbench ==========
  {
    key: "workbench.colorTheme",
    title: "Color Theme",
    description: "Specifies the color theme used in the workbench.",
    type: "enum",
    default: "vs-dark",
    scope: "user",
    category: "Workbench / Appearance",
    enum: ["vs", "vs-dark", "hc-black"],
    enumDescriptions: [
      "Visual Studio Light",
      "Visual Studio Dark",
      "High Contrast Dark",
    ],
  },
  {
    key: "workbench.iconTheme",
    title: "Icon Theme",
    description: "Specifies the icon theme used in the workbench.",
    type: "string",
    default: "vs-seti",
    scope: "user",
    category: "Workbench / Appearance",
  },
  {
    key: "workbench.sideBar.location",
    title: "Side Bar Location",
    description: "Controls the location of the sidebar.",
    type: "enum",
    default: "left",
    scope: "user",
    category: "Workbench",
    enum: ["left", "right"],
    enumDescriptions: [
      "Show sidebar on the left",
      "Show sidebar on the right",
    ],
  },
  {
    key: "workbench.panel.location",
    title: "Panel Location",
    description: "Controls the location of the panel (terminal, problems, etc.).",
    type: "enum",
    default: "bottom",
    scope: "user",
    category: "Workbench",
    enum: ["left", "bottom", "right"],
    enumDescriptions: [
      "Show panel on the left",
      "Show panel at the bottom",
      "Show panel on the right",
    ],
  },
  
  // ========== Terminal ==========
  {
    key: "terminal.fontSize",
    title: "Terminal Font Size",
    description: "Controls the font size in pixels of the terminal.",
    type: "number",
    default: 14,
    scope: "user",
    category: "Terminal",
    minimum: 6,
    maximum: 50,
    step: 1,
  },
  {
    key: "terminal.cursorBlink",
    title: "Terminal Cursor Blink",
    description: "Controls whether the terminal cursor blinks.",
    type: "boolean",
    default: true,
    scope: "user",
    category: "Terminal",
  },
  {
    key: "terminal.defaultShell",
    title: "Terminal Default Shell",
    description: "The default shell to use on your system.",
    type: "string",
    default: process.platform === 'win32' ? "powershell.exe" : "/bin/bash",
    scope: "user",
    category: "Terminal",
  },
  
  // ========== Devmate (AI-specific, additive) ==========
  {
    key: "devmate.autonomyMode",
    title: "Autonomy Mode",
    description: "Controls the level of AI autonomy. 'manual' requires confirmation for every step, 'guided' suggests next steps, 'long-horizon' maintains execution threads.",
    type: "enum",
    default: "manual",
    scope: "user",
    category: "Devmate / AI",
    enum: ["manual", "guided", "long-horizon"],
    enumDescriptions: [
      "Manual: User confirms each step",
      "Guided: AI suggests, user confirms",
      "Long-horizon: AI maintains execution threads",
    ],
    requiresRestart: false,
  },
  {
    key: "devmate.confirmationLevel",
    title: "Confirmation Level",
    description: "Controls when AI actions require explicit user confirmation.",
    type: "enum",
    default: "always",
    scope: "user",
    category: "Devmate / AI",
    enum: ["always", "file-changes", "dangerous-only"],
    enumDescriptions: [
      "Always require confirmation",
      "Confirm file changes only",
      "Confirm only potentially dangerous operations",
    ],
  },
  {
    key: "devmate.critiqueStrictness",
    title: "Critique Strictness",
    description: "Controls how strict the AI self-critique system is. Higher values mean more thorough analysis.",
    type: "number",
    default: 0.7,
    scope: "user",
    category: "Devmate / AI",
    minimum: 0.0,
    maximum: 1.0,
    step: 0.1,
  },
  {
    key: "devmate.showSystemFiles",
    title: "Show System Files",
    description: "Controls whether system files like .devmate, .git, node_modules are visible in the explorer.",
    type: "boolean",
    default: false,
    scope: "user",
    category: "Devmate / Explorer",
  },
]

/**
 * Get schema for a specific setting key
 */
export function getSettingSchema(key: string): IDESettingSchema | undefined {
  return SETTINGS_SCHEMA.find(s => s.key === key)
}

/**
 * Get all settings for a category
 */
export function getSettingsByCategory(category: string): IDESettingSchema[] {
  return SETTINGS_SCHEMA.filter(s => s.category === category)
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>()
  SETTINGS_SCHEMA.forEach(s => {
    const parts = s.category.split('/').map(p => p.trim())
    for (let i = 1; i <= parts.length; i++) {
      categories.add(parts.slice(0, i).join(' / '))
    }
  })
  return Array.from(categories).sort()
}

/**
 * Validate setting value against schema
 */
export function validateSetting(key: string, value: any): { valid: boolean; error?: string } {
  const schema = getSettingSchema(key)
  
  if (!schema) {
    return { valid: false, error: `Unknown setting key: ${key}` }
  }
  
  // Type validation
  if (schema.type === "boolean" && typeof value !== "boolean") {
    return { valid: false, error: `Setting ${key} must be a boolean` }
  }
  
  if (schema.type === "number") {
    if (typeof value !== "number") {
      return { valid: false, error: `Setting ${key} must be a number` }
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return { valid: false, error: `Setting ${key} must be >= ${schema.minimum}` }
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      return { valid: false, error: `Setting ${key} must be <= ${schema.maximum}` }
    }
  }
  
  if (schema.type === "string" && typeof value !== "string") {
    return { valid: false, error: `Setting ${key} must be a string` }
  }
  
  if (schema.type === "enum") {
    if (!schema.enum || !schema.enum.includes(value)) {
      return { valid: false, error: `Setting ${key} must be one of: ${schema.enum?.join(', ')}` }
    }
  }
  
  return { valid: true }
}
