'use client'

// ============================================================
// app/admin/produk/page.tsx
//
// BUG FIXES:
//   1. Tambah ProductSchema & ProductForm definition (sebelumnya missing → crash)
//   2. loadData pakai categoriesApi.getAll() sebagai fallback untuk dropdown
//   3. Filter kategori: bandingkan category_id UUID (bukan slug)
//   4. handleToggleActive: pakai productsApi.updatePartial → PATCH
//   5. handleDelete: error handling lebih detail
//   6. Harga: format separator koma (50,000) realtime saat input
//   7. Saat edit produk: isi kembali formattedPrice dari data existing
// ============================================================

import { useEffect, useState, useRef, ChangeEvent } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Pencil, Trash2, X, Search, ShoppingBag,
  ExternalLink, ImageIcon, ToggleLeft, ToggleRight
} from 'lucide-react'
import { AdminLayout } from '../dashboard/page'
import { categoriesApi, productsApi, getErrorMessage, Category, Product } from '@/lib/api'

// ── FIX 1: Schema & Type yang sebelumnya HILANG dari file ini ─
const ProductSchema = z.object({
  category_id: z.string().min(1, 'Pilih kategori terlebih dahulu'),
  name: z.string().min(1, 'Nama produk wajib diisi').max(200),
  short_description: z.string().max(300).optional(),
  description: z.string().optional(),
  // price disimpan sebagai string numerik tanpa koma
  price: z.string().max(50).optional(),
  marketplace_url: z.string().url('URL marketplace tidak valid — pastikan diawali https://'),
  is_active: z.boolean().optional(),
})
type ProductForm = z.infer<typeof ProductSchema>

// ── FIX 6: Helper format harga ────────────────────────────────
// Mengubah "50000" → "50,000" (tampilan) dan "50,000" → "50000" (nilai kirim)
function toDisplayPrice(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function toRawPrice(display: string): string {
  return display.replace(/,/g, '')
}

// ── Modal Form Produk ─────────────────────────────────────────
function ProductModal({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial?: Product
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  // FIX 7: Isi formattedPrice dari data existing saat mode edit
  const [formattedPrice, setFormattedPrice] = useState(
    initial?.price ? toDisplayPrice(initial.price) : ''
  )
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      category_id: initial?.category_id ?? '',
      name: initial?.name ?? '',
      short_description: initial?.short_description ?? '',
      description: initial?.description ?? '',
      price: initial?.price ? toRawPrice(initial.price) : '',
      marketplace_url: initial?.marketplace_url ?? '',
      is_active: initial?.is_active ?? true,
    },
  })

  // FIX 6: Handler input harga dengan format separator koma realtime
  function handlePriceChange(e: ChangeEvent<HTMLInputElement>) {
    const display = toDisplayPrice(e.target.value)
    setFormattedPrice(display)
    setValue('price', toRawPrice(display))   // simpan nilai numerik ke form
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Gambar maksimal 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function onSubmit(values: ProductForm) {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('category_id', values.category_id)
      fd.append('name', values.name)
      fd.append('marketplace_url', values.marketplace_url)
      fd.append('is_active', String(values.is_active ?? true))
      if (values.short_description) fd.append('short_description', values.short_description)
      if (values.description) fd.append('description', values.description)
      // Kirim harga tanpa koma (nilai numerik bersih)
      if (values.price) fd.append('price', values.price)
      if (imageFile) fd.append('image', imageFile)

      if (isEdit && initial) {
        await productsApi.update(initial.id, fd)
        toast.success('Produk berhasil diperbarui')
      } else {
        await productsApi.create(fd)
        toast.success('Produk berhasil dibuat')
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('[ProductModal] submit error:', err)
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[95vh] flex flex-col shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-extrabold text-gray-800">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Form scrollable */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">

            {/* Upload Gambar */}
            <div>
              <label className="label">Gambar Produk</label>
              <div
                className="relative aspect-[4/3] w-full max-w-xs rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-violet-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? (
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-xs font-medium">Klik untuk upload gambar</span>
                    <span className="text-xs">JPG, PNG, WebP — maks 5MB</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              {imagePreview && (
                <button type="button" onClick={() => { setImagePreview(null); setImageFile(null) }} className="mt-2 text-xs text-red-500 hover:underline">
                  Hapus gambar
                </button>
              )}
            </div>

            {/* Kategori */}
            <div>
              <label className="label">Kategori <span className="text-red-500">*</span></label>
              <select {...register('category_id')} className={`input ${errors.category_id ? 'input-error' : ''}`} disabled={saving}>
                <option value="">-- Pilih Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              {errors.category_id && <p className="mt-1 text-xs text-red-500 font-medium">{errors.category_id.message}</p>}
            </div>

            {/* Nama */}
            <div>
              <label className="label">Nama Produk <span className="text-red-500">*</span></label>
              <input {...register('name')} placeholder="Nama produk..." className={`input ${errors.name ? 'input-error' : ''}`} disabled={saving} />
              {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
            </div>

            {/* FIX 6: Harga dengan separator koma realtime */}
            <div>
              <label className="label">Harga (opsional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formattedPrice}
                  onChange={handlePriceChange}
                  placeholder="50,000"
                  className="input pl-10"
                  disabled={saving}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Ketik angka saja, koma otomatis ditambahkan</p>
            </div>

            {/* Deskripsi singkat */}
            <div>
              <label className="label">Deskripsi Singkat</label>
              <textarea {...register('short_description')} rows={2} placeholder="Tampil di card produk (maks 300 karakter)..." className="input resize-none" disabled={saving} />
            </div>

            {/* Deskripsi lengkap */}
            <div>
              <label className="label">Deskripsi Lengkap</label>
              <textarea {...register('description')} rows={4} placeholder="Tampil di modal detail produk..." className="input resize-none" disabled={saving} />
            </div>

            {/* URL marketplace */}
            <div>
              <label className="label">Link Marketplace <span className="text-red-500">*</span></label>
              <input
                {...register('marketplace_url')}
                type="url"
                placeholder="https://shopee.co.id/produk-anda"
                className={`input ${errors.marketplace_url ? 'input-error' : ''}`}
                disabled={saving}
              />
              {errors.marketplace_url && <p className="mt-1 text-xs text-red-500 font-medium">{errors.marketplace_url.message}</p>}
            </div>

            {/* Status aktif */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input {...register('is_active')} type="checkbox" id="is_active" className="w-4 h-4 accent-violet-600" disabled={saving} defaultChecked={initial?.is_active ?? true} />
              <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 cursor-pointer">
                Produk aktif — tampil di halaman publik
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 pt-4 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Menyimpan...
                  </span>
                : isEdit ? 'Simpan Perubahan' : 'Buat Produk'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Halaman Manage Produk ─────────────────────────────────────
export default function ManageProdukPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')   // menyimpan category_id (UUID)
  const [modal, setModal] = useState<'create' | Product | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // FIX 2: Load semua produk real dari backend + semua kategori
  async function loadData() {
    try {
      const [prods, cats] = await Promise.all([
        productsApi.getAllAdmin(),    // GET /api/admin/products/all → data real Supabase
        categoriesApi.getAll(),       // GET /api/categories → untuk dropdown filter
      ])
      setProducts(prods)
      setCategories(cats)
    } catch (err) {
      console.error('[ManageProduk] loadData error:', err)
      toast.error('Gagal memuat data: ' + getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // FIX 4: Hapus produk dengan error handling yang jelas
  async function handleDelete(p: Product) {
    if (!confirm(`Hapus produk "${p.name}"?\nTindakan ini tidak bisa dibatalkan.`)) return
    setDeletingId(p.id)
    try {
      await productsApi.delete(p.id)
      toast.success(`Produk "${p.name}" berhasil dihapus`)
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err) {
      console.error('[ManageProduk] delete error:', err)
      toast.error('Gagal menghapus produk: ' + getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  // FIX 4: Toggle aktif via PATCH (bukan PUT/FormData)
  async function handleToggleActive(p: Product) {
    setTogglingId(p.id)
    const newStatus = !p.is_active
    // Optimistic update dulu agar UI responsif
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: newStatus } : x))
    try {
      await productsApi.updatePartial(p.id, { is_active: newStatus })
      toast.success(`Produk ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch (err) {
      // Rollback jika gagal
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: p.is_active } : x))
      console.error('[ManageProduk] toggle error:', err)
      toast.error('Gagal mengubah status: ' + getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  // FIX 3: Filter menggunakan category_id (UUID) agar cocok dengan data produk
  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.short_description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat ? p.category_id === filterCat : true
    return matchSearch && matchCat
  })

  return (
    <AdminLayout title="Kelola Produk">
      {modal !== null && (
        <ProductModal
          initial={modal === 'create' ? undefined : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={loadData}
        />
      )}

      <div className="space-y-5 animate-fade-in">

        {/* ── Toolbar ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full md:max-w-lg">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-sm"
              />
            </div>

            {/* FIX 3: Filter by category_id — nilai option adalah id bukan slug */}
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="input text-sm w-full sm:w-48"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <button onClick={() => setModal('create')} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>

        {/* Jumlah hasil */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {loading ? 'Memuat...' : `${filtered.length} dari ${products.length} produk`}
          </p>
          {filterCat && (
            <button onClick={() => setFilterCat('')} className="text-xs text-violet-600 hover:underline">
              Hapus filter
            </button>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 flex gap-4 animate-pulse">
                <div className="w-20 h-20 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 card">
            <p className="text-5xl mb-3">{search || filterCat ? '🔍' : '📦'}</p>
            <p className="text-gray-500 font-semibold mb-1">
              {search || filterCat ? 'Produk tidak ditemukan' : 'Belum ada produk'}
            </p>
            {(search || filterCat) && (
              <p className="text-sm text-gray-400 mb-4">
                {search && `Pencarian: "${search}"`}
                {search && filterCat && ' · '}
                {filterCat && `Kategori: ${categories.find(c => c.id === filterCat)?.name ?? filterCat}`}
              </p>
            )}
            {!search && !filterCat && (
              <button onClick={() => setModal('create')} className="btn-primary mt-4">
                <Plus className="w-4 h-4" /> Tambah Produk Pertama
              </button>
            )}
            {(search || filterCat) && (
              <button onClick={() => { setSearch(''); setFilterCat('') }} className="btn-ghost mt-2 text-sm">
                Hapus filter & pencarian
              </button>
            )}
          </div>
        )}

        {/* ── Grid Produk ─────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((p) => {
              // Cari info kategori dari state categories
              const cat = categories.find((c) => c.id === p.category_id)
              const isToggling = togglingId === p.id
              const isDeleting = deletingId === p.id

              return (
                <div
                  key={p.id}
                  className={`card p-4 flex gap-4 hover:shadow-md transition-all ${
                    !p.is_active ? 'opacity-60' : ''
                  } ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}
                >
                  {/* Gambar produk */}
                  <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info produk */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-snug">{p.name}</h3>

                      {/* Action buttons */}
                      <div className="flex gap-1 flex-shrink-0">
                        {/* Toggle aktif/nonaktif */}
                        <button
                          onClick={() => handleToggleActive(p)}
                          disabled={isToggling}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 disabled:opacity-50"
                          title={p.is_active ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                        >
                          {isToggling
                            ? <svg className="animate-spin w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                              </svg>
                            : p.is_active
                              ? <ToggleRight className="w-4 h-4 text-green-500" />
                              : <ToggleLeft className="w-4 h-4 text-gray-400" />
                          }
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setModal(p)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Edit produk"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Hapus */}
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Hapus produk"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Harga */}
                    {p.price && (
                      <p className="text-sm font-bold text-violet-600 mt-0.5">
                        Rp {toDisplayPrice(p.price)}
                      </p>
                    )}

                    {/* Badge kategori & status */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {cat ? (
                        <span className="badge bg-violet-100 text-violet-700 text-xs">
                          {cat.icon} {cat.name}
                        </span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-400 text-xs">Tanpa Kategori</span>
                      )}
                      <span className={`badge text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    {/* Link marketplace */}
                    <a
                      href={p.marketplace_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1 text-xs text-teal-600 hover:underline max-w-full"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{p.marketplace_url}</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
