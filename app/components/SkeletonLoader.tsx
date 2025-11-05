'use client'

export default function SkeletonLoader() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}
