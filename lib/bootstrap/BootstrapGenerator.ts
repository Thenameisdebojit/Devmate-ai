/**
 * PHASE -1: Bootstrap Generator
 * 
 * Deterministic file generator for empty workspaces.
 * NO AI, NO LLM, NO AGENT DEPENDENCIES.
 * 
 * PURPOSE:
 * Guarantee that at least one runnable project structure exists
 * before any AI agent execution can occur.
 * 
 * RULES:
 * - Must NOT use LLMs
 * - Must NOT depend on AgentExecutionRouter
 * - Must NOT use ContextBuilder
 * - Must write files via FileMutationKernel
 * - Must create project root if missing
 * - Must succeed deterministically
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { getFileMutationKernel } from '@/lib/workspace/FileMutationKernel'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

export type BootstrapPlatform = 'web' | 'node' | 'react'

export interface BootstrapOptions {
  projectId: string
  rootPath: string
  platform?: BootstrapPlatform
}

export interface BootstrapResult {
  success: boolean
  filesCreated: string[]
  error?: string
}

/**
 * Bootstrap Generator
 * Creates minimal runnable project structures
 */
export class BootstrapGenerator {
  /**
   * Check if workspace is empty
   */
  static async isWorkspaceEmpty(rootPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true })
      // Filter out hidden files and common IDE files
      const visibleFiles = entries.filter(
        (entry) =>
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== '.git'
      )
      return visibleFiles.length === 0
    } catch (error: any) {
      // If directory doesn't exist, it's empty
      if (error.code === 'ENOENT') {
        return true
      }
      throw error
    }
  }

  /**
   * Get file count in workspace
   */
  static async getFileCount(rootPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true })
      const visibleFiles = entries.filter(
        (entry) =>
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== '.git'
      )
      return visibleFiles.length
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return 0
      }
      throw error
    }
  }

  /**
   * Run bootstrap generation
   */
  static async run(options: BootstrapOptions): Promise<BootstrapResult> {
    const { projectId, rootPath: providedRootPath, platform = 'web' } = options

    try {
      // PHASE E: Invariant checks
      if (!projectId) {
        throw new Error('Invariant violation: projectId is required for BootstrapGenerator')
      }
      
      // PHASE F: Use ProjectRootManager if rootPath not provided
      let finalRootPath = providedRootPath
      if (!finalRootPath) {
        const rootManager = getProjectRootManager()
        finalRootPath = await rootManager.getProjectRoot(projectId)
        // PHASE F: Initialize git repository on first bootstrap
        await rootManager.initializeGit(projectId)
      }
      
      if (!finalRootPath) {
        throw new Error(`Invariant violation: rootPath is missing for projectId: ${projectId}`)
      }

      // Ensure project root exists (ProjectRootManager should have created it, but double-check)
      await fs.mkdir(finalRootPath, { recursive: true })

      // Check if workspace is actually empty
      const isEmpty = await this.isWorkspaceEmpty(finalRootPath)
      if (!isEmpty) {
        return {
          success: false,
          filesCreated: [],
          error: 'Workspace is not empty - bootstrap skipped',
        }
      }

      // Get file mutation kernel with projectId and finalRootPath
      const mutationKernel = getFileMutationKernel(projectId, finalRootPath)

      // Generate files based on platform
      // PHASE F: Use finalRootPath for all file operations
      const projectRoot = finalRootPath
      let files: Array<{ path: string; content: string }> = []

      switch (platform) {
        case 'web':
          files = this.generateWebFiles()
          break
        case 'node':
          files = this.generateNodeFiles()
          break
        case 'react':
          files = this.generateReactFiles()
          break
        default:
          files = this.generateWebFiles()
      }

      // Apply files via FileMutationKernel
      const changes = files.map((file) => ({
        path: file.path,
        type: 'create' as const,
        fullContent: file.content,
        reason: 'Bootstrap: Initial project structure',
      }))

      // PHASE F: Use generation mode for bootstrap (bypasses context/confidence checks)
      const result = await mutationKernel.apply({
        changes,
        reason: `Bootstrap: Create ${platform} project structure`,
        mode: 'generation', // PHASE F: Use generation mode for bootstrap
      }, {
        createCheckpoint: false, // Bootstrap doesn't need checkpoint
        requireHighConfidence: false,
      })

      if (result.appliedChanges.length === 0) {
        throw new Error(
          `Invariant violation: Bootstrap completed but no files were created. ` +
          `projectId: ${projectId}, rootPath: ${finalRootPath}, platform: ${platform}`
        )
      }

      const filesCreated = result.appliedChanges.map((c) => c.path)
      
      // PHASE B: Ensure .devmate structure exists (must be before stage transitions)
      const { ensureDevmateStructure } = await import('@/lib/os/ensureDevmateStructure')
      const devmateResult = await ensureDevmateStructure(finalRootPath)
      if (!devmateResult.success) {
        throw new Error(
          `Bootstrap failed: Cannot ensure .devmate structure: ${devmateResult.error}`
        )
      }

      // PHASE B: Explicit lifecycle transitions (must happen before commit verification)
      // Must transition: empty → bootstrapped → editable
      // PHASE A: Use Manager.setStage() to persist to disk
      const { getProjectEvolutionEngineManager } = await import('@/lib/os/ProjectEvolutionEngineManager')
      const peeManager = getProjectEvolutionEngineManager()
      await peeManager.getEngine(projectId, finalRootPath) // Ensure engine exists
      
      // PHASE B: Structured logging - bootstrap start
      console.log('[BootstrapGenerator] Bootstrap transaction start:', {
        projectId,
        rootPath: finalRootPath,
        platform,
        filesToCreate: filesCreated.length,
        timestamp: new Date().toISOString(),
      })
      
      // Explicit lifecycle transitions (DO NOT collapse)
      // PHASE A: Persist stage transitions to disk via Manager
      await peeManager.setStage(projectId, 'bootstrapped', 'bootstrap')
      await peeManager.setStage(projectId, 'editable', 'bootstrap')

      // PHASE B: Atomic commit verification (throws FatalBootstrapError if invariants fail)
      const { commitBootstrapTransaction } = await import('./bootstrapTransaction')
      const commitResult = await commitBootstrapTransaction(projectId, finalRootPath, filesCreated)
      
      // PHASE B: Structured logging - commit success
      console.log('[BootstrapGenerator] Bootstrap transaction committed:', {
        projectId,
        rootPath: finalRootPath,
        filesCreated: commitResult.filesCreated.length,
        stage: commitResult.stage,
        committedAt: commitResult.committedAt,
      })

      return {
        success: true,
        filesCreated,
      }
    } catch (error: any) {
      console.error('[BootstrapGenerator] Error:', error)
      return {
        success: false,
        filesCreated: [],
        error: error.message || 'Bootstrap generation failed',
      }
    }
  }

  /**
   * Generate minimal Web project files
   */
  private static generateWebFiles(): Array<{ path: string; content: string }> {
    return [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Devmate App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to Devmate</h1>
        <p>Your app is running!</p>
        <button id="clickBtn">Click Me</button>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
      },
      {
        path: 'style.css',
        content: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
    max-width: 500px;
}

h1 {
    color: #333;
    margin-bottom: 1rem;
}

p {
    color: #666;
    margin-bottom: 1.5rem;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.3s;
}

button:hover {
    background: #5568d3;
}
`,
      },
      {
        path: 'script.js',
        content: `document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('clickBtn');
    let count = 0;
    
    button.addEventListener('click', () => {
        count++;
        button.textContent = \`Clicked \${count} time\${count !== 1 ? 's' : ''}\`;
    });
});
`,
      },
    ]
  }

  /**
   * Generate minimal Node.js project files
   */
  private static generateNodeFiles(): Array<{ path: string; content: string }> {
    return [
      {
        path: 'package.json',
        content: `{
  "name": "devmate-app",
  "version": "1.0.0",
  "description": "Devmate generated app",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}`,
      },
      {
        path: 'index.js',
        content: `const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(\`<!DOCTYPE html>
<html>
<head>
    <title>Devmate App</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Devmate</h1>
        <p>Your Node.js app is running on port \${PORT}!</p>
    </div>
</body>
</html>\`);
});

server.listen(PORT, () => {
    console.log(\`Server running at http://localhost:\${PORT}/\`);
});
`,
      },
    ]
  }

  /**
   * Generate minimal React (Vite) project files
   */
  private static generateReactFiles(): Array<{ path: string; content: string }> {
    return [
      {
        path: 'package.json',
        content: `{
  "name": "devmate-react-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"
  }
}`,
      },
      {
        path: 'vite.config.ts',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
`,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Devmate React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      },
      {
        path: 'src/main.tsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
      },
      {
        path: 'src/App.tsx',
        content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Welcome to Devmate</h1>
      <p>Your React app is running!</p>
      <button onClick={() => setCount(count + 1)}>
        Count is {count}
      </button>
    </div>
  )
}

export default App
`,
      },
      {
        path: 'src/index.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
`,
      },
      {
        path: 'src/App.css',
        content: `.App {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  max-width: 500px;
}

h1 {
  color: #333;
  margin-bottom: 1rem;
}

p {
  color: #666;
  margin-bottom: 1.5rem;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #5568d3;
}
`,
      },
    ]
  }
}
