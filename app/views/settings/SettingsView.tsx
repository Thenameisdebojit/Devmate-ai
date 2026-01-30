/**
 * PHASE 2: Settings View Component
 * 
 * VS Code-identical settings UI.
 * This is a VIEW, NOT a file editor.
 * .devmate/settings.json must NEVER open in editor.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import type { IDESettingSchema } from '@/lib/ide/settings/SettingsSchema'

interface SettingsViewProps {
  projectId?: string
  onClose?: () => void
}

export default function SettingsView({ projectId, onClose }: SettingsViewProps) {
  const [schema, setSchema] = useState<IDESettingSchema[]>([])
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [userSettings, setUserSettings] = useState<Record<string, any>>({})
  const [workspaceSettings, setWorkspaceSettings] = useState<Record<string, any>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [scope, setScope] = useState<'user' | 'workspace'>('user')
  const [loading, setLoading] = useState(true)

  // Load schema and settings
  useEffect(() => {
    loadData()
  }, [projectId, scope])

  async function loadData() {
    try {
      setLoading(true)

      // Load schema
      const schemaRes = await fetch('/api/settings/schema')
      const schemaData = await schemaRes.json()
      setSchema(schemaData.schema || [])

      // Load merged settings
      const settingsRes = await fetch(`/api/settings/get${projectId ? `?projectId=${projectId}` : ''}`)
      const settingsData = await settingsRes.json()
      setSettings(settingsData.settings || {})

      // Load user settings
      const userRes = await fetch('/api/settings/user')
      const userData = await userRes.json()
      setUserSettings(userData.settings || {})

      // Load workspace settings if projectId provided
      if (projectId) {
        const workspaceRes = await fetch(`/api/settings/workspace?projectId=${projectId}`)
        const workspaceData = await workspaceRes.json()
        setWorkspaceSettings(workspaceData.settings || {})
      }

      // Set default category
      const categories = getAllCategories(schemaData.schema || [])
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0])
      }
    } catch (error: any) {
      console.error('[SettingsView] Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateSetting(key: string, value: any) {
    try {
      const endpoint = scope === 'user' ? '/api/settings/user' : '/api/settings/workspace'
      const body = scope === 'workspace' 
        ? { key, value, projectId }
        : { key, value }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update setting')
      }

      // Reload settings
      await loadData()
    } catch (error: any) {
      console.error('[SettingsView] Failed to update setting:', error)
      alert(`Failed to update setting: ${error.message}`)
    }
  }

  async function resetSetting(key: string) {
    // TODO: Implement reset endpoint
    console.log('[SettingsView] Reset setting:', key)
  }

  // Get all categories from schema
  const categories = useMemo(() => getAllCategories(schema), [schema])

  // Filter settings by category and search
  const filteredSettings = useMemo(() => {
    let filtered = schema

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query)
      )
    }

    return filtered.sort((a, b) => a.key.localeCompare(b.key))
  }, [schema, selectedCategory, searchQuery])

  if (loading) {
    return (
      <div className="settings-view">
        <div className="settings-loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="settings-view">
      <style jsx>{`
        .settings-view {
          display: flex;
          height: 100%;
          background: var(--vscode-editor-background, #1e1e1e);
          color: var(--vscode-editor-foreground, #cccccc);
        }

        .settings-sidebar {
          width: 250px;
          border-right: 1px solid var(--vscode-panel-border, #3e3e3e);
          overflow-y: auto;
          padding: 8px;
        }

        .settings-category {
          padding: 6px 12px;
          cursor: pointer;
          border-radius: 3px;
          margin-bottom: 2px;
        }

        .settings-category:hover {
          background: var(--vscode-list-hoverBackground, #2a2d2e);
        }

        .settings-category.selected {
          background: var(--vscode-list-activeSelectionBackground, #094771);
          color: var(--vscode-list-activeSelectionForeground, #ffffff);
        }

        .settings-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .settings-header {
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border, #3e3e3e);
        }

        .settings-search {
          width: 100%;
          padding: 8px 12px;
          background: var(--vscode-input-background, #3c3c3c);
          border: 1px solid var(--vscode-input-border, #3c3c3c);
          color: var(--vscode-input-foreground, #cccccc);
          border-radius: 2px;
          font-size: 13px;
        }

        .settings-scope-toggle {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .scope-button {
          padding: 4px 12px;
          background: var(--vscode-button-secondaryBackground, #3c3c3c);
          color: var(--vscode-button-secondaryForeground, #cccccc);
          border: 1px solid var(--vscode-button-border, #3c3c3c);
          border-radius: 2px;
          cursor: pointer;
          font-size: 12px;
        }

        .scope-button.active {
          background: var(--vscode-button-background, #0e639c);
          color: var(--vscode-button-foreground, #ffffff);
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .setting-item {
          margin-bottom: 24px;
        }

        .setting-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .setting-title {
          font-weight: 600;
          font-size: 13px;
        }

        .setting-badge {
          padding: 2px 6px;
          background: var(--vscode-badge-background, #4ec9b0);
          color: var(--vscode-badge-foreground, #1e1e1e);
          border-radius: 2px;
          font-size: 11px;
        }

        .setting-description {
          font-size: 12px;
          color: var(--vscode-descriptionForeground, #969696);
          margin-bottom: 8px;
        }

        .setting-control {
          margin-top: 8px;
        }

        .setting-input,
        .setting-select {
          width: 100%;
          max-width: 400px;
          padding: 6px 8px;
          background: var(--vscode-input-background, #3c3c3c);
          border: 1px solid var(--vscode-input-border, #3c3c3c);
          color: var(--vscode-input-foreground, #cccccc);
          border-radius: 2px;
          font-size: 13px;
        }

        .setting-toggle {
          width: 40px;
          height: 20px;
          background: var(--vscode-toggle-background, #3c3c3c);
          border: 1px solid var(--vscode-toggle-border, #3c3c3c);
          border-radius: 10px;
          position: relative;
          cursor: pointer;
        }

        .setting-toggle.active {
          background: var(--vscode-button-background, #0e639c);
        }

        .setting-toggle-slider {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }

        .setting-toggle.active .setting-toggle-slider {
          transform: translateX(20px);
        }
      `}</style>

      <div className="settings-sidebar">
        <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
          Categories
        </div>
        {categories.map(category => (
          <div
            key={category}
            className={`settings-category ${selectedCategory === category ? 'selected' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </div>
        ))}
      </div>

      <div className="settings-main">
        <div className="settings-header">
          <input
            type="text"
            className="settings-search"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {projectId && (
            <div className="settings-scope-toggle">
              <button
                className={`scope-button ${scope === 'user' ? 'active' : ''}`}
                onClick={() => setScope('user')}
              >
                User
              </button>
              <button
                className={`scope-button ${scope === 'workspace' ? 'active' : ''}`}
                onClick={() => setScope('workspace')}
              >
                Workspace
              </button>
            </div>
          )}
        </div>

        <div className="settings-content">
          {filteredSettings.map(setting => (
            <SettingItem
              key={setting.key}
              setting={setting}
              value={settings[setting.key]}
              onChange={(value) => updateSetting(setting.key, value)}
              onReset={() => resetSetting(setting.key)}
              scope={scope}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SettingItemProps {
  setting: IDESettingSchema
  value: any
  onChange: (value: any) => void
  onReset: () => void
  scope: 'user' | 'workspace'
}

function SettingItem({ setting, value, onChange, onReset, scope }: SettingItemProps) {
  const currentValue = value !== undefined ? value : setting.default

  function handleChange(newValue: any) {
    onChange(newValue)
  }

  return (
    <div className="setting-item">
      <div className="setting-label">
        <span className="setting-title">{setting.title}</span>
        {setting.experimental && (
          <span className="setting-badge">Experimental</span>
        )}
        {setting.requiresRestart && (
          <span className="setting-badge">Requires Restart</span>
        )}
      </div>
      <div className="setting-description">{setting.description}</div>
      <div className="setting-control">
        {setting.type === 'boolean' && (
          <div
            className={`setting-toggle ${currentValue ? 'active' : ''}`}
            onClick={() => handleChange(!currentValue)}
          >
            <div className="setting-toggle-slider" />
          </div>
        )}
        {setting.type === 'number' && (
          <input
            type="number"
            className="setting-input"
            value={currentValue}
            onChange={(e) => handleChange(Number(e.target.value))}
            min={setting.minimum}
            max={setting.maximum}
            step={setting.step || 1}
          />
        )}
        {setting.type === 'string' && (
          <input
            type="text"
            className="setting-input"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
          />
        )}
        {setting.type === 'enum' && (
          <select
            className="setting-select"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
          >
            {setting.enum?.map((option, index) => (
              <option key={option} value={option}>
                {option} {setting.enumDescriptions?.[index] ? `- ${setting.enumDescriptions[index]}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

function getAllCategories(schema: IDESettingSchema[]): string[] {
  const categories = new Set<string>()
  schema.forEach(s => {
    categories.add(s.category)
  })
  return Array.from(categories).sort()
}
