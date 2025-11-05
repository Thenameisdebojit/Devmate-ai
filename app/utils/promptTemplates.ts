import yaml from 'js-yaml'

export interface PromptTemplate {
  name: string
  description: string
  action: 'generate' | 'explain' | 'rewrite' | 'fix'
  model: string
  temperature: number
  max_tokens: number
  system: string
  template: string
  few_shot_examples?: Array<{
    input: string
    output: string
  }>
}

const templateCache: Map<string, PromptTemplate> = new Map()

export async function loadPromptTemplate(action: string): Promise<PromptTemplate | null> {
  if (templateCache.has(action)) {
    return templateCache.get(action)!
  }

  try {
    const response = await fetch(`/config/prompts/${action}.yaml`)
    if (!response.ok) return null
    
    const yamlText = await response.text()
    const template = yaml.load(yamlText) as PromptTemplate
    
    templateCache.set(action, template)
    return template
  } catch (error) {
    console.error(`Failed to load template for ${action}:`, error)
    return null
  }
}

export async function loadAllTemplates(): Promise<PromptTemplate[]> {
  const actions = ['generate', 'explain', 'rewrite', 'fix']
  const templates = await Promise.all(
    actions.map(action => loadPromptTemplate(action))
  )
  return templates.filter(Boolean) as PromptTemplate[]
}

export function formatPromptWithTemplate(
  template: PromptTemplate,
  variables: Record<string, string>
): string {
  let formatted = template.template
  
  Object.entries(variables).forEach(([key, value]) => {
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  })
  
  return formatted
}
