// ============================================================
// lib/api.ts
// PERUBAHAN: analyticsApi.recordEvent terima geo fields
// (city, region, country, latitude, longitude) dari frontend
// ============================================================

import axios, { AxiosError } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('shoplink_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/admin')) {
        localStorage.removeItem('shoplink_token')
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Types ────────────────────────────────────────────────────
export interface StoreProfile {
  id: string | null
  name: string
  description: string | null
  logo_url: string | null
  theme_color: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
  is_active?: boolean
}

export interface Product {
  id: string
  category_id: string
  name: string
  short_description: string | null
  description: string | null
  price: string | null
  image_url: string | null
  marketplace_url: string
  sort_order: number
  is_active?: boolean
  categories?: Pick<Category, 'id' | 'name' | 'slug' | 'icon'>
}

export interface AdminUser {
  id: string
  email: string
  created_at: string
}

export type AnalyticsPeriod = '1d' | '7d' | '30d'

export interface DailyStat {
  day: string; views: number; clicks: number
}

export interface ProductStat {
  product_id: string; product_name: string; category_name: string
  image_url: string | null; view_count: number; click_count: number
}

export interface CategoryStat {
  category_id: string; category_name: string; icon: string | null
  view_count: number; click_count: number
}

export interface AnalyticsSummary {
  totalViews: number; totalClicks: number; period: AnalyticsPeriod
}

export interface LocationStat {
  city: string; region: string; country: string
  latitude: number; longitude: number
  view_count: number; click_count: number
}

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data.data as { token: string; admin: AdminUser }
  },
  // FIX: tambah method register yang sebelumnya tidak ada
  // Dipanggil dari app/admin/register/page.tsx
  // Backend: POST /api/auth/register
  register: async (email: string, password: string) => {
    const { data } = await api.post('/auth/register', { email, password })
    return data.data as { token: string; admin: AdminUser }
  },
  logout: async () => {
    await api.post('/auth/logout')
    localStorage.removeItem('shoplink_token')
  },
  me: async () => {
    const { data } = await api.get('/auth/me')
    return data.data as AdminUser
  },
}

// ── Store ─────────────────────────────────────────────────────
export const storeApi = {
  get: async (): Promise<StoreProfile> => {
    const { data } = await api.get('/store')
    return data.data
  },
  update: async (formData: FormData): Promise<StoreProfile> => {
    const { data } = await api.put('/admin/store', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },
}

// ── Categories ────────────────────────────────────────────────
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const { data } = await api.get('/categories')
    return data.data
  },
  getBySlug: async (slug: string): Promise<Category & { products: Product[] }> => {
    const { data } = await api.get(`/categories/${slug}`)
    return data.data
  },
  getAllAdmin: async (): Promise<Category[]> => {
    const { data } = await api.get('/admin/categories')
    return data.data
  },
  create: async (payload: { name: string; icon?: string; sort_order?: number; is_active?: boolean }): Promise<Category> => {
    const { data } = await api.post('/admin/categories', payload)
    return data.data
  },
  update: async (id: string, payload: Partial<Category>): Promise<Category> => {
    const { data } = await api.put(`/admin/categories/${id}`, payload)
    return data.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/categories/${id}`)
  },
  reorder: async (items: { id: string; sort_order: number }[]): Promise<void> => {
    await api.put('/admin/categories/reorder', { items })
  },
}

// ── Products ──────────────────────────────────────────────────
export const productsApi = {
  getAll: async (categorySlug?: string): Promise<Product[]> => {
    const params = categorySlug ? { category: categorySlug } : {}
    const { data } = await api.get('/products', { params })
    return data.data
  },
  getById: async (id: string): Promise<Product> => {
    const { data } = await api.get(`/products/${id}`)
    return data.data
  },
  getAllAdmin: async (params?: { is_active?: boolean }): Promise<Product[]> => {
    const { data } = await api.get('/admin/products/all', { params })
    const products: Product[] = (data.data ?? []).map((p: Product & { categories?: { id: string } }) => ({
      ...p,
      category_id: p.category_id ?? p.categories?.id ?? '',
    }))
    return products
  },
  create: async (formData: FormData): Promise<Product> => {
    const { data } = await api.post('/admin/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },
  update: async (id: string, formData: FormData): Promise<Product> => {
    const { data } = await api.put(`/admin/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },
  updatePartial: async (id: string, payload: Partial<Pick<Product, 'is_active' | 'sort_order'>>): Promise<Product> => {
    const { data } = await api.patch(`/admin/products/${id}`, payload)
    return data.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/products/${id}`)
  },
  reorder: async (items: { id: string; sort_order: number }[]): Promise<void> => {
    await api.put('/admin/products/reorder', { items })
  },
}

// ── Analytics ─────────────────────────────────────────────────
export const analyticsApi = {
  // Geo fields dikirim dari frontend (lebih akurat dari lookup server-side)
  recordEvent: async (payload: {
    event_type:   'category_view' | 'product_click'
    category_id?: string
    product_id?:  string
    session_id?:  string
    // Geo fields — dikirim langsung dari browser via ipapi.co
    city?:      string
    region?:    string
    country?:   string
    latitude?:  number
    longitude?: number
  }): Promise<void> => {
    try {
      await api.post('/analytics/event', payload)
    } catch {
      // silent fail
    }
  },

  getSummary: async (period: AnalyticsPeriod = '7d'): Promise<AnalyticsSummary> => {
    const { data } = await api.get('/admin/analytics/summary', { params: { period } })
    return data.data
  },
  getDaily: async (period: AnalyticsPeriod = '7d'): Promise<DailyStat[]> => {
    const { data } = await api.get('/admin/analytics/daily', { params: { period } })
    return data.data
  },
  getProductStats: async (period: AnalyticsPeriod = '7d'): Promise<ProductStat[]> => {
    const { data } = await api.get('/admin/analytics/products', { params: { period } })
    return data.data
  },
  getCategoryStats: async (period: AnalyticsPeriod = '7d'): Promise<CategoryStat[]> => {
    const { data } = await api.get('/admin/analytics/categories', { params: { period } })
    return data.data
  },
  getLocations: async (period: AnalyticsPeriod = '7d'): Promise<LocationStat[]> => {
    const { data } = await api.get('/admin/analytics/locations', { params: { period } })
    return data.data
  },
}

// ── Helpers ───────────────────────────────────────────────────
export function saveToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem('shoplink_token', token)
}
export function getToken(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem('shoplink_token')
  return null
}
export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.message ?? err.message ?? 'Terjadi kesalahan'
  }
  if (err instanceof Error) return err.message
  return 'Terjadi kesalahan tidak diketahui'
}

export const CATEGORY_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-200',   dot: 'bg-teal-500'   },
  { bg: 'bg-orange-100', text: 'text-orange-700',  border: 'border-orange-200', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100',   text: 'text-pink-700',    border: 'border-pink-200',   dot: 'bg-pink-500'   },
  { bg: 'bg-blue-100',   text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500'  },
  { bg: 'bg-emerald-100',text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-500'},
  { bg: 'bg-rose-100',   text: 'text-rose-700',    border: 'border-rose-200',   dot: 'bg-rose-500'   },
]

export function getCategoryColor(index: number) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}