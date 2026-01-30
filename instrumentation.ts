/**
 * PHASE C: Next.js Instrumentation
 * 
 * Runs at server startup to validate provider environments.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // PHASE C: Validate provider environments at server startup
    try {
      const { validateAllProviders } = await import('@/lib/ai/envValidation')
      const { initializeProviderClients } = await import('@/lib/ai/ProviderRouter')
      
      console.log('[instrumentation] Validating provider environments...')
      const results = validateAllProviders()
      
      // PHASE C: Initialize provider clients after validation
      initializeProviderClients()
      console.log('[instrumentation] Provider clients initialized')
    } catch (error: any) {
      console.error('[instrumentation] Failed to validate/initialize providers:', error)
      // Don't throw - allow server to start even if providers fail
      // Individual API routes will handle missing providers gracefully
    }
  }
}
