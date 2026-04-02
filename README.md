# ShopLink Frontend — Next.js 14

Frontend aplikasi ShopLink. Dibangun dengan Next.js 14 App Router + TypeScript + Tailwind CSS v3.

---

## Struktur File

```
frontend/
├── app/
│   ├── layout.tsx                      ← Root layout + Toaster
│   ├── globals.css                     ← Global styles + custom classes
│   ├── page.tsx                        ← Halaman utama publik (logo + kategori)
│   ├── kategori/
│   │   └── [slug]/page.tsx             ← Halaman produk per kategori + modal
│   └── admin/
│       ├── login/page.tsx              ← Halaman login admin
│       ├── dashboard/page.tsx          ← Dashboard + AdminLayout (reusable)
│       ├── kategori/page.tsx           ← Manage kategori
│       ├── produk/page.tsx             ← Manage produk
│       └── profile/page.tsx           ← Profil toko
├── lib/
│   └── api.ts                          ← Axios + semua fungsi API + types
├── middleware.ts                        ← Proteksi route /admin/*
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
└── .env.local.example
```

---

## Setup Lokal

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Setup environment variables

```bash
cp .env.local.example .env.local
```

Isi `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### 3. Jalankan development server

```bash
npm run dev
```

Buka: `http://localhost:3000`

> Pastikan backend sudah berjalan di `http://localhost:3001` terlebih dahulu.

---

## Halaman & Fitur

### Publik

| Route | Halaman | Fitur |
|-------|---------|-------|
| `/` | Beranda | Logo toko, nama, deskripsi, grid kategori berwarna |
| `/kategori/[slug]` | Produk | Grid card produk, search, modal detail, redirect marketplace |

### Admin

| Route | Halaman | Fitur |
|-------|---------|-------|
| `/admin/login` | Login | Form auth dengan validasi Zod |
| `/admin/dashboard` | Dashboard | Statistik, aksi cepat, sidebar navigasi |
| `/admin/kategori` | Kategori | List, tambah, edit, hapus, toggle aktif |
| `/admin/produk` | Produk | List + filter, tambah, edit, hapus, upload gambar |
| `/admin/profile` | Profil Toko | Nama, deskripsi, logo, warna tema + color picker |

---

## Catatan Teknis

- `AdminLayout` di-export dari `dashboard/page.tsx` dan dipakai semua halaman admin
- Token JWT disimpan di `localStorage` (untuk API call) dan `cookie` (untuk middleware Next.js)
- Middleware Next.js otomatis redirect ke `/admin/login` jika cookie tidak ada
- Upload gambar menggunakan `multipart/form-data` via FormData
- Semua halaman menggunakan Tailwind CSS v3 murni tanpa custom CSS
- Animasi: `animate-fade-in`, `animate-slide-up`, `animate-scale-in` dari `tailwind.config.ts`

---

## Deploy ke Vercel

```bash
cd frontend
vercel --prod
```

Set environment variables di Vercel Dashboard:

```
NEXT_PUBLIC_API_URL=https://shoplink-backend.vercel.app/api
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
# linktree-nome-frontend
