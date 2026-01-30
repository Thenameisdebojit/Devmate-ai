'use client'

import { useState, useRef, useCallback } from 'react'
import { FiUpload, FiX, FiFile, FiImage, FiFileText, FiCheck, FiLoader } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import GroupSelector from './GroupSelector'

interface UploadedFile {
  file: File
  preview?: string
  type: 'image' | 'pdf' | 'other'
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress?: number
  assetId?: string
  error?: string
}

interface GeneralDomainUploadProps {
  userId: string
  userRole?: 'base_user' | 'super_user' | 'admin'
  onUploadComplete?: () => void
}

export default function GeneralDomainUpload({ userId, userRole, onUploadComplete }: GeneralDomainUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const getFileType = (file: File): 'image' | 'pdf' | 'other' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type === 'application/pdf') return 'pdf'
    return 'other'
  }

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles: UploadedFile[] = Array.from(files)
      .filter(file => {
        const type = getFileType(file)
        if (type === 'other') {
          toast.error(`Unsupported file type: ${file.name}. Please upload images (PNG, JPG) or PDFs.`)
          return false
        }
        return true
      })
      .map(file => ({
        file,
        type: getFileType(file),
        status: 'pending' as const,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))

    setUploadedFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => {
      const file = prev[index]
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const uploadFiles = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) {
      toast.error('No files to upload')
      return
    }

    // Update status to uploading
    setUploadedFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading' as const, progress: 0 } : f
    ))

    try {
      const formData = new FormData()
      pendingFiles.forEach(({ file }) => {
        formData.append('files', file)
      })
      formData.append('userId', userId)
      if (selectedGroups.length > 0) {
        formData.append('groupIds', JSON.stringify(selectedGroups))
      }

      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()

      // Update files with asset IDs and mark as processing
      setUploadedFiles(prev => prev.map((f, i) => {
        const pendingIndex = pendingFiles.findIndex(pf => pf.file === f.file)
        if (pendingIndex >= 0 && data.assets && data.assets[pendingIndex]) {
          return {
            ...f,
            status: 'processing' as const,
            assetId: data.assets[pendingIndex].id,
            progress: 50,
          }
        }
        return f
      }))

      // Trigger processing
      const processResponse = await fetch('/api/rag/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: data.assets.map((a: any) => a.id),
        }),
      })

      if (!processResponse.ok) {
        throw new Error('Processing failed')
      }

      // Mark as completed
      setUploadedFiles(prev => prev.map(f => 
        f.status === 'processing' ? { ...f, status: 'completed' as const, progress: 100 } : f
      ))

      toast.success(`Successfully uploaded and processed ${pendingFiles.length} file(s)`)
      onUploadComplete?.()

      // Clear completed files after 2 seconds
      setTimeout(() => {
        setUploadedFiles(prev => prev.filter(f => f.status !== 'completed'))
      }, 2000)
    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadedFiles(prev => prev.map(f => 
        f.status === 'uploading' || f.status === 'processing' 
          ? { ...f, status: 'error' as const, error: error.message } 
          : f
      ))
      toast.error(error.message || 'Failed to upload files')
    }
  }, [uploadedFiles, userId, selectedGroups, onUploadComplete])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Knowledge Base Assets
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload images, PDFs, and documents to build your knowledge base
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <FiUpload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Supports: PNG, JPG, PDF (Max 10MB per file)
        </p>
      </div>

      {/* File List */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {uploadedFiles.map((uploadedFile, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {uploadedFile.type === 'image' && uploadedFile.preview ? (
                  <img
                    src={uploadedFile.preview}
                    alt={uploadedFile.file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
                    {uploadedFile.type === 'pdf' ? (
                      <FiFileText className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <FiFile className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadedFile.status === 'uploading' && uploadedFile.progress !== undefined && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-indigo-600 h-1 rounded-full transition-all"
                        style={{ width: `${uploadedFile.progress}%` }}
                      />
                    </div>
                  )}
                  {uploadedFile.status === 'error' && uploadedFile.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {uploadedFile.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {uploadedFile.status === 'completed' && (
                    <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                  )}
                  {(uploadedFile.status === 'uploading' || uploadedFile.status === 'processing') && (
                    <FiLoader className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  )}
                  {uploadedFile.status !== 'uploading' && uploadedFile.status !== 'processing' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(index)
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <FiX className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Selector */}
      {(userRole === 'super_user' || userRole === 'admin') && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Assign to Groups (Optional)
          </label>
          <GroupSelector
            selectedGroupIds={selectedGroups}
            onChange={setSelectedGroups}
            userId={userId}
            userRole={userRole}
          />
        </div>
      )}

      {/* Upload Button */}
      {uploadedFiles.some(f => f.status === 'pending' || f.status === 'error') && (
        <button
          onClick={uploadFiles}
          disabled={uploadedFiles.every(f => f.status !== 'pending' && f.status !== 'error')}
          className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Upload {uploadedFiles.filter(f => f.status === 'pending').length} File(s)
        </button>
      )}
    </div>
  )
}
