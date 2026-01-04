/**
 * Direct App Generator (Fallback for serverless environments)
 * Generates complete applications using AI models directly without Python agent
 */

import { callAIModel, streamAIModel, callAIModelWithFailover } from './aiOrchestrator'

interface ProjectFile {
  path: string
  content: string
}

interface GeneratedProject {
  projectName: string
  framework: string
  description: string
  files: ProjectFile[]
  setupInstructions: string
}

const SYSTEM_INSTRUCTION = `You are an expert full-stack application architect and developer.
Generate complete, production-ready applications with proper project structure.

CRITICAL REQUIREMENTS - MUST FOLLOW:
1. Generate COMPLETE, WORKING applications - NO placeholders, NO TODOs, NO incomplete code
2. Include ALL necessary files: package.json, configs, routes, components, styles, etc.
3. Use modern best practices and latest frameworks
4. Include proper error handling and validation
5. Generate clean, maintainable code with helpful comments
6. Include setup instructions in README.md
7. EVERY file must be FULLY IMPLEMENTED - no partial code
8. Generate MINIMUM 10-15 files for a complete application

MANDATORY FILES FOR FRONTEND:
- package.json (with all dependencies and scripts)
- Main entry file (index.tsx, App.tsx, etc.)
- Component files for all features
- Styling files (CSS/Tailwind)
- Configuration files (vite.config, tsconfig.json, tailwind.config.js, etc.)
- .gitignore
- .env.example (if needed)
- README.md with setup instructions

MANDATORY FILES FOR BACKEND:
- package.json or requirements.txt
- Main server file
- Route/API files
- Model/schema files
- Middleware files
- Configuration files
- .env.example
- README.md

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "projectName": "project-name",
  "framework": "framework-name",
  "description": "brief description",
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "complete file content"
    }
  ],
  "setupInstructions": "step-by-step setup guide"
}

IMPORTANT: 
- Output ONLY valid JSON, no markdown formatting
- Generate AT LEAST 10-15 complete files
- Each file must be FULLY IMPLEMENTED with no placeholders`

function detectFramework(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase()
  
  if (lowerPrompt.includes('next.js') || lowerPrompt.includes('nextjs')) return 'Next.js'
  if (lowerPrompt.includes('react')) return 'React + Vite'
  if (lowerPrompt.includes('express')) return 'Express.js'
  if (lowerPrompt.includes('flask')) return 'Flask (Python)'
  if (lowerPrompt.includes('fastapi')) return 'FastAPI (Python)'
  if (lowerPrompt.includes('vue')) return 'Vue.js'
  if (lowerPrompt.includes('angular')) return 'Angular'
  if (lowerPrompt.includes('svelte')) return 'Svelte'
  if (lowerPrompt.includes('mobile') || lowerPrompt.includes('android') || lowerPrompt.includes('ios')) return 'React Native'
  
  return 'Next.js'
}

export async function generateAppDirect(prompt: string): Promise<GeneratedProject> {
  const detectedFramework = detectFramework(prompt)
  
  const enhancedPrompt = `Generate a complete, production-ready application based on this request:

USER REQUEST: ${prompt}

DETECTED FRAMEWORK: ${detectedFramework}

Generate a full project structure with:
- All necessary configuration files (package.json, tsconfig.json, tailwind.config.js, etc.)
- Complete source code organized in proper folders
- README.md with setup and running instructions
- Environment variable templates if needed
- Modern, clean UI with responsive design
- Proper error handling and validation
- No placeholder code - everything must be complete and working

For frontend applications, include:
- package.json with all dependencies
- Main component files (App.tsx, index.tsx, etc.)
- Component files for all features
- Styling files (CSS/Tailwind)
- Configuration files (vite.config, tsconfig.json, etc.)
- .gitignore, .env.example

For backend applications, include:
- package.json or requirements.txt
- Main server file
- Route/API files
- Model files
- Middleware files
- Configuration files
- .env.example

For full-stack applications, include both frontend and backend folders with complete code.

Remember to output ONLY valid JSON in the specified format.`

  try {
    const responseObj = await callAIModelWithFailover({
      prompt: enhancedPrompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      maxTokens: 16384, // Increased for complete apps
    }, 'auto') // Let orchestrator decide based on available keys

    const response = responseObj.text

    // Extract JSON from response
    let jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Try to find JSON in markdown code blocks
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]]
      }
    }

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const projectData = JSON.parse(jsonMatch[0])

    // Validate and format
    if (!projectData.files || !Array.isArray(projectData.files)) {
      throw new Error('Invalid project structure: missing files array')
    }

    // Filter out empty files and validate
    const validFiles = projectData.files
      .map((f: any) => ({
        path: typeof f === 'string' ? f : f.path || '',
        content: typeof f === 'string' ? '' : (f.content || '').trim()
      }))
      .filter((f: any) => f.path && f.content) // Only include files with both path and content

    if (validFiles.length === 0) {
      throw new Error('No valid files were generated. Please try again with a more specific prompt.')
    }

    if (validFiles.length < 5) {
      console.warn(`Only ${validFiles.length} files generated. Expected more for a complete application.`)
    }

    return {
      projectName: projectData.projectName || 'generated-project',
      framework: projectData.framework || detectedFramework,
      description: projectData.description || prompt.substring(0, 100),
      files: validFiles,
      setupInstructions: projectData.setupInstructions || generateDefaultSetupInstructions(detectedFramework)
    }
  } catch (error: any) {
    console.error('Direct generation error:', error)
    throw new Error(`Failed to generate application: ${error.message}`)
  }
}

function generateDefaultSetupInstructions(framework: string): string {
  if (framework.includes('Next.js')) {
    return `# Setup Instructions

1. Install dependencies:
   npm install

2. Run development server:
   npm run dev

3. Build for production:
   npm run build

4. Start production server:
   npm start`
  } else if (framework.includes('React')) {
    return `# Setup Instructions

1. Install dependencies:
   npm install

2. Run development server:
   npm run dev

3. Build for production:
   npm run build`
  } else if (framework.includes('Express')) {
    return `# Setup Instructions

1. Install dependencies:
   npm install

2. Set up environment variables (create .env file):
   PORT=5000
   NODE_ENV=development

3. Run development server:
   npm run dev

4. Start production server:
   npm start`
  } else {
    return `# Setup Instructions

Please check the README.md file in the project for specific setup instructions.`
  }
}

