// ============================================================
// app/layout.tsx
// Root layout — Server Component (TANPA 'use client')
//
// PERUBAHAN DARI VERSI LAMA:
//   Versi lama pakai 'use client' → tidak bisa pakai generateMetadata
//   Sekarang:
//   - layout.tsx = Server Component → generateMetadata bisa fetch logo
//   - DynamicFavicon = Client Component → update favicon realtime di browser
//   - Toaster dipindah ke ClientProviders (client component terpisah)
//
// CARA KERJA FAVICON DARI LOGO:
//   1. generateMetadata: fetch /api/store saat build/request
//      → set metadata.icons dengan logo_url (untuk prerender & SEO)
//   2. DynamicFavicon: setelah page load di browser
//      → fetch /api/store lagi → update <link rel="icon"> via DOM
//      → ini handle kasus logo ganti tanpa rebuild
// ============================================================

import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import DynamicFavicon from '@/components/DynamicFavicon'
import './globals.css'

// Ambil URL backend untuk fetch metadata
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3001/api'

// ── generateMetadata: fetch logo untuk favicon saat build ────
// Ini dijalankan di server — hasilnya di-cache oleh Next.js
export async function generateMetadata(): Promise<Metadata> {
  let logoUrl: string | null = null
  let siteName = 'Nome — West Court Padel'

  try {
    const res = await fetch(`${API_BASE}/store`, {
      // Revalidate setiap 1 jam — tidak terlalu sering fetch
      next: { revalidate: 3600 },
    })

    if (res.ok) {
      const json = await res.json() as {
        success: boolean
        data?: { logo_url?: string | null; name?: string }
      }
      if (json.success && json.data) {
        logoUrl  = json.data.logo_url ?? null
        siteName = json.data.name ?? 'Nome — West Court Padel'
      }
    }
  } catch {
    // Gagal fetch → pakai default
  }

  // Base metadata
  const metadata: Metadata = {
    title: {
      default:  `${siteName} — Etalase Digital Produk Anda`,
      template: `%s | ${siteName}`,
    },
    description: 'Temukan produk pilihan terbaik dan belanja langsung di marketplace favorit Anda.',
    // PWA meta
    applicationName: siteName,
    // Favicon — gunakan logo toko jika ada, fallback ke default
    icons: logoUrl
      ? {
          icon:        [{ url: logoUrl, type: 'image/png' }],
          shortcut:    logoUrl,
          apple:       logoUrl,   // iOS homescreen icon
        }
      : {
          // Favicon default (pastikan file ini ada di /public/)
          icon:     '/favicon.ico',
          shortcut: '/favicon.ico',
          apple:    '/apple-touch-icon.png',
        },
  }

  return metadata
}

// ── Root Layout ───────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/*
          Viewport dan theme-color untuk mobile
          (tidak bisa di generateMetadata untuk beberapa kasus)
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#7F77DD" />
        {/* PWA support */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        {children}

        {/*
          DynamicFavicon: Client Component yang update favicon
          setelah page load — handle logo yang diupdate tanpa rebuild.
          Dirender setelah hydration, tidak block rendering.
        */}
        <DynamicFavicon />

        {/*
          Toaster: Client Component untuk notifikasi toast.
          Tetap di sini karena tidak butuh data apapun.
        */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              fontFamily:   'Nunito, sans-serif',
              fontSize:     '14px',
              fontWeight:   '600',
            },
          }}
        />
      </body>
    </html>
  )
}
