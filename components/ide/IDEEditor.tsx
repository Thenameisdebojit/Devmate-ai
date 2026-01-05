'use client'

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface IDEEditorProps {
  filePath?: string
  content: string
  onSave: (content: string) => void
  onChange: (content: string) => void
}

export interface IDEEditorRef {
  getEditor: () => any
  undo: () => void
  redo: () => void
  cut: () => void
  copy: () => void
  paste: () => void
  find: () => void
  replace: () => void
  goToLine: (line: number) => void
}

const IDEEditor = forwardRef<IDEEditorRef, IDEEditorProps>(
  ({ filePath, content, onSave, onChange }, ref) => {
    const [isDirty, setIsDirty] = useState(false)
    const editorRef = useRef<any>(null)
    const monacoRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      getEditor: () => editorRef.current,
      undo: () => editorRef.current?.trigger('editor', 'undo', null),
      redo: () => editorRef.current?.trigger('editor', 'redo', null),
      cut: () => editorRef.current?.trigger('editor', 'editor.action.clipboardCutAction', null),
      copy: () => editorRef.current?.trigger('editor', 'editor.action.clipboardCopyAction', null),
      paste: () => editorRef.current?.trigger('editor', 'editor.action.clipboardPasteAction', null),
      find: () => editorRef.current?.trigger('editor', 'actions.find', null),
      replace: () => editorRef.current?.trigger('editor', 'editor.action.startFindReplaceAction', null),
      goToLine: (line: number) => editorRef.current?.trigger('editor', 'editor.action.gotoLine', { lineNumber: line }),
    }))

    useEffect(() => {
      setIsDirty(false)
    }, [filePath])

    const handleChange = (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value)
        setIsDirty(true)
      }
    }

    const handleSave = () => {
      onSave(content)
      setIsDirty(false)
    }

    const handleEditorDidMount = (editor: any, monaco: any) => {
      editorRef.current = editor
      monacoRef.current = monaco
    }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Editor Header */}
      <div className="h-10 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center px-4 justify-between">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {filePath || 'No file selected'}
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Save
          </button>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        {filePath ? (
          <MonacoEditor
            height="100%"
            language={getLanguageFromPath(filePath)}
            value={content}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  )
})

IDEEditor.displayName = 'IDEEditor'

export default IDEEditor

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
  }
  return langMap[ext || ''] || 'plaintext'
}

