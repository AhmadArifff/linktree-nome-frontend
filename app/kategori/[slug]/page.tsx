'use client'

// ============================================================
// app/kategori/[slug]/page.tsx
// Halaman produk per kategori + modal detail
//
// FIX ANALYTICS — dua event yang sekarang di-track:
//
//   1. category_view — dipanggil saat halaman selesai load data
//      (useEffect setelah category data berhasil di-fetch)
//      Mencatat bahwa user membuka halaman kategori ini
//
//   2. product_click — dipanggil saat user KLIK produk:
//      a) klik card produk (gambar/area card) → redirect marketplace
//      b) klik tombol "Beli Sekarang" di modal → redirect marketplace
//      Keduanya melewati handleProductClick() yang track dulu, lalu buka link
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, X, ExternalLink, ShoppingBag, Search, ChevronRight } from 'lucide-react'
import { categoriesApi, getCategoryColor, Category, Product } from '@/lib/api'
import { trackCategoryView, trackProductClick } from '@/lib/analytics'

// ── Modal Detail Produk ──────────────────────────────────────
function ProductModal({
  product,
  onClose,
  onBuy,           // callback saat user klik beli → tracking dihandle parent
}: {
  product: Product
  onClose: () => void
  onBuy: (product: Product) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm flex items-center justify-between px-5 py-4 border-b border-gray-100 rounded-t-3xl z-10">
          <h3 className="font-bold text-gray-800 text-base line-clamp-1 pr-4">{product.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-5 md:p-6">
          {/* Gambar */}
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 mb-5">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} width={600} height={450} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-16 h-16 text-gray-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold text-gray-800 leading-snug">{product.name}</h2>
            {product.price && (
              <p className="text-2xl font-extrabold text-violet-600">
                Rp {product.price.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </p>
            )}
            {product.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            )}
          </div>

          {/* CTA — FIX: onBuy dipanggil agar tracking product_click terjadi */}
          <button
            onClick={() => onBuy(product)}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl
                       bg-violet-600 text-white font-bold text-base
                       hover:bg-violet-700 active:scale-95 transition-all duration-150"
          >
            <ShoppingBag className="w-5 h-5" />
            Beli Sekarang di Marketplace
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card Produk ──────────────────────────────────────────────
function ProductCard({
  product,
  onDetail,
  onBuy,            // FIX: pakai onBuy agar tracking jalan
  colorClass,
}: {
  product: Product
  onDetail: () => void
  onBuy: (product: Product) => void
  colorClass: ReturnType<typeof getCategoryColor>
}) {
  return (
    <div className="group card overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-200 animate-slide-up">
      {/* Gambar — FIX: onClick pakai onBuy (track + buka marketplace) */}
      <div
        onClick={() => onBuy(product)}
        className="block aspect-[4/3] bg-gray-100 overflow-hidden cursor-pointer"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={400}
            height={300}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">{product.name}</h3>
        {product.price && (
          <p className="text-base font-extrabold text-violet-600">
            Rp {product.price.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </p>
        )}
        {product.short_description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{product.short_description}</p>
        )}

        <div className="flex gap-2 pt-1">
          {/* Tombol Lihat Detail → modal (tidak track, hanya buka modal) */}
          <button
            onClick={onDetail}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${colorClass.border} ${colorClass.text} ${colorClass.bg} hover:opacity-80 transition-opacity`}
          >
            Lihat Detail
          </button>

          {/* Tombol beli → FIX: pakai onBuy agar tracking product_click jalan */}
          <button
            onClick={() => onBuy(product)}
            className="flex items-center justify-center w-9 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-9 bg-gray-200 rounded-xl mt-2" />
      </div>
    </div>
  )
}

// ── Halaman Utama ─────────────────────────────────────────────
export default function KategoriPage() {
  const params  = useParams()
  const router  = useRouter()
  const slug    = params?.slug as string

  const [category, setCategory]         = useState<(Category & { products: Product[] }) | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [colorIndex, setColorIndex]     = useState(0)

  // Ref untuk pastikan category_view hanya dikirim sekali per load
  const viewTracked = useRef(false)

  useEffect(() => {
    if (!slug) return
    viewTracked.current = false   // reset saat slug berubah

    async function load() {
      try {
        const data = await categoriesApi.getBySlug(slug)
        setCategory(data)

        // ── FIX: track category_view setelah data berhasil dimuat ──
        // Pakai ref agar tidak double-fire meski useEffect re-run (StrictMode)
        if (!viewTracked.current) {
          viewTracked.current = true
          trackCategoryView(data.id)
        }

        const saved = localStorage.getItem(`cat_color_${slug}`)
        if (saved) setColorIndex(Number(saved))
      } catch {
        setError('Kategori tidak ditemukan atau terjadi kesalahan.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // ── FIX: handleProductClick — track + buka marketplace ──────
  // Dipanggil dari: klik card, klik ikon external link, klik "Beli Sekarang" di modal
  const handleProductClick = useCallback((product: Product) => {
    // Track dulu (fire-and-forget)
    trackProductClick(product.id, product.category_id ?? category?.id)
    // Buka marketplace di tab baru
    window.open(product.marketplace_url, '_blank', 'noopener,noreferrer')
  }, [category?.id])

  const closeModal  = useCallback(() => setSelectedProduct(null), [])
  const color       = getCategoryColor(colorIndex)

  const filteredProducts = category?.products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.short_description?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  if (!loading && error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-5xl">😕</p>
        <p className="text-gray-600 font-semibold text-center">{error}</p>
        <button onClick={() => router.push('/')} className="btn-primary">Kembali ke Beranda</button>
      </div>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FAFAF8 0%, #F0EEF8 100%)' }}>

      {/* Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={closeModal}
          onBuy={(p) => {
            closeModal()
            handleProductClick(p)
          }}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <nav className="flex items-center gap-1 text-sm min-w-0">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">Beranda</Link>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            <span className={`font-bold ${color.text} truncate`}>
              {loading ? '...' : category?.name ?? slug}
            </span>
          </nav>
          {category?.icon && <span className="ml-auto text-xl flex-shrink-0">{category.icon}</span>}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Judul + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            {loading
              ? <div className="h-8 w-40 bg-gray-200 rounded-xl animate-pulse" />
              : <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800">{category?.icon} {category?.name}</h1>
            }
            {!loading && <p className="text-sm text-gray-400 mt-0.5">{filteredProducts.length} produk tersedia</p>}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">{search ? '🔍' : '📦'}</p>
            <p className="text-gray-500 font-semibold">
              {search ? `Produk "${search}" tidak ditemukan` : 'Belum ada produk di kategori ini'}
            </p>
            {search && <button onClick={() => setSearch('')} className="mt-3 btn-ghost text-sm">Hapus pencarian</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                colorClass={color}
                onDetail={() => setSelectedProduct(product)}
                onBuy={handleProductClick}   // ← FIX: teruskan handleProductClick
              />
            ))}
          </div>
        )}
      </div>

      <footer className="text-center py-8 text-xs text-gray-400">
        © {new Date().getFullYear()} ShopLink · Semua hak dilindungi
      </footer>
    </main>
  )
}
