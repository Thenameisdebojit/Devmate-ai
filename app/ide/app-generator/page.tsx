'use client'

/**
 * App Generator IDE
 * 
 * Full IDE experience for App Generator domain.
 * Equivalent to Cursor/Replit workspace.
 * 
 * This is NOT a panel or sub-mode - it's a complete IDE.
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AppGeneratorIDE from '@/components/ide/AppGeneratorIDE'

export default function AppGeneratorIDEPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams.get('projectId') || undefined

  return <AppGeneratorIDE projectId={projectId} />
}

