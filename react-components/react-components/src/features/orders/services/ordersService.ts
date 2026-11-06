/**
 * ordersService
 *
 * VITE_USE_MOCK=true  (default) → in-memory demo data.
 * VITE_USE_MOCK=false           → real Laravel endpoints:
 *     GET    /orders?page=&per_page=&status=
 *     GET    /orders/{id}
 *     POST   /orders         { items: [{ product_id, quantity }] }
 *     PATCH  /orders/{id}/status  { status }
 *
 * Laravel OrderResource shape:
 *   {
 *     id, user_id, status, total,
 *     items: [{ product_id, product_name, unit_price, quantity, subtotal }],
 *     created_at, updated_at
 *   }
 *
 * Single resources are wrapped: { data: { ...order } }
 * Collections are wrapped:      { data: [...orders], meta: {...}, links: {...} }
 */

import { env } from '@/shared/config/env'
import { apiClient } from '@/shared/lib/apiClient'
import type { PaginatedResponse } from '@/shared/types/api.types'
import { SEED_ORDERS } from '../data/seedOrders'
import type {
  CreateOrderPayload,
  Order,
  OrderItem,
  OrderPageResult,
  OrderQuery,
  OrderStatus,
} from '../types/order.types'

// ─── Backend DTO (Laravel OrderResource shape) ───────────────────────────────
interface OrderItemDto {
  product_id: number
  product_name: string
  unit_price: string | number
  quantity: number
  subtotal: string | number
}

interface OrderDto {
  id: number
  user_id: number
  user_name?: string | null
  status: OrderStatus
  total: string | number
  items?: OrderItemDto[]
  created_at: string
  updated_at: string
}

interface OrderDtoEnvelope {
  data: OrderDto
}

function mapOrderItem(item: OrderItemDto): OrderItem {
  return {
    productId: item.product_id,
    name: item.product_name,
    price: Number(item.unit_price),
    qty: item.quantity,
    image: '',  // not stored in the order — can be enriched from products if needed
  }
}

function mapOrder(dto: OrderDto): Order {
  return {
    id: String(dto.id),
    userId: dto.user_id,
    items: (dto.items ?? []).map(mapOrderItem),
    subtotal: Number(dto.total),
    shippingCost: 0,
    total: Number(dto.total),
    address: {
      // Backend doesn't store shipping address — use user_name as fullName for display
      fullName: dto.user_name ?? `User #${dto.user_id}`,
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

// ─── Mock store ───────────────────────────────────────────────────────────────
let store: Order[] = [...SEED_ORDERS]
let nextOrderNum = SEED_ORDERS.length + 1

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function padId(n: number): string {
  return `ORD-${String(n).padStart(4, '0')}`
}

function mockList(query: OrderQuery): OrderPageResult {
  let filtered = [...store]

  if (query.userId !== undefined) {
    filtered = filtered.filter((o) => o.userId === query.userId)
  }
  if (query.status && query.status !== 'all') {
    filtered = filtered.filter((o) => o.status === query.status)
  }
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase()
    filtered = filtered.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.address.fullName.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q)),
    )
  }

  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / query.perPage))
  const page = Math.min(Math.max(query.page, 1), totalPages)
  const start = (page - 1) * query.perPage

  return {
    items: filtered.slice(start, start + query.perPage),
    total,
    page,
    perPage: query.perPage,
    totalPages,
  }
}

function mockGetById(id: string): Order | null {
  return store.find((o) => o.id === id) ?? null
}

function mockCreate(payload: CreateOrderPayload): Order {
  const now = new Date().toISOString()
  const order: Order = {
    id: padId(nextOrderNum++),
    ...payload,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  store = [order, ...store]
  return order
}

function mockUpdateStatus(id: string, status: OrderStatus): Order {
  const idx = store.findIndex((o) => o.id === id)
  if (idx === -1) throw new Error(`Order ${id} not found`)
  const updated = { ...store[idx], status, updatedAt: new Date().toISOString() }
  store = store.map((o, i) => (i === idx ? updated : o))
  return updated
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function list(query: OrderQuery): Promise<OrderPageResult> {
  if (!env.useMock) {
    const res = await apiClient.get<PaginatedResponse<OrderDto>>('/orders', {
      params: {
        page: query.page,
        per_page: query.perPage,
        status: query.status !== 'all' ? query.status : undefined,
      },
    })
    return {
      items: res.data.map(mapOrder),
      total: res.meta.total,
      page: res.meta.current_page,
      perPage: res.meta.per_page,
      totalPages: Math.max(1, res.meta.last_page),
    }
  }
  return delay(mockList(query))
}

async function getById(id: string): Promise<Order | null> {
  if (!env.useMock) {
    try {
      const res = await apiClient.get<OrderDtoEnvelope>(`/orders/${id}`)
      return mapOrder(res.data)
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null
      throw e
    }
  }
  return delay(mockGetById(id))
}

/**
 * Create an order. When using the real API, only product_id + quantity are
 * sent per item — the backend resolves names/prices from the Products module.
 */
async function create(payload: CreateOrderPayload): Promise<Order> {
  if (!env.useMock) {
    // Laravel StoreOrderRequest only needs: items[*].product_id + items[*].quantity
    const res = await apiClient.post<OrderDtoEnvelope>('/orders', {
      items: payload.items.map((i) => ({
        product_id: i.productId,
        quantity: i.qty,
      })),
    })
    return mapOrder(res.data)
  }
  await delay(undefined, 500)
  return mockCreate(payload)
}

async function updateStatus(id: string, status: OrderStatus): Promise<Order> {
  if (!env.useMock) {
    const res = await apiClient.patch<OrderDtoEnvelope>(`/orders/${id}/status`, { status })
    return mapOrder(res.data)
  }
  await delay(undefined, 300)
  return mockUpdateStatus(id, status)
}

export const ordersService = { list, getById, create, updateStatus } as const
