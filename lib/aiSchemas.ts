import { z } from 'zod'

export const PlanSchema = z.object({
  architecture: z.string().min(10),
  files: z.array(z.string()).optional().default([]),
  database: z.string().optional(),
  routes: z.array(z.string()).optional().default([]),
  dependencies: z.array(z.string()).optional().default([]),
  framework: z.string().optional(),
})

export type Plan = z.infer<typeof PlanSchema>

export const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>

export const ProjectSchema = z.object({
  name: z.string(),
  framework: z.string(),
  files: z.array(GeneratedFileSchema),
  setup: z.string(),
  modelUsed: z.string().optional(),
})

export type Project = z.infer<typeof ProjectSchema>

export function validatePlan(data: unknown): Plan {
  try {
    return PlanSchema.parse(data)
  } catch (error) {
    // Fallback for non-structured responses
    if (typeof data === 'object' && data !== null && 'architecture' in data) {
      return PlanSchema.parse({
        architecture: (data as any).architecture || 'No architecture provided',
        files: [],
        dependencies: [],
      })
    }
    throw new Error('Invalid plan structure')
  }
}

export function validateProject(data: unknown): Project {
  return ProjectSchema.parse(data)
}
