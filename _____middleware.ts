// ============================================================
// middleware.ts
// Proteksi semua route /admin/* kecuali /admin/login
// Cek token di cookies (dikirim saat login via frontend)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lewati middleware untuk halaman login admin
  if (pathname === '/admin/login') return NextResponse.next()

  // Semua route /admin/* wajib punya token
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('shoplink_token')?.value

    if (!token) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
