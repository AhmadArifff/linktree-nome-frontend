'use client'

// ============================================================
// components/DynamicFavicon.tsx
// Update favicon browser secara dinamis dari logo toko
//
// CARA KERJA:
//   1. Fetch profil toko dari /api/store
//   2. Jika ada logo_url → set sebagai favicon via <link rel="icon">
//   3. Jika tidak ada logo → biarkan favicon default (dari /public/favicon.ico)
//
// KENAPA CLIENT COMPONENT:
//   Manipulasi DOM (document.querySelector) hanya bisa di browser,
//   bukan saat server-side rendering. Komponen ini dipanggil dari
//   layout.tsx dan dijalankan setelah hydration selesai.
//
// BROWSER SUPPORT:
//   Semua browser modern — Chrome, Firefox, Safari, Edge, Samsung Browser
//   Favicon format yang direkomendasikan: ICO, PNG, SVG
//   Supabase Storage menghasilkan URL gambar (JPG/PNG/WebP) → semua browser support
// ============================================================

import { useEffect } from 'react'

// Ambil BASE_URL dari env var (sama dengan lib/api.ts)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export default function DynamicFavicon() {
  useEffect(() => {
    async function updateFavicon() {
      try {
        // Fetch profil toko — tidak pakai axois agar komponen ini mandiri
        const res  = await fetch(`${API_BASE}/store`, { cache: 'no-store' })
        if (!res.ok) return

        const json = await res.json() as { success: boolean; data?: { logo_url?: string | null; name?: string } }
        if (!json.success || !json.data?.logo_url) return

        const logoUrl  = json.data.logo_url
        const siteName = json.data.name ?? 'ShopLink'

        // ── Update favicon ──────────────────────────────────
        setFaviconLink(logoUrl)

        // ── Update title ────────────────────────────────────
        // Juga update document.title agar konsisten dengan logo
        if (document.title === 'ShopLink — Etalase Digital Produk Anda') {
          document.title = `${siteName} — Etalase Digital`
        }
      } catch {
        // Silent fail — favicon default tetap tampil
      }
    }

    updateFavicon()
  }, [])

  // Komponen ini tidak render apapun ke DOM
  return null
}

// ── Helper: set atau buat elemen <link rel="icon"> ──────────
function setFaviconLink(url: string): void {
  // Tambahkan cache-buster agar browser tidak pakai favicon lama
  const faviconUrl = `${url}?v=${Date.now()}`

  // Cari <link rel="icon"> yang sudah ada
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!link) {
    // Buat baru jika belum ada
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  // Set tipe berdasarkan ekstensi file
  const ext = url.split('.').pop()?.toLowerCase() ?? 'png'
  link.type = ext === 'svg' ? 'image/svg+xml' : ext === 'ico' ? 'image/x-icon' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  link.href = faviconUrl

  // Juga update apple-touch-icon untuk iOS homescreen
  setAppleTouchIcon(url)

  // Update shortcut icon untuk IE legacy
  setShortcutIcon(faviconUrl)
}

function setAppleTouchIcon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'apple-touch-icon'
    document.head.appendChild(link)
  }
  link.href = url
}

function setShortcutIcon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'shortcut icon'
    document.head.appendChild(link)
  }
  link.href = url
}