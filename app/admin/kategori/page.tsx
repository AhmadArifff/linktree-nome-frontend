'use client'

// ============================================================
// app/admin/kategori/page.tsx
// Admin: manage kategori — list, tambah, edit, hapus, toggle aktif
// Satu file lengkap dengan modal form inline
// ============================================================

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, X, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react'
import { AdminLayout } from '../dashboard/page'
import { categoriesApi, getErrorMessage, Category } from '@/lib/api'

// ── Schema validasi form ─────────────────────────────────────
const CategorySchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  icon: z.string().max(10).optional(),
})
type CategoryForm = z.infer<typeof CategorySchema>

// ── Pilihan icon kategori ─────────────────────────────────────
const ICON_OPTIONS = ['👕','👗','👔','🧥','🧤','👟','👠','👜','🎒','⌚','💍','🕶️',
  '🏸','🎾','⚽','🏀','🎿','🏋️','🚴','🧘','📱','💻','🎮','📷','🎵','🍕','☕','🌸']

// ── Modal Form Kategori ───────────────────────────────────────
function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Category
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState(initial?.icon ?? '📦')

  const { register, handleSubmit, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(CategorySchema),
    defaultValues: { name: initial?.name ?? '', icon: initial?.icon ?? '' },
  })

  async function onSubmit(values: CategoryForm) {
    setSaving(true)
    try {
      const payload = { ...values, icon: selectedIcon }
      if (isEdit && initial) {
        await categoriesApi.update(initial.id, payload)
        toast.success('Kategori berhasil diperbarui')
      } else {
        await categoriesApi.create({
          name: values.name as string,  // cast eksplisit: zodResolver sudah validasi .min(1)
          icon: selectedIcon,
        })
        toast.success('Kategori berhasil dibuat')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-extrabold text-gray-800">{isEdit ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Pilih icon */}
          <div>
            <label className="label">Icon Kategori</label>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-4xl">{selectedIcon}</span>
              <span className="text-sm text-gray-500">Icon terpilih</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    selectedIcon === icon
                      ? 'bg-violet-100 ring-2 ring-violet-500 scale-110'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Nama kategori */}
          <div>
            <label className="label">Nama Kategori</label>
            <input
              {...register('name')}
              placeholder="Contoh: Pakaian, Aksesoris, Raket..."
              className={`input ${errors.name ? 'input-error' : ''}`}
              disabled={saving}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
          </div>

          {/* Tombol */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1" disabled={saving}>Batal</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Kategori'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Halaman Manage Kategori ───────────────────────────────────
export default function ManageKategoriPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | Category | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  async function loadCategories() {
    try {
      const data = await categoriesApi.getAllAdmin()
      setCategories(data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCategories() }, [])

  async function handleDelete(cat: Category) {
    if (!confirm(`Hapus kategori "${cat.name}"? Semua produknya akan ikut terhapus!`)) return
    setDeletingId(cat.id)
    try {
      await categoriesApi.delete(cat.id)
      toast.success(`Kategori "${cat.name}" dihapus`)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(cat: Category) {
    setTogglingId(cat.id)
    try {
      await categoriesApi.update(cat.id, { is_active: !cat.is_active })
      setCategories((prev) =>
        prev.map((c) => c.id === cat.id ? { ...c, is_active: !c.is_active } : c)
      )
      toast.success(`Kategori ${!cat.is_active ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleReorder() {
    setReordering(true)
    try {
      const items = categories.map((cat, index) => ({ id: cat.id, sort_order: index + 1 }))
      await categoriesApi.reorder(items)
      setCategories((prev) => prev.map((cat, index) => ({ ...cat, sort_order: index + 1 })))
      toast.success('Urutan kategori berhasil disimpan')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setReordering(false)
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newCategories = [...categories]
    const draggedItem = newCategories[draggedIndex]
    newCategories.splice(draggedIndex, 1)
    newCategories.splice(index, 0, draggedItem)
    setCategories(newCategories)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
    handleReorder()
  }

  return (
    <AdminLayout title="Kelola Kategori">
      {/* Modal form */}
      {modal !== null && (
        <CategoryModal
          initial={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={loadCategories}
        />
      )}

      <div className="space-y-5 animate-fade-in">
        {/* Header + tombol tambah */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{categories.length} kategori terdaftar</p>
          </div>
          <button onClick={() => setModal('create')} className="btn-primary">
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && categories.length === 0 && (
          <div className="text-center py-16 card">
            <p className="text-5xl mb-3">📂</p>
            <p className="text-gray-500 font-semibold mb-4">Belum ada kategori</p>
            <button onClick={() => setModal('create')} className="btn-primary">
              <Plus className="w-4 h-4" />
              Buat Kategori Pertama
            </button>
          </div>
        )}

        {/* List kategori */}
        {!loading && categories.length > 0 && (
          <div className="space-y-3">
            {categories.map((cat, i) => (
              <div
                key={cat.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`card p-4 flex items-center gap-4 transition-opacity cursor-move ${
                  cat.is_active === false ? 'opacity-50' : ''
                } ${draggedIndex === i ? 'opacity-50' : ''}`}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-2xl flex-shrink-0">
                  {cat.icon ?? '📦'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{cat.name}</p>
                  <p className="text-xs text-gray-400">/{cat.slug}</p>
                </div>

                {/* Badge aktif */}
                <span className={`badge flex-shrink-0 ${
                  cat.is_active !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {cat.is_active !== false ? 'Aktif' : 'Nonaktif'}
                </span>

                {/* Aksi */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle aktif */}
                  <button
                    onClick={() => handleToggleActive(cat)}
                    disabled={togglingId === cat.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                    title={cat.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {cat.is_active !== false
                      ? <ToggleRight className="w-5 h-5 text-green-500" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setModal(cat)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Hapus */}
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={deletingId === cat.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
