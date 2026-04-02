'use client'

// ============================================================
// app/page.tsx
// Halaman utama publik — logo toko + grid kategori
//
// FIX ANALYTICS:
//   Saat user KLIK tombol kategori → trackCategoryView(cat.id)
//   dipanggil SEBELUM navigasi ke /kategori/[slug]
//   Ini mencatat 'category_view' event ke Supabase via backend
// ============================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { storeApi, categoriesApi, getCategoryColor, StoreProfile, Category } from '@/lib/api'
import { trackCategoryView } from '@/lib/analytics'

function CategorySkeleton() {
  return (
    <div className="animate-pulse flex flex-col items-center gap-3 p-6 rounded-2xl bg-gray-100 border border-gray-200">
      <div className="w-14 h-14 rounded-2xl bg-gray-200" />
      <div className="h-4 w-20 rounded bg-gray-200" />
    </div>
  )
}

export default function HomePage() {
  const [store, setStore]           = useState<StoreProfile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [storeData, catData] = await Promise.all([
          storeApi.get(),
          categoriesApi.getAll(),
        ])
        setStore(storeData)
        setCategories(catData)
      } catch {
        setError('Gagal memuat data toko. Coba refresh halaman.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const themeColor = store?.theme_color ?? '#7F77DD'

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #F0EEF8 100%)' }}>

      {/* ── Hero: Logo + Nama Toko ─────────────────────────── */}
      <section className="flex flex-col items-center justify-center pt-16 pb-10 px-4 animate-fade-in">
        <div
          className="w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center mb-5 shadow-lg overflow-hidden"
          style={{ background: themeColor }}
        >
          {store?.logo_url ? (
            <Image src={store.logo_url} alt={`Logo ${store.name}`} width={128} height={128} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl md:text-5xl select-none">🛍️</span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-800 text-center leading-tight">
          {loading
            ? <span className="inline-block w-48 h-10 rounded-xl bg-gray-200 animate-pulse" />
            : store?.name ?? 'ShopLink Store'
          }
        </h1>

        {store?.description && (
          <p className="mt-3 text-base md:text-lg text-gray-500 text-center max-w-md leading-relaxed">
            {store.description}
          </p>
        )}

        <div className="mt-6 flex items-center gap-2">
          <div className="h-1 w-8 rounded-full" style={{ background: themeColor, opacity: 0.4 }} />
          <div className="h-1 w-16 rounded-full" style={{ background: themeColor }} />
          <div className="h-1 w-8 rounded-full" style={{ background: themeColor, opacity: 0.4 }} />
        </div>
      </section>

      {/* ── Grid Kategori ──────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center mb-6">
          Pilih Kategori
        </h2>

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 font-semibold">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 btn-outline">
              Coba Lagi
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)}
          </div>
        )}

        {!loading && !error && categories.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-gray-500 font-semibold">Belum ada kategori produk tersedia.</p>
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat, index) => {
              const color = getCategoryColor(index)
              return (
                <Link
                  key={cat.id}
                  href={`/kategori/${cat.slug}`}
                  // ── FIX: panggil trackCategoryView saat klik ──────
                  // onClick dieksekusi SEBELUM navigasi terjadi
                  // trackCategoryView adalah fire-and-forget (async tanpa await)
                  onClick={() => trackCategoryView(cat.id)}
                  className={`
                    group flex flex-col items-center gap-3 p-5 md:p-6
                    rounded-2xl border-2 ${color.bg} ${color.border}
                    hover:shadow-md hover:-translate-y-1
                    active:scale-95 transition-all duration-200
                    animate-slide-up cursor-pointer
                  `}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-200">
                    {cat.icon ?? '📦'}
                  </div>
                  <span className={`text-sm md:text-base font-bold ${color.text} text-center leading-tight`}>
                    {cat.name}
                  </span>
                  <span className={`text-xs ${color.text} opacity-60 group-hover:opacity-100 transition-opacity`}>
                    Lihat produk →
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <footer className="text-center py-6 text-xs text-gray-400">
        © {new Date().getFullYear()} {store?.name ?? 'ShopLink'} · Dibuat dengan ❤️
      </footer>
    </main>
  )
}
