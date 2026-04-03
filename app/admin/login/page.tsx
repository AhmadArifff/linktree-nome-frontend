'use client'

// ============================================================
// app/admin/login/page.tsx
//
// FIX: useSearchParams() wajib dibungkus <Suspense> di Next.js 13+
//
// ROOT CAUSE:
//   Next.js App Router melakukan static prerender untuk semua halaman.
//   useSearchParams() membaca URL query string yang hanya tersedia
//   di client-side (runtime), bukan saat static generation.
//   Tanpa Suspense, Next.js tidak bisa prerender → build gagal.
//
// SOLUSI:
//   Pisahkan komponen yang memakai useSearchParams() ke komponen
//   terpisah (LoginForm), lalu bungkus dengan <Suspense fallback={...}>
//   di komponen page utama (AdminLoginPage).
//
// PATTERN STANDAR NEXT.JS:
//   export default function Page() {
//     return (
//       <Suspense fallback={<Loading />}>
//         <ComponentThatUsesSearchParams />
//       </Suspense>
//     )
//   }
// ============================================================

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ShoppingBag, LogIn } from 'lucide-react'
import { authApi, saveToken, getErrorMessage } from '@/lib/api'

const LoginSchema = z.object({
  email:    z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password tidak boleh kosong'),
})
type LoginForm = z.infer<typeof LoginSchema>

// ── FIX: Komponen terpisah yang pakai useSearchParams ─────────
// Harus dipisah agar bisa dibungkus Suspense dari parent
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()                         // ← dipindah ke sini
  const redirectTo   = searchParams.get('redirect') ?? '/admin/dashboard'

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  })

  async function onSubmit(values: LoginForm) {
    setLoading(true)
    try {
      const { token } = await authApi.login(values.email, values.password)
      saveToken(token)
      document.cookie = `shoplink_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
      toast.success('Login berhasil! Selamat datang.')
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6 md:p-8 shadow-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Email */}
        <div>
          <label className="label">Email Admin</label>
          <input
            {...register('email')}
            type="email"
            placeholder="admin@toko.com"
            className={`input ${errors.email ? 'input-error' : ''}`}
            autoComplete="email"
            disabled={loading}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="Masukkan password"
              className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500 font-medium">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
              </svg>
              Masuk...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Masuk
            </span>
          )}
        </button>
      </form>
    </div>
  )
}

// ── Skeleton saat Suspense loading ────────────────────────────
function LoginSkeleton() {
  return (
    <div className="card p-6 md:p-8 shadow-lg animate-pulse space-y-5">
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-12 bg-gray-200 rounded-xl" />
    </div>
  )
}

// ── Page utama — bungkus LoginForm dengan Suspense ────────────
export default function AdminLoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #EEEDFE 0%, #E1F5EE 50%, #FAEEDA 100%)' }}
    >
      <div className="w-full max-w-md animate-scale-in">

        {/* Logo + judul */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800">ShopLink Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk untuk mengelola toko Anda</p>
        </div>

        {/* FIX: Bungkus LoginForm (yang pakai useSearchParams) dengan Suspense */}
        <Suspense fallback={<LoginSkeleton />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} ShopLink · Admin Panel
        </p>
      </div>
    </main>
  )
}