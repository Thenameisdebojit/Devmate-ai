/**
 * PHASE F′-10: Product Memory Store
 * 
 * Persists product-level descriptors and goals.
 * No AI calls. No execution logic. Pure storage.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

/**
 * Product Descriptor
 * 
 * Represents a product composed of multiple projects.
 */
export type ProductDescriptor = {
  productId: string
  name: string
  description?: string
  projectIds: string[]
  createdAt: number
  updatedAt: number
}

/**
 * Product Goal
 * 
 * Product-level goals that coordinate across projects.
 */
export type ProductGoal = {
  id: string
  description: string
  status: 'active' | 'completed' | 'abandoned'
  relatedProjects: string[]
  priority: number
  createdAt: number
  updatedAt: number
}

/**
 * Products file structure
 */
interface ProductsFile {
  products: Record<string, ProductDescriptor> // productId -> ProductDescriptor
  goals: Record<string, ProductGoal[]> // productId -> ProductGoal[]
  version: number
}

/**
 * Product Memory Store
 * 
 * Stores product descriptors and goals.
 * Rules:
 * - Products created explicitly by user
 * - NEVER auto-created
 * - One project may belong to multiple products
 */
class ProductMemoryStoreImpl {
  private productsCache: Map<string, { products: Record<string, ProductDescriptor>; goals: Record<string, ProductGoal[]> }> = new Map()
  private readonly PRODUCTS_FILE = '.devmate/products.json'
  private readonly GLOBAL_PRODUCTS_DIR = join(process.cwd(), '.devmate-global')

  /**
   * Get products file path (global, not per-project)
   */
  private async getProductsFilePath(): Promise<string> {
    await fs.mkdir(this.GLOBAL_PRODUCTS_DIR, { recursive: true })
    return join(this.GLOBAL_PRODUCTS_DIR, 'products.json')
  }

  /**
   * Load products from disk
   */
  private async loadProducts(): Promise<{ products: Record<string, ProductDescriptor>; goals: Record<string, ProductGoal[]> }> {
    try {
      const filePath = await this.getProductsFilePath()
      const content = await fs.readFile(filePath, 'utf-8')
      const data: ProductsFile = JSON.parse(content)

      return {
        products: data.products || {},
        goals: data.goals || {},
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return empty
        return { products: {}, goals: {} }
      }
      console.error(`[ProductMemoryStore] Failed to load products:`, error)
      return { products: {}, goals: {} }
    }
  }

  /**
   * Save products to disk
   */
  private async saveProducts(
    products: Record<string, ProductDescriptor>,
    goals: Record<string, ProductGoal[]>
  ): Promise<void> {
    try {
      const filePath = await this.getProductsFilePath()

      const data: ProductsFile = {
        products,
        goals,
        version: 1,
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error: any) {
      console.error(`[ProductMemoryStore] Failed to save products:`, error)
      throw new Error(`Failed to save products: ${error.message}`)
    }
  }

  /**
   * Create a new product
   */
  async createProduct(product: Omit<ProductDescriptor, 'productId' | 'createdAt' | 'updatedAt'>): Promise<ProductDescriptor> {
    const { products, goals } = await this.loadProducts()

    // Generate unique ID
    const productId = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newProduct: ProductDescriptor = {
      ...product,
      productId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    products[productId] = newProduct
    await this.saveProducts(products, goals)

    return newProduct
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<ProductDescriptor | null> {
    const { products } = await this.loadProducts()
    return products[productId] || null
  }

  /**
   * Get all products
   */
  async getAllProducts(): Promise<ProductDescriptor[]> {
    const { products } = await this.loadProducts()
    return Object.values(products)
  }

  /**
   * Get products containing a project
   */
  async getProductsForProject(projectId: string): Promise<ProductDescriptor[]> {
    const { products } = await this.loadProducts()
    return Object.values(products).filter(p => p.projectIds.includes(projectId))
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    updates: Partial<Omit<ProductDescriptor, 'productId' | 'createdAt'>>
  ): Promise<ProductDescriptor> {
    const { products, goals } = await this.loadProducts()
    const product = products[productId]

    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }

    const updated: ProductDescriptor = {
      ...product,
      ...updates,
      updatedAt: Date.now(),
    }

    products[productId] = updated
    await this.saveProducts(products, goals)

    return updated
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: string): Promise<void> {
    const { products, goals } = await this.loadProducts()

    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`)
    }

    delete products[productId]
    delete goals[productId] // Also delete associated goals
    await this.saveProducts(products, goals)
  }

  /**
   * Add goal to product
   */
  async addProductGoal(productId: string, goal: Omit<ProductGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductGoal> {
    const { products, goals } = await this.loadProducts()

    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`)
    }

    const goalId = `product-goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newGoal: ProductGoal = {
      ...goal,
      id: goalId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const productGoals = goals[productId] || []
    productGoals.push(newGoal)
    goals[productId] = productGoals

    await this.saveProducts(products, goals)

    return newGoal
  }

  /**
   * Get goals for a product
   */
  async getProductGoals(productId: string): Promise<ProductGoal[]> {
    const { goals } = await this.loadProducts()
    return goals[productId] || []
  }

  /**
   * Update product goal
   */
  async updateProductGoal(
    productId: string,
    goalId: string,
    updates: Partial<Omit<ProductGoal, 'id' | 'createdAt' | 'productId'>>
  ): Promise<ProductGoal> {
    const { products, goals } = await this.loadProducts()

    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`)
    }

    const productGoals = goals[productId] || []
    const goalIndex = productGoals.findIndex(g => g.id === goalId)

    if (goalIndex === -1) {
      throw new Error(`Goal ${goalId} not found in product ${productId}`)
    }

    const updated: ProductGoal = {
      ...productGoals[goalIndex],
      ...updates,
      updatedAt: Date.now(),
    }

    productGoals[goalIndex] = updated
    goals[productId] = productGoals

    await this.saveProducts(products, goals)

    return updated
  }

  /**
   * Delete product goal
   */
  async deleteProductGoal(productId: string, goalId: string): Promise<void> {
    const { products, goals } = await this.loadProducts()

    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`)
    }

    const productGoals = goals[productId] || []
    const filtered = productGoals.filter(g => g.id !== goalId)

    if (filtered.length === productGoals.length) {
      throw new Error(`Goal ${goalId} not found in product ${productId}`)
    }

    goals[productId] = filtered
    await this.saveProducts(products, goals)
  }
}

// Singleton instance
let storeInstance: ProductMemoryStoreImpl | null = null

export function getProductMemoryStore(): ProductMemoryStoreImpl {
  if (!storeInstance) {
    storeInstance = new ProductMemoryStoreImpl()
  }
  return storeInstance
}
