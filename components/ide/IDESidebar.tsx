'use client'

interface IDESidebarProps {
  files: Array<{ path: string; type?: string }>
  selectedFile?: string
  onFileSelect: (path: string) => void
}

export default function IDESidebar({ files, selectedFile, onFileSelect }: IDESidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
          Files
        </div>
        <div className="space-y-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => onFileSelect(file.path)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
                selectedFile === file.path
                  ? 'bg-gray-200 dark:bg-gray-800 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {file.path}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

