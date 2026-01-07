'use client'

import { Dispatch, SetStateAction } from 'react'

export interface EditorSettings {
  fontSize: number
  wordWrap: boolean
  autoSaveMode: 'off' | 'afterDelay'
}

interface IDESettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: EditorSettings
  setSettings: Dispatch<SetStateAction<EditorSettings>>
}

export default function IDESettingsPanel({
  isOpen,
  onClose,
  settings,
  setSettings,
}: IDESettingsPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-5xl h-[70vh] bg-gray-50 dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Settings
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Customize the App Generator editor (stored per-browser like VS Code)
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left navigation (categories) */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 p-3 text-sm">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              User
            </div>
            <button className="w-full text-left px-2 py-1.5 rounded bg-blue-600/10 text-blue-700 dark:text-blue-300 text-sm mb-1">
              Commonly Used
            </button>
            <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Text Editor</div>
              <div>Files</div>
              <div>Workbench</div>
              <div>Application</div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Commonly Used */}
            <section>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Commonly Used
              </h3>

              {/* Font Size */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Editor: Font Size
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {settings.fontSize}px
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Controls the font size in pixels.
                </p>
                <input
                  type="range"
                  min={10}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      fontSize: Number(e.target.value) || 14,
                    }))
                  }
                  className="w-full"
                />
              </div>

              {/* Word Wrap */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Editor: Word Wrap
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Controls how lines should wrap.
                </p>
                <select
                  value={settings.wordWrap ? 'on' : 'off'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      wordWrap: e.target.value === 'on',
                    }))
                  }
                  className="mt-1 block w-48 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="off">off</option>
                  <option value="on">on</option>
                </select>
              </div>

              {/* Auto Save */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Files: Auto Save
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Controls auto save of editors that have unsaved changes.
                </p>
                <select
                  value={settings.autoSaveMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoSaveMode:
                        (e.target.value as EditorSettings['autoSaveMode']) ||
                        'off',
                    }))
                  }
                  className="mt-1 block w-56 rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                >
                  <option value="off">off</option>
                  <option value="afterDelay">afterDelay</option>
                </select>
              </div>
            </section>

            {/* Preview note */}
            <section className="border-t border-gray-200 dark:border-gray-800 pt-4 text-xs text-gray-500 dark:text-gray-400">
              Changes are applied immediately in the App Generator editor and
              saved per-browser.
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}


