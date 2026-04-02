'use client'

// ============================================================
// app/admin/dashboard/page.tsx — UPDATED CHARTS
// Perbaikan:
//   1. Traffic chart: fill semua tanggal dalam range (bukan hanya yg ada data)
//      - 1d  → 24 jam (per jam)
//      - 7d  → 7 hari terakhir persis (Senin–Minggu atau sesuai range)
//      - 30d → 30 hari terakhir dari hari ini
//   2. type="natural" pada Area → efek gelombang smooth
//   3. Distribusi Klik → tiap bar produk warna berbeda + legend berwarna
// ============================================================

import { useEffect, useState, ReactNode, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  LayoutDashboard, Tag, Package, Store, LogOut,
  ExternalLink, Menu, ShoppingBag,
  TrendingUp, FolderOpen, Eye, MousePointerClick,
  Trophy, ArrowUpRight, Flame, Star, MapPin,
} from 'lucide-react'
import {
  storeApi, categoriesApi, productsApi, authApi,
  analyticsApi, getErrorMessage,
  StoreProfile, AnalyticsPeriod, DailyStat,
  ProductStat, CategoryStat, LocationStat,
} from '@/lib/api'

const IndonesiaMap = dynamic(() => import('@/components/IndonesiaMap'), {
  ssr: false,
  loading: () => (
    <div className="h-72 bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
      <p className="text-gray-400 text-sm font-semibold">Memuat peta...</p>
    </div>
  ),
})

// ── Constants ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/kategori',  label: 'Kategori',    icon: Tag },
  { href: '/admin/produk',    label: 'Produk',      icon: Package },
  { href: '/admin/profile',   label: 'Profil Toko', icon: Store },
]

const PERIOD_OPTIONS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '1 Hari',  value: '1d'  },
  { label: '7 Hari',  value: '7d'  },
  { label: '30 Hari', value: '30d' },
]

// Palet warna untuk bar chart distribusi (10 warna berbeda)
const BAR_PALETTE = [
  { click: '#7C3AED', visit: '#C4B5FD' },  // violet
  { click: '#0D9488', visit: '#99F6E4' },  // teal
  { click: '#EA580C', visit: '#FED7AA' },  // orange
  { click: '#DB2777', visit: '#FBCFE8' },  // pink
  { click: '#2563EB', visit: '#BFDBFE' },  // blue
  { click: '#D97706', visit: '#FDE68A' },  // amber
  { click: '#16A34A', visit: '#BBF7D0' },  // green
  { click: '#DC2626', visit: '#FECACA' },  // red
  { click: '#7C3AED', visit: '#DDD6FE' },  // purple light
  { click: '#0E7490', visit: '#A5F3FC' },  // cyan
]

// ── Date helpers ──────────────────────────────────────────────

/**
 * Generate array slot tanggal/jam untuk chart berdasarkan period.
 * Setiap slot punya key string + label display.
 * Jika ada data dari API, di-merge; slot kosong = 0.
 */
function buildChartSlots(
  period: AnalyticsPeriod,
  apiData: DailyStat[]
): { key: string; label: string; views: number; clicks: number }[] {
  const now = new Date()

  // Map data API: key → { views, clicks }
  const dataMap = new Map<string, { views: number; clicks: number }>()
  // apiData.forEach(d => {
  //   // key dari API format 'YYYY-MM-DD' atau 'YYYY-MM-DDTHH:mm'
  //   dataMap.set(d.day, { views: d.views, clicks: d.clicks })
  // })
  apiData.forEach(d => {
    const normalized = d.day.slice(0, 10) // ambil YYYY-MM-DD saja
    dataMap.set(normalized, {
      views: d.views,
      clicks: d.clicks,
    })
  })

  // ── 1 Hari → 24 slot per jam ──────────────────────────────
  if (period === '1d') {
    const slots = []
    for (let h = 0; h < 24; h++) {
      const d = new Date(now)
      d.setHours(h, 0, 0, 0)
      const key = d.toISOString().slice(0, 13)   // 'YYYY-MM-DDTHH'
      const label = `${String(h).padStart(2, '0')}:00`
      // Coba match dengan berbagai format key dari API
      const found =
        dataMap.get(key) ??
        dataMap.get(key + ':00') ??
        dataMap.get(d.toISOString().slice(0, 16))
      slots.push({ key, label, views: found?.views ?? 0, clicks: found?.clicks ?? 0 })
    }
    return slots
  }

  // ── 7 Hari & 30 Hari → slot per hari ─────────────────────
  const days = period === '7d' ? 7 : 30
  const slots = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)

    // const key = d.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
    const key = d.toLocaleDateString('en-CA') // YYYY-MM-DD lokal

    let label: string
    if (period === '7d') {
      // Tampilkan: nama hari singkat + tanggal, misal "Sen 1", "Sel 2"
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
      label = `${dayNames[d.getDay()]} ${d.getDate()}`
    } else {
      // 30 hari: tampilkan "1 Jan", "15 Jan" — hanya tampil tiap 5 hari supaya tidak crowded
      // (XAxis di recharts akan handle tick interval otomatis)
      const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
      label = `${d.getDate()} ${monthNames[d.getMonth()]}`
    }

    const found = dataMap.get(key)
    slots.push({ key, label, views: found?.views ?? 0, clicks: found?.clicks ?? 0 })
  }

  return slots
}

// ── Admin Layout ──────────────────────────────────────────────
export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [store, setStore]             = useState<StoreProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loggingOut, setLoggingOut]   = useState(false)

  useEffect(() => { storeApi.get().then(setStore).catch(() => {}) }, [])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await authApi.logout()
      document.cookie = 'shoplink_token=; path=/; max-age=0'
      toast.success('Berhasil logout')
      router.push('/admin/login')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoggingOut(false) }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-violet-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-gray-800 text-sm truncate">{store?.name ?? 'ShopLink'}</p>
            <p className="text-xs text-violet-500 font-semibold">Admin Panel</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active ? 'bg-violet-100 text-violet-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors mb-2">
          <ExternalLink className="w-4 h-4" />Lihat Tampilan Publik
        </a>
        <button onClick={handleLogout} disabled={loggingOut}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
          <LogOut className="w-4 h-4" />{loggingOut ? 'Logout...' : 'Logout'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 fixed top-0 left-0 h-full z-30 shadow-sm">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-2xl"><SidebarContent /></aside>
        </div>
      )}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 shadow-sm">
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          <span className="font-bold text-gray-800 text-sm">{title ?? 'Admin Panel'}</span>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {title && <h1 className="text-2xl font-extrabold text-gray-800 mb-6 hidden lg:block">{title}</h1>}
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Reusable UI ───────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: typeof Tag; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-800 leading-none">{value}</p>
        <p className="text-sm text-gray-500 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function PeriodSelector({ value, onChange }: { value: AnalyticsPeriod; onChange: (v: AnalyticsPeriod) => void }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
      {PERIOD_OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            value === opt.value ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Custom tooltip untuk traffic area chart
function TrafficTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-600 mb-2 pb-1.5 border-b border-gray-50">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// Custom tooltip untuk bar chart distribusi
function DistribusiTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-700 mb-2 pb-1.5 border-b border-gray-50 truncate">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-xl ${className}`} />
}

function TopGainerRow({ rank, product }: { rank: number; product: ProductStat }) {
  const rankColors = ['text-amber-500', 'text-gray-400', 'text-orange-400']
  const rankIcons  = [Trophy, Star, Flame]
  const RankIcon   = rank <= 3 ? rankIcons[rank - 1] : null
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 font-extrabold text-sm ${rank <= 3 ? rankColors[rank - 1] : 'text-gray-400'}`}>
        {RankIcon ? <RankIcon className="w-4 h-4" /> : rank}
      </div>
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-4 h-4 text-gray-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 text-sm truncate leading-tight">{product.product_name}</p>
        <p className="text-xs text-gray-400 truncate">{product.category_name}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <MousePointerClick className="w-3 h-3 text-violet-500" />
          <span className="text-xs font-bold text-violet-700">{product.click_count.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3 text-teal-500" />
          <span className="text-xs font-semibold text-gray-400">{product.view_count.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

function CategoryBarRow({ cat, maxViews }: { cat: CategoryStat; maxViews: number }) {
  const pct = maxViews > 0 ? Math.round((cat.view_count / maxViews) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
          {cat.icon && <span>{cat.icon}</span>}{cat.category_name}
        </span>
        <span className="text-gray-400 font-medium">{cat.view_count.toLocaleString()} kunjungan</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400">{cat.click_count.toLocaleString()} klik marketplace</p>
    </div>
  )
}

function LocationTable({ locations }: { locations: LocationStat[] }) {
  const top = locations.slice(0, 8)
  if (top.length === 0) return (
    <div className="h-32 flex flex-col items-center justify-center text-gray-300">
      <MapPin className="w-8 h-8 mb-1" />
      <p className="text-sm font-semibold">Belum ada data lokasi</p>
      <p className="text-xs mt-0.5">Data muncul setelah ada pengunjung</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {['#', 'Kota', 'Provinsi', 'Kunjungan', 'Klik'].map((h, i) => (
              <th key={h} className={`py-2 text-gray-400 font-semibold ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map((loc, i) => (
            <tr key={`${loc.city}-${i}`} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-400 font-bold">{i + 1}</td>
              <td className="py-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-violet-400 flex-shrink-0" />
                  <span className="font-semibold text-gray-700">{loc.city}</span>
                </div>
              </td>
              <td className="py-2 text-gray-400">{loc.region}</td>
              <td className="py-2 text-right font-bold text-violet-700">{loc.view_count.toLocaleString()}</td>
              <td className="py-2 text-right font-bold text-teal-600">{loc.click_count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Custom Legend untuk bar chart distribusi ──────────────────
function DistribusiLegend({ products }: { products: { name: string; index: number }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 px-1">
      {products.map(({ name, index }) => {
        const color = BAR_PALETTE[index % BAR_PALETTE.length]
        return (
          <div key={name} className="flex items-center gap-1.5 min-w-0">
            <div className="flex gap-0.5 flex-shrink-0">
              <div className="w-3 h-3 rounded-sm" style={{ background: color.visit }} />
              <div className="w-3 h-3 rounded-sm" style={{ background: color.click }} />
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[100px]" title={name}>{name}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const [period, setPeriod]               = useState<AnalyticsPeriod>('7d')
  const [store, setStore]                 = useState<StoreProfile | null>(null)
  const [stats, setStats]                 = useState({ categories: 0, products: 0 })
  const [summary, setSummary]             = useState({ totalViews: 0, totalClicks: 0 })
  const [dailyData, setDailyData]         = useState<DailyStat[]>([])
  const [productStats, setProductStats]   = useState<ProductStat[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [locations, setLocations]         = useState<LocationStat[]>([])
  const [loadingBase, setLoadingBase]     = useState(true)
  const [loadingChart, setLoadingChart]   = useState(true)

  useEffect(() => {
    async function loadBase() {
      try {
        const [cats, prods, storeData] = await Promise.all([
          categoriesApi.getAll(),
          productsApi.getAllAdmin(),
          storeApi.get(),
        ])
        setStats({ categories: cats.length, products: prods.length })
        setStore(storeData)
      } catch { /* silent */ }
      finally { setLoadingBase(false) }
    }
    loadBase()
  }, [])

  const loadAnalytics = useCallback(async (p: AnalyticsPeriod) => {
    setLoadingChart(true)
    try {
      const [sum, daily, prodStats, catStats, locs] = await Promise.all([
        analyticsApi.getSummary(p),
        analyticsApi.getDaily(p),
        analyticsApi.getProductStats(p),
        analyticsApi.getCategoryStats(p),
        analyticsApi.getLocations(p),
      ])
      setSummary({ totalViews: sum.totalViews, totalClicks: sum.totalClicks })
      setDailyData(daily)
      setProductStats(prodStats)
      setCategoryStats(catStats)
      setLocations(locs)
    } catch { /* silent */ }
    finally { setLoadingChart(false) }
  }, [])

  useEffect(() => { loadAnalytics(period) }, [period, loadAnalytics])

  // Computed
  const topGainers       = productStats.slice(0, 5)
  const maxCategoryViews = Math.max(...categoryStats.map(c => c.view_count), 1)
  const avgCTR           = summary.totalViews > 0
    ? ((summary.totalClicks / summary.totalViews) * 100).toFixed(1) : '0.0'
  const periodLabel      = period === '1d' ? '1 hari' : period === '7d' ? '7 hari' : '30 hari'

  // ── Chart data: fill semua slot (tanggal/jam) ─────────────
  const chartSlots = buildChartSlots(period, dailyData)

  // Interval XAxis: 1d=setiap 3 jam, 7d=semua, 30d=setiap 5 hari
  const xAxisInterval = period === '1d' ? 2 : period === '7d' ? 0 : 4

  // ── Distribusi Klik data ──────────────────────────────────
  const distribusiRaw = productStats
    .filter(p => p.click_count > 0)
    .slice(0, 10)

  const distribusiData = distribusiRaw.map((p, idx) => ({
    name:      p.product_name.length > 12 ? p.product_name.slice(0, 12) + '…' : p.product_name,
    fullName:  p.product_name,
    Kunjungan: p.view_count,
    Klik:      p.click_count,
    colorIndex: idx,
  }))

  // Label produk untuk custom legend
  const distribusiLegendItems = distribusiRaw.map((p, idx) => ({
    name:  p.product_name,
    index: idx,
  }))

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">

        {/* Banner */}
        <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative">
            <p className="text-violet-200 text-sm font-semibold mb-1">Selamat datang kembali!</p>
            <h2 className="text-2xl font-extrabold">{store?.name ?? 'ShopLink Store'}</h2>
            <p className="text-violet-200 text-sm mt-1">Kelola produk dan pantau performa toko Anda.</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Kategori"   value={loadingBase  ? '...' : stats.categories}
            icon={FolderOpen}       color="bg-violet-100 text-violet-600" />
          <StatCard label="Total Produk"     value={loadingBase  ? '...' : stats.products}
            icon={Package}          color="bg-teal-100 text-teal-600" />
          <StatCard label="Total Kunjungan"  value={loadingChart ? '...' : summary.totalViews.toLocaleString()}
            icon={Eye}              color="bg-blue-100 text-blue-600"     sub={`${periodLabel} terakhir`} />
          <StatCard label="Klik Marketplace" value={loadingChart ? '...' : summary.totalClicks.toLocaleString()}
            icon={MousePointerClick} color="bg-rose-100 text-rose-600"   sub={`CTR ${avgCTR}%`} />
        </div>

        {/* ── Traffic Overview Chart ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-extrabold text-gray-800">Traffic Overview</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {period === '1d' && 'Per jam — hari ini'}
                {period === '7d' && (() => {
                  const now = new Date()
                  const from = new Date(now); from.setDate(now.getDate() - 6)
                  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
                  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
                  return `${dayNames[from.getDay()]} ${from.getDate()} ${monthNames[from.getMonth()]} — ${dayNames[now.getDay()]} ${now.getDate()} ${monthNames[now.getMonth()]}`
                })()}
                {period === '30d' && (() => {
                  const now = new Date()
                  const from = new Date(now); from.setDate(now.getDate() - 29)
                  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
                  return `${from.getDate()} ${monthNames[from.getMonth()]} — ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`
                })()}
              </p>
            </div>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>

          {loadingChart ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div>
              {/* Summary mini stats di atas chart */}
              <div className="flex gap-5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="text-xs text-gray-500">Kunjungan:</span>
                  <span className="text-xs font-bold text-violet-700">
                    {chartSlots.reduce((s, d) => s + d.views, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  <span className="text-xs text-gray-500">Klik:</span>
                  <span className="text-xs font-bold text-teal-700">
                    {chartSlots.reduce((s, d) => s + d.clicks, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={chartSlots}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    {/* Gradient views — violet */}
                    <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#7C3AED" stopOpacity={0.25} />
                      <stop offset="60%"  stopColor="#7C3AED" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                    {/* Gradient clicks — teal */}
                    <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#0D9488" stopOpacity={0.25} />
                      <stop offset="60%"  stopColor="#0D9488" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 6"
                    stroke="#f1f5f9"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    interval={xAxisInterval}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    dy={4}
                  />

                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />

                  <Tooltip
                    content={<TrafficTooltip />}
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />

                  {/* Views — gelombang natural, di belakang */}
                  <Area
                    type="natural"
                    dataKey="views"
                    name="Kunjungan"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    fill="url(#gradViews)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#7C3AED',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />

                  {/* Clicks — gelombang natural, di depan */}
                  <Area
                    type="natural"
                    dataKey="clicks"
                    name="Klik Marketplace"
                    stroke="#0D9488"
                    strokeWidth={2}
                    fill="url(#gradClicks)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#0D9488',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Empty state overlay jika semua 0 */}
              {chartSlots.every(s => s.views === 0 && s.clicks === 0) && (
                <div className="flex flex-col items-center justify-center -mt-40 pb-8 text-gray-300 pointer-events-none">
                  <TrendingUp className="w-10 h-10 mb-2" />
                  <p className="text-sm font-semibold text-gray-400">Belum ada traffic di periode ini</p>
                  <p className="text-xs mt-1 text-gray-300">Data muncul saat pengunjung membuka toko</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Peta Indonesia */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-extrabold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-500" />Peta Traffic Indonesia
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Sebaran kunjungan & klik berdasarkan lokasi pengunjung</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span>{locations.length} kota aktif</span>
            </div>
          </div>
          <IndonesiaMap locations={locations} loading={loadingChart} />
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Top Kota berdasarkan Traffic</p>
            {loadingChart ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : <LocationTable locations={locations} />}
          </div>
        </div>

        {/* Top Gainers + Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />Top Gainers
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Produk paling banyak klik & dilihat</p>
              </div>
              <Link href="/admin/produk" className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                Semua <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {loadingChart ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : topGainers.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300">
                <Package className="w-10 h-10 mb-2" />
                <p className="text-sm font-semibold">Belum ada data produk</p>
              </div>
            ) : (
              <div>{topGainers.map((p, i) => <TopGainerRow key={p.product_id} rank={i + 1} product={p} />)}</div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-gray-800 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-violet-500" />Performa Kategori
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Kunjungan per kategori produk</p>
              </div>
              <Link href="/admin/kategori" className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                Kelola <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {loadingChart ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : categoryStats.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-300">
                <FolderOpen className="w-10 h-10 mb-2" /><p className="text-sm font-semibold">Belum ada data kategori</p>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-72 pr-1">
                {categoryStats.map(cat => <CategoryBarRow key={cat.category_id} cat={cat} maxViews={maxCategoryViews} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── Distribusi Klik Marketplace — multi-warna ──────── */}
        {!loadingChart && distribusiData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-extrabold text-gray-800">Distribusi Klik Marketplace</h3>
                <p className="text-xs text-gray-400 mt-0.5">Perbandingan kunjungan vs klik tiap produk (top 10)</p>
              </div>
              {/* Mini legend: Kunjungan vs Klik */}
              <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-200" />
                  <span>Kunjungan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-violet-500" />
                  <span>Klik</span>
                </div>
              </div>
            </div>

            {/* Custom legend per produk — warna masing-masing */}
            <DistribusiLegend products={distribusiLegendItems} />

            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={distribusiData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 24 }}
                  barCategoryGap="28%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                    height={36}
                  />

                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />

                  <Tooltip
                    content={<DistribusiTooltip />}
                    cursor={{ fill: '#f8fafc', radius: 4 }}
                  />

                  {/* Bar Kunjungan — warna muda per produk */}
                  <Bar dataKey="Kunjungan" name="Kunjungan" radius={[4, 4, 0, 0]}>
                    {distribusiData.map((entry) => (
                      <Cell
                        key={`visit-${entry.colorIndex}`}
                        fill={BAR_PALETTE[entry.colorIndex % BAR_PALETTE.length].visit}
                      />
                    ))}
                  </Bar>

                  {/* Bar Klik — warna solid per produk */}
                  <Bar dataKey="Klik" name="Klik" radius={[4, 4, 0, 0]}>
                    {distribusiData.map((entry) => (
                      <Cell
                        key={`click-${entry.colorIndex}`}
                        fill={BAR_PALETTE[entry.colorIndex % BAR_PALETTE.length].click}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Aksi cepat */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Aksi Cepat</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { href: '/admin/kategori', icon: Tag,    bg: 'bg-violet-100 group-hover:bg-violet-200', color: 'text-violet-600', label: 'Kelola Kategori', sub: 'Tambah, edit, hapus kategori' },
              { href: '/admin/produk',   icon: Package, bg: 'bg-teal-100 group-hover:bg-teal-200',    color: 'text-teal-600',   label: 'Kelola Produk',   sub: 'Tambah dan edit produk' },
              { href: '/admin/profile',  icon: Store,   bg: 'bg-amber-100 group-hover:bg-amber-200',  color: 'text-amber-600',  label: 'Profil Toko',     sub: 'Update nama, logo, warna' },
            ].map(({ href, icon: Icon, bg, color, label, sub }) => (
              <Link key={href} href={href}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}