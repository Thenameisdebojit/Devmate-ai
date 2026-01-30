'use client'

import { useState, useEffect } from 'react'
import { 
  FiSearch, 
  FiDownload, 
  FiX, 
  FiSettings, 
  FiCheck, 
  FiAlertCircle,
  FiPackage,
  FiStar,
  FiChevronDown,
  FiChevronRight,
  FiRefreshCw
} from 'react-icons/fi'

interface Extension {
  id: string
  name: string
  publisher: string
  description: string
  version: string
  installed: boolean
  enabled: boolean
  rating?: number
  downloadCount?: number
  iconUrl?: string
  categories?: string[]
  repository?: string
  issues?: string
  documentation?: string
  license?: string
  lastUpdated?: string
  publishedDate?: string
  size?: string
  performance?: string
}

interface IDEExtensionsPanelProps {
  className?: string
}

export default function IDEExtensionsPanel({ className = '' }: IDEExtensionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [installedExtensions, setInstalledExtensions] = useState<Extension[]>([])
  const [recommendedExtensions, setRecommendedExtensions] = useState<Extension[]>([])
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['installed', 'recommended']))
  const [filter, setFilter] = useState<'all' | 'installed' | 'recommended'>('all')

  useEffect(() => {
    loadExtensions()
  }, [])

  const loadExtensions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/extensions/list')
      if (response.ok) {
        const data = await response.json()
        setInstalledExtensions(data.installed || [])
        setRecommendedExtensions(data.recommended || [])
      }
    } catch (error) {
      console.error('Failed to load extensions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleInstall = async (extension: Extension) => {
    try {
      const response = await fetch('/api/extensions/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: extension.id }),
      })
      if (response.ok) {
        await loadExtensions()
      }
    } catch (error) {
      console.error('Failed to install extension:', error)
    }
  }

  const handleUninstall = async (extension: Extension) => {
    try {
      const response = await fetch('/api/extensions/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: extension.id }),
      })
      if (response.ok) {
        await loadExtensions()
        if (selectedExtension?.id === extension.id) {
          setSelectedExtension(null)
        }
      }
    } catch (error) {
      console.error('Failed to uninstall extension:', error)
    }
  }

  const handleEnable = async (extension: Extension) => {
    try {
      const response = await fetch('/api/extensions/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: extension.id }),
      })
      if (response.ok) {
        await loadExtensions()
        if (selectedExtension?.id === extension.id) {
          setSelectedExtension({ ...selectedExtension, enabled: true })
        }
      }
    } catch (error) {
      console.error('Failed to enable extension:', error)
    }
  }

  const handleDisable = async (extension: Extension) => {
    try {
      const response = await fetch('/api/extensions/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: extension.id }),
      })
      if (response.ok) {
        await loadExtensions()
        if (selectedExtension?.id === extension.id) {
          setSelectedExtension({ ...selectedExtension, enabled: false })
        }
      }
    } catch (error) {
      console.error('Failed to disable extension:', error)
    }
  }

  const filteredInstalled = installedExtensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredRecommended = recommendedExtensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`h-full flex flex-col bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Extensions</h2>
          <button
            onClick={loadExtensions}
            className="ml-auto p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Extension List */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading extensions...</div>
          ) : (
            <>
              {/* INSTALLED Section */}
              <div>
                <button
                  onClick={() => toggleSection('installed')}
                  className="w-full px-4 py-2 flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span>INSTALLED ({installedExtensions.length})</span>
                  {expandedSections.has('installed') ? (
                    <FiChevronDown className="w-4 h-4" />
                  ) : (
                    <FiChevronRight className="w-4 h-4" />
                  )}
                </button>
                
                {expandedSections.has('installed') && (
                  <div>
                    {filteredInstalled.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'No extensions found' : 'No extensions installed'}
                      </div>
                    ) : (
                      filteredInstalled.map((ext) => (
                        <div
                          key={ext.id}
                          onClick={() => setSelectedExtension(ext)}
                          className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                            selectedExtension?.id === ext.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {ext.iconUrl ? (
                              <img src={ext.iconUrl} alt={ext.name} className="w-10 h-10 rounded" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <FiPackage className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {ext.name}
                                </h3>
                                {ext.enabled ? (
                                  <FiCheck className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                ) : (
                                  <FiAlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                                {ext.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                                <span>{ext.publisher}</span>
                                {ext.rating && (
                                  <span className="flex items-center gap-1">
                                    <FiStar className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    {ext.rating.toFixed(1)}
                                  </span>
                                )}
                                {ext.performance && (
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3">⏱</span>
                                    {ext.performance}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* RECOMMENDED Section */}
              <div>
                <button
                  onClick={() => toggleSection('recommended')}
                  className="w-full px-4 py-2 flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span>RECOMMENDED ({recommendedExtensions.length})</span>
                  {expandedSections.has('recommended') ? (
                    <FiChevronDown className="w-4 h-4" />
                  ) : (
                    <FiChevronRight className="w-4 h-4" />
                  )}
                </button>
                
                {expandedSections.has('recommended') && (
                  <div>
                    {filteredRecommended.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {searchQuery ? 'No extensions found' : 'No recommendations'}
                      </div>
                    ) : (
                      filteredRecommended.map((ext) => (
                        <div
                          key={ext.id}
                          onClick={() => setSelectedExtension(ext)}
                          className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                            selectedExtension?.id === ext.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {ext.iconUrl ? (
                              <img src={ext.iconUrl} alt={ext.name} className="w-10 h-10 rounded" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <FiPackage className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {ext.name}
                                </h3>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                                {ext.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                                <span>{ext.publisher}</span>
                                {ext.rating && (
                                  <span className="flex items-center gap-1">
                                    <FiStar className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    {ext.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - Extension Details */}
        <div className="w-1/2 overflow-y-auto bg-white dark:bg-gray-900">
          {selectedExtension ? (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                {selectedExtension.iconUrl ? (
                  <img src={selectedExtension.iconUrl} alt={selectedExtension.name} className="w-16 h-16 rounded" />
                ) : (
                  <div className="w-16 h-16 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <FiPackage className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {selectedExtension.name}
                  </h2>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{selectedExtension.publisher}</span>
                    {selectedExtension.publisher === 'Microsoft' && (
                      <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  {selectedExtension.rating && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FiStar
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(selectedExtension.rating!)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedExtension.rating.toFixed(1)} ({selectedExtension.downloadCount?.toLocaleString() || 0} downloads)
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {selectedExtension.description}
                  </p>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedExtension.installed ? (
                      <>
                        {selectedExtension.enabled ? (
                          <button
                            onClick={() => handleDisable(selectedExtension)}
                            className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(selectedExtension)}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                          >
                            Enable
                          </button>
                        )}
                        <button
                          onClick={() => handleUninstall(selectedExtension)}
                          className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          Uninstall
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleInstall(selectedExtension)}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
                      >
                        <FiDownload className="w-4 h-4" />
                        Install
                      </button>
                    )}
                    <button className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                      <FiSettings className="w-4 h-4" />
                      Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4">
                <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400">
                  DETAILS
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  FEATURES
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  CHANGELOG
                </button>
              </div>

              {/* Details Content */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedExtension.name}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {selectedExtension.repository && (
                      <a href={selectedExtension.repository} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                        Repository
                      </a>
                    )}
                    {selectedExtension.issues && (
                      <a href={selectedExtension.issues} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                        Issues
                      </a>
                    )}
                    {selectedExtension.documentation && (
                      <a href={selectedExtension.documentation} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                        Documentation
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedExtension.description}
                  </p>
                </div>

                {/* Metadata Sidebar */}
                <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-500 mb-1">Identifier</div>
                      <div className="text-gray-900 dark:text-gray-100 font-mono">{selectedExtension.id}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-500 mb-1">Version</div>
                      <div className="text-gray-900 dark:text-gray-100">{selectedExtension.version}</div>
                    </div>
                    {selectedExtension.lastUpdated && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-500 mb-1">Last Updated</div>
                        <div className="text-gray-900 dark:text-gray-100">{selectedExtension.lastUpdated}</div>
                      </div>
                    )}
                    {selectedExtension.size && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-500 mb-1">Size</div>
                        <div className="text-gray-900 dark:text-gray-100">{selectedExtension.size}</div>
                      </div>
                    )}
                    {selectedExtension.categories && selectedExtension.categories.length > 0 && (
                      <div className="col-span-2">
                        <div className="text-gray-500 dark:text-gray-500 mb-2">Categories</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedExtension.categories.map((cat) => (
                            <button
                              key={cat}
                              className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <FiPackage className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select an extension to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
