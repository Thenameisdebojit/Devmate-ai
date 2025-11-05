'use client'

import toast from 'react-hot-toast'

interface DownloadButtonProps {
  text: string
  domain?: string
}

export default function DownloadButton({ text, domain }: DownloadButtonProps) {
  const getExtension = () => {
    const lowerDomain = (domain || 'General').toLowerCase()
    if (lowerDomain.includes('python')) return 'py'
    if (lowerDomain.includes('javascript') || lowerDomain.includes('react') || lowerDomain.includes('node')) return 'js'
    if (lowerDomain.includes('typescript')) return 'ts'
    if (lowerDomain.includes('rust')) return 'rs'
    if (lowerDomain.includes('go')) return 'go'
    if (lowerDomain.includes('java')) return 'java'
    return 'txt'
  }

  const handleDownload = () => {
    try {
      const ext = getExtension()
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `devmate-code-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded successfully!')
    } catch (err) {
      toast.error('Failed to download')
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 px-3 py-1.5 bg-green-600/30 hover:bg-green-600/50 text-green-300 rounded-lg text-sm transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download
    </button>
  )
}
