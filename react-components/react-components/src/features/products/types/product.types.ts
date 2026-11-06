// ─── Product domain types ────────────────────────────────────────────────────
// Shapes used by the products feature. Field names align with what the
// Laravel product resource returns.

export interface Product {
  id: number
  name: string
  description: string
  /** Price in major currency units (e.g. dollars), not cents. */
  price: number
  /** Category string — open-ended, comes from the backend. */
  category: string
  /** Absolute image URL returned by the backend, or empty string. */
  image: string
  /** Short availability label derived from stock_quantity. */
  availability?: string
  /** Current stock from the Warehouse service (null when unavailable). */
  stock: number
  createdAt: string
}

/**
 * ProductCategory is now an open string — categories come from the backend.
 * The constant below is only used as a fallback list when the backend
 * categories endpoint is unavailable.
 */
export type ProductCategory = string



// ─── Filters & queries ───────────────────────────────────────────────────────

export type ProductSortKey = 'featured' | 'price-asc' | 'price-desc' | 'name'

export interface ProductFilters {
  search: string
  category: string
  sort: ProductSortKey
}

export const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  category: 'All',
  sort: 'featured',
}

export interface ProductQuery {
  page: number
  perPage: number
  filters: ProductFilters
}

export interface ProductPageResult {
  items: Product[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

// ─── Mutations ────────────────────────────────────────────────────────────────
// Only fields the Laravel backend accepts for create/update.

export interface ProductInput {
  name: string
  description: string
  price: number
  category: string
}

export type ProductInputErrors = Partial<Record<keyof ProductInput, string>>
