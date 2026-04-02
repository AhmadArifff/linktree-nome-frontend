// ============================================================
// middleware.ts
// Proteksi semua route /admin/* kecuali /admin/login
// Cek token di cookies (dikirim saat login via frontend)
// ============================================================

// proxy.ts
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Normalize path (hilangkan trailing slash)
  const cleanPath = pathname.replace(/\/$/, '')

  // Lewati untuk login admin
  if (cleanPath === '/admin/login') {
    return NextResponse.next()
  }

  // Proteksi semua /admin/*
  if (cleanPath.startsWith('/admin')) {
    const token = request.cookies.get('shoplink_token')?.value

    // Validasi token basic
    if (!token || token.length < 10) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)

      return NextResponse.redirect(loginUrl)
    }

    // (Optional) Decode JWT kalau pakai JWT
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      )

      // Cek expiry
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        const loginUrl = new URL('/admin/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)

        return NextResponse.redirect(loginUrl)
      }
    } catch (err) {
      // Token rusak
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
