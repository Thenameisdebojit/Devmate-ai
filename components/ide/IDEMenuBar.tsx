'use client'

import { useState, useRef, useEffect } from 'react'
import { FiFile, FiEdit, FiMousePointer, FiEye, FiArrowRight, FiPlay, FiTerminal, FiHelpCircle, FiFolder, FiRotateCcw } from 'react-icons/fi'

interface IDEMenuBarProps {
  projectId?: string
  onNewFile?: () => void
  onOpenFile?: () => void
  onOpenFolder?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onClose?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onCut?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onFind?: () => void
  onReplace?: () => void
  onFindInFiles?: () => void
  onGoToFile?: () => void
  onGoToSymbol?: () => void
  onGoToLine?: () => void
  onStartDebugging?: () => void
  onRunWithoutDebugging?: () => void
  onStop?: () => void
  onNewTerminal?: () => void
  onSplitTerminal?: () => void
  onRunTask?: () => void
  onToggleSidebar?: () => void
  onToggleTerminal?: () => void
  onToggleExplorer?: () => void
  onToggleSearch?: () => void
  onToggleProblems?: () => void
  onToggleOutput?: () => void
  onToggleDebugConsole?: () => void
  onWordWrap?: () => void
  onAppearance?: () => void
  onCommandPalette?: () => void
  onWelcome?: () => void
  onAbout?: () => void
  onRollbackProject?: () => void // PHASE 4: Project rollback
}

export default function IDEMenuBar({
  projectId,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onClose,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onReplace,
  onFindInFiles,
  onGoToFile,
  onGoToSymbol,
  onGoToLine,
  onStartDebugging,
  onRunWithoutDebugging,
  onStop,
  onNewTerminal,
  onSplitTerminal,
  onRunTask,
  onToggleSidebar,
  onToggleTerminal,
  onToggleExplorer,
  onToggleSearch,
  onToggleProblems,
  onToggleOutput,
  onToggleDebugConsole,
  onWordWrap,
  onAppearance,
  onCommandPalette,
  onWelcome,
  onAbout,
  onRollbackProject,
}: IDEMenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.menu-bar')) {
        setActiveMenu(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleMenuClick = (menu: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMenu(activeMenu === menu ? null : menu)
  }

  const handleFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleFolderInput = () => {
    folderInputRef.current?.click()
  }

  const MenuItem = ({ label, shortcut, onClick, disabled, hasSubmenu }: {
    label: string
    shortcut?: string
    onClick?: () => void
    disabled?: boolean
    hasSubmenu?: boolean
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
        setActiveMenu(null)
      }}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">
          {shortcut}
        </span>
      )}
      {hasSubmenu && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">›</span>
      )}
    </button>
  )

  const MenuSeparator = () => (
    <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
  )

  return (
    <>
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-2 menu-bar">
        {/* File Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('file', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'file' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiFile className="w-4 h-4" />
            <span>File</span>
          </button>
          {activeMenu === 'file' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="New Text File" shortcut="Ctrl+N" onClick={onNewFile} />
              <MenuItem label="New Window" shortcut="Ctrl+Shift+N" />
              <MenuSeparator />
              <MenuItem label="Open File..." shortcut="Ctrl+O" onClick={handleFileInput} />
              <MenuItem label="Open Folder..." shortcut="Ctrl+K Ctrl+O" onClick={handleFolderInput} />
              <MenuItem label="Open Workspace from File..." onClick={onOpenFolder} />
              <MenuSeparator />
              <MenuItem label="Save" shortcut="Ctrl+S" onClick={onSave} />
              <MenuItem label="Save As..." shortcut="Ctrl+Shift+S" onClick={onSaveAs} />
              <MenuItem label="Save All" shortcut="Ctrl+K S" />
              <MenuSeparator />
              <MenuItem label="Revert File" />
              <MenuItem label="Close Editor" shortcut="Ctrl+F4" onClick={onClose} />
              <MenuItem label="Close Folder" shortcut="Ctrl+K F" />
              <MenuItem label="Exit" />
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('edit', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'edit' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiEdit className="w-4 h-4" />
            <span>Edit</span>
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Undo" shortcut="Ctrl+Z" onClick={onUndo} />
              <MenuItem label="Redo" shortcut="Ctrl+Y" onClick={onRedo} />
              <MenuSeparator />
              <MenuItem label="Cut" shortcut="Ctrl+X" onClick={onCut} />
              <MenuItem label="Copy" shortcut="Ctrl+C" onClick={onCopy} />
              <MenuItem label="Paste" shortcut="Ctrl+V" onClick={onPaste} />
              <MenuSeparator />
              <MenuItem label="Find" shortcut="Ctrl+F" onClick={onFind} />
              <MenuItem label="Replace" shortcut="Ctrl+H" onClick={onReplace} />
              <MenuSeparator />
              <MenuItem label="Find in Files" shortcut="Ctrl+Shift+F" onClick={onFindInFiles} />
              <MenuItem label="Replace in Files" shortcut="Ctrl+Shift+H" />
              <MenuSeparator />
              <MenuItem label="Toggle Line Comment" shortcut="Ctrl+/" />
              <MenuItem label="Toggle Block Comment" shortcut="Shift+Alt+A" />
            </div>
          )}
        </div>

        {/* Selection Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('selection', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'selection' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiMousePointer className="w-4 h-4" />
            <span>Selection</span>
          </button>
          {activeMenu === 'selection' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Select All" shortcut="Ctrl+A" />
              <MenuItem label="Expand Selection" shortcut="Shift+Alt+Right" />
              <MenuItem label="Shrink Selection" shortcut="Shift+Alt+Left" />
              <MenuSeparator />
              <MenuItem label="Add Selection to Next Find Match" shortcut="Ctrl+D" />
              <MenuItem label="Add Cursor Above" shortcut="Ctrl+Alt+Up" />
              <MenuItem label="Add Cursor Below" shortcut="Ctrl+Alt+Down" />
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('view', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'view' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiEye className="w-4 h-4" />
            <span>View</span>
          </button>
          {activeMenu === 'view' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Command Palette..." shortcut="Ctrl+Shift+P" onClick={onCommandPalette} />
              <MenuItem label="Open View..." />
              <MenuSeparator />
              <MenuItem label="Appearance" hasSubmenu onClick={onAppearance} />
              <MenuItem label="Editor Layout" hasSubmenu />
              <MenuSeparator />
              <MenuItem label="Explorer" shortcut="Ctrl+Shift+E" onClick={onToggleExplorer} />
              <MenuItem label="Search" shortcut="Ctrl+Shift+F" onClick={onToggleSearch} />
              <MenuItem label="Source Control" shortcut="Ctrl+Shift+G" />
              <MenuItem label="Run" shortcut="Ctrl+Shift+D" />
              <MenuItem label="Extensions" shortcut="Ctrl+Shift+X" />
              <MenuItem label="Problems" shortcut="Ctrl+Shift+M" onClick={onToggleProblems} />
              <MenuItem label="Output" shortcut="Ctrl+Shift+U" onClick={onToggleOutput} />
              <MenuItem label="Debug Console" shortcut="Ctrl+Shift+Y" onClick={onToggleDebugConsole} />
              <MenuItem label="Terminal" shortcut="Ctrl+`" onClick={onToggleTerminal} />
              <MenuSeparator />
              <MenuItem label="Word Wrap" shortcut="Alt+Z" onClick={onWordWrap} />
            </div>
          )}
        </div>

        {/* Go Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('go', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'go' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiArrowRight className="w-4 h-4" />
            <span>Go</span>
          </button>
          {activeMenu === 'go' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Back" shortcut="Alt+Left" />
              <MenuItem label="Forward" shortcut="Alt+Right" />
              <MenuItem label="Last Edit Location" shortcut="Ctrl+K Ctrl+Q" />
              <MenuSeparator />
              <MenuItem label="Switch Editor" hasSubmenu />
              <MenuItem label="Switch Group" hasSubmenu />
              <MenuSeparator />
              <MenuItem label="Go to File..." shortcut="Ctrl+P" onClick={onGoToFile} />
              <MenuItem label="Go to Symbol in Workspace..." shortcut="Ctrl+T" onClick={onGoToSymbol} />
              <MenuItem label="Go to Symbol in Editor..." shortcut="Ctrl+Shift+O" />
              <MenuItem label="Go to Definition" shortcut="F12" />
              <MenuItem label="Go to Declaration" />
              <MenuItem label="Go to Type Definition" />
              <MenuItem label="Go to Implementations" shortcut="Ctrl+F12" />
              <MenuItem label="Go to References" shortcut="Shift+F12" />
              <MenuSeparator />
              <MenuItem label="Go to Line/Column..." shortcut="Ctrl+G" onClick={onGoToLine} />
              <MenuItem label="Go to Bracket" shortcut="Ctrl+Shift+\\" />
              <MenuSeparator />
              <MenuItem label="Next Problem" shortcut="F8" />
              <MenuItem label="Previous Problem" shortcut="Shift+F8" />
            </div>
          )}
        </div>

        {/* Run Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('run', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'run' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiPlay className="w-4 h-4" />
            <span>Run</span>
          </button>
          {activeMenu === 'run' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Start Debugging" shortcut="F5" onClick={onStartDebugging} />
              <MenuItem label="Run Without Debugging" shortcut="Ctrl+F5" onClick={onRunWithoutDebugging} />
              <MenuItem label="Stop Debugging" shortcut="Shift+F5" onClick={onStop} disabled />
              <MenuItem label="Restart Debugging" shortcut="Ctrl+Shift+F5" disabled />
              <MenuSeparator />
              <MenuItem label="Open Configurations" disabled />
              <MenuItem label="Add Configuration..." />
              <MenuSeparator />
              <MenuItem label="Step Over" shortcut="F10" disabled />
              <MenuItem label="Step Into" shortcut="F11" disabled />
              <MenuItem label="Step Out" shortcut="Shift+F11" disabled />
              <MenuItem label="Continue" shortcut="F5" disabled />
              <MenuSeparator />
              <MenuItem label="Toggle Breakpoint" shortcut="F9" />
              <MenuItem label="New Breakpoint" hasSubmenu />
              <MenuItem label="Enable All Breakpoints" />
              <MenuItem label="Disable All Breakpoints" />
              <MenuItem label="Remove All Breakpoints" />
            </div>
          )}
        </div>

        {/* Terminal Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('terminal', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'terminal' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiTerminal className="w-4 h-4" />
            <span>Terminal</span>
          </button>
          {activeMenu === 'terminal' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="New Terminal" shortcut="Ctrl+Shift+`" onClick={onNewTerminal} />
              <MenuItem label="Split Terminal" shortcut="Ctrl+Shift+5" onClick={onSplitTerminal} />
              <MenuSeparator />
              <MenuItem label="Run Task..." onClick={onRunTask} />
              <MenuItem label="Run Build Task..." shortcut="Ctrl+Shift+B" />
              <MenuItem label="Run Active File" />
              <MenuItem label="Run Selected Text" />
              <MenuSeparator />
              <MenuItem label="Show Running Tasks..." />
              <MenuItem label="Restart Running Task..." />
              <MenuItem label="Terminate Task..." />
              <MenuSeparator />
              <MenuItem label="Configure Tasks..." />
              <MenuItem label="Configure Default Build Task..." />
            </div>
          )}
        </div>

        {/* PHASE 4: Project Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('project', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'project' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiFolder className="w-4 h-4" />
            <span>Project</span>
          </button>
          {activeMenu === 'project' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Rollback to Last Checkpoint" onClick={onRollbackProject} />
              <MenuSeparator />
              <MenuItem label="Project Settings..." />
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={(e) => handleMenuClick('help', e)}
            className={`px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center gap-1 ${
              activeMenu === 'help' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            <FiHelpCircle className="w-4 h-4" />
            <span>Help</span>
          </button>
          {activeMenu === 'help' && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[200px]">
              <MenuItem label="Welcome" onClick={onWelcome} />
              <MenuItem label="Show All Commands" shortcut="Ctrl+Shift+P" onClick={onCommandPalette} />
              <MenuItem label="Editor Playground" />
              <MenuItem label="Get Started with Accessibility Features" />
              <MenuSeparator />
              <MenuItem label="View License" />
              <MenuItem label="Toggle Developer Tools" />
              <MenuItem label="Open Process Explorer" />
              <MenuSeparator />
              <MenuItem label="Check for Updates..." />
              <MenuItem label="About" onClick={onAbout} />
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) return
          onOpenFile?.()
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) return
          await handleFolderUpload(files, projectId)
          onOpenFolder?.()
        }}
      />
    </>
  )
}

async function handleFolderUpload(files: FileList, projectId?: string) {
  if (!projectId) {
    alert('Please initialize workspace first')
    return
  }

  try {
    const formData = new FormData()
    formData.append('projectId', projectId) // Add projectId to formData
    Array.from(files).forEach((file) => {
      // Preserve relative path structure
      const relativePath = (file as any).webkitRelativePath || file.name
      formData.append('files', file)
      formData.append('paths', relativePath)
    })

    const response = await fetch(`/api/workspace/upload-folder?projectId=${projectId}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload folder')
    }

    const data = await response.json()
    console.log('Folder uploaded:', data)
    
    // Dispatch custom event to reload files
    window.dispatchEvent(new CustomEvent('workspace-folder-uploaded', { detail: { projectId } }))
    
    // Show success message
    alert(`Successfully uploaded ${data.filesUploaded} files`)
  } catch (error) {
    console.error('Folder upload error:', error)
    alert(`Failed to upload folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
