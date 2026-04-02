'use client'

// ============================================================
// app/admin/profile/page.tsx
// Admin: manage profil toko
// Edit nama toko, deskripsi, logo (upload), warna tema
// ============================================================

import { useEffect, useState, useRef, ChangeEvent } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, ImageIcon, ExternalLink } from 'lucide-react'
import { AdminLayout } from '../dashboard/page'
import { storeApi, getErrorMessage, StoreProfile } from '@/lib/api'

// ── Schema validasi ──────────────────────────────────────────
const ProfileSchema = z.object({
  name: z.string().min(1, 'Nama toko wajib diisi').max(100),
  description: z.string().max(500).optional(),
  theme_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Format hex tidak valid, contoh: #7F77DD'),
})
type ProfileForm = z.infer<typeof ProfileSchema>

// Pilihan warna tema preset
const COLOR_PRESETS = [
  '#7F77DD', '#1D9E75', '#D85A30', '#D4537E',
  '#378ADD', '#EF9F27', '#639922', '#888780',
]

// ── Halaman Profil Toko ───────────────────────────────────────
export default function AdminProfilePage() {
  const [store, setStore] = useState<StoreProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [themeColor, setThemeColor] = useState('#7F77DD')
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: '', description: '', theme_color: '#7F77DD' },
  })

  // Load data toko
  useEffect(() => {
    storeApi.get()
      .then((data) => {
        setStore(data)
        setLogoPreview(data.logo_url)
        setThemeColor(data.theme_color)
        reset({
          name: data.name,
          description: data.description ?? '',
          theme_color: data.theme_color,
        })
      })
      .catch(() => toast.error('Gagal memuat profil toko'))
      .finally(() => setLoading(false))
  }, [reset])

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo maksimal 2MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleColorPreset(color: string) {
    setThemeColor(color)
    setValue('theme_color', color)
  }

  async function onSubmit(values: ProfileForm) {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', values.name)
      if (values.description) fd.append('description', values.description)
      fd.append('theme_color', themeColor)
      if (logoFile) fd.append('logo', logoFile)

      const updated = await storeApi.update(fd)
      setStore(updated)
      toast.success('Profil toko berhasil disimpan!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Profil Toko">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="card p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-24 w-24 bg-gray-200 rounded-2xl" />
            <div className="h-10 bg-gray-200 rounded-xl" />
            <div className="h-10 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Profil Toko">
      <div className="max-w-2xl animate-fade-in">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Preview tampilan publik ─────────────────────── */}
          <div className="card p-5 flex items-center gap-4" style={{ borderLeft: `4px solid ${themeColor}` }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
              style={{ background: themeColor }}
            >
              {logoPreview ? (
                <Image src={logoPreview} alt="Logo preview" width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">🛍️</span>
              )}
            </div>
            <div>
              <p className="font-extrabold text-gray-800 text-lg">{watch('name') || 'Nama Toko'}</p>
              <p className="text-sm text-gray-400 line-clamp-1">{watch('description') || 'Deskripsi toko Anda'}</p>
              <a href="/" target="_blank" rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-1">
                <ExternalLink className="w-3 h-3" />
                Lihat tampilan publik
              </a>
            </div>
          </div>

          {/* ── Upload Logo ─────────────────────────────────── */}
          <div className="card p-6 space-y-4">
            <h3 className="font-extrabold text-gray-800">Logo Toko</h3>
            <div className="flex items-end gap-4">
              <div
                className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-violet-400 transition-colors flex items-center justify-center"
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? (
                  <Image src={logoPreview} alt="Logo" width={96} height={96} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-outline text-sm"
                  disabled={saving}
                >
                  {logoPreview ? 'Ganti Logo' : 'Upload Logo'}
                </button>
                <p className="text-xs text-gray-400">PNG, JPG, WebP — maks 2MB</p>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => { setLogoPreview(null); setLogoFile(null) }}
                    className="text-xs text-red-500 hover:underline block"
                  >
                    Hapus logo
                  </button>
                )}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoChange} />
          </div>

          {/* ── Info Toko ───────────────────────────────────── */}
          <div className="card p-6 space-y-4">
            <h3 className="font-extrabold text-gray-800">Informasi Toko</h3>

            {/* Nama */}
            <div>
              <label className="label">Nama Toko <span className="text-red-500">*</span></label>
              <input
                {...register('name')}
                placeholder="Nama toko Anda"
                className={`input ${errors.name ? 'input-error' : ''}`}
                disabled={saving}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
            </div>

            {/* Deskripsi */}
            <div>
              <label className="label">Deskripsi Toko</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Ceritakan tentang toko Anda..."
                className="input resize-none"
                disabled={saving}
              />
            </div>
          </div>

          {/* ── Warna Tema ──────────────────────────────────── */}
          <div className="card p-6 space-y-4">
            <h3 className="font-extrabold text-gray-800">Warna Tema</h3>

            {/* Preset warna */}
            <div>
              <p className="text-sm text-gray-500 mb-3">Pilih warna preset:</p>
              <div className="flex flex-wrap gap-3">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorPreset(color)}
                    className={`w-10 h-10 rounded-xl transition-all ${
                      themeColor === color ? 'ring-4 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Custom color */}
            <div>
              <label className="label">Atau masukkan kode hex</label>
              <div className="flex items-center gap-3">
                <input
                  {...register('theme_color')}
                  placeholder="#7F77DD"
                  className={`input w-40 font-mono ${errors.theme_color ? 'input-error' : ''}`}
                  disabled={saving}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9A-Fa-f]{6}$/.test(val)) setThemeColor(val)
                  }}
                />
                <div
                  className="w-10 h-10 rounded-xl border border-gray-200 flex-shrink-0"
                  style={{ background: themeColor }}
                />
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => handleColorPreset(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200"
                  title="Pilih warna dari color picker"
                />
              </div>
              {errors.theme_color && <p className="mt-1 text-xs text-red-500 font-medium">{errors.theme_color.message}</p>}
            </div>
          </div>

          {/* ── Tombol Simpan ───────────────────────────────── */}
          <button type="submit" className="btn-primary w-full py-3 text-base" disabled={saving}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                </svg>
                Menyimpan...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                Simpan Profil Toko
              </span>
            )}
          </button>
        </form>
      </div>
    </AdminLayout>
  )
}
