// ============================================================
// lib/analytics.ts
// FULL MOBILE SUPPORT — Semua browser HP & desktop
//
// BROWSER YANG DIDUKUNG:
//   Android : Chrome, Samsung Browser, Firefox, Opera, Brave, Edge, UC Browser
//   iOS     : Safari, Chrome iOS, Firefox iOS, Edge iOS, Opera Mini
//   In-App  : Instagram, WhatsApp, Line, TikTok, Facebook (WebView)
//   Desktop : Chrome, Firefox, Safari, Edge, Opera
//
// STRATEGI GEOLOCATION (4 lapis):
//
//   LAPIS 1 — navigator.geolocation (GPS hardware/WiFi)
//     Akurasi : 10–100 meter
//     Butuh   : Izin user (popup "Allow Location")
//     Support : Semua browser modern mobile & desktop
//     SKIP jika: in-app browser (WebView Instagram/WA/dll) → GPS blocked di sana
//
//   LAPIS 2 — ipapi.co (IP-based)
//     Akurasi : 2–50 km (kota besar), 50–200 km (rural/wisata)
//     Butuh   : Tidak perlu izin
//     Dipakai : Jika GPS denied, timeout, in-app browser, atau HTTPS tidak ada
//
//   LAPIS 3 — Koordinat 0,0 (tanpa geo)
//     Dipakai : Jika semua layanan gagal
//     Event   : Tetap tercatat, hanya tanpa koordinat di peta
//
// CATATAN PENTING:
//   - HTTPS wajib untuk GPS di iOS Safari & production
//   - Di localhost HTTP tetap jalan (browser dev exception)
//   - Popup izin hanya muncul SEKALI, browser ingat pilihan user
//   - Hasil disimpan sessionStorage → tidak request ulang per event
// ============================================================

import { analyticsApi } from './api'

// ── Session ID ────────────────────────────────────────────────
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('sl_session')
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem('sl_session', sid)
  }
  return sid
}

// ── Tipe data geo ─────────────────────────────────────────────
export interface GeoData {
  city:      string
  region:    string
  country:   string
  latitude:  number
  longitude: number
  source:    'gps' | 'ip' | 'none'
}

// ── Deteksi in-app browser (WebView) ─────────────────────────
// Browser ini memblokir GPS secara default
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent ?? ''
  return (
    /Instagram/i.test(ua)    ||   // Instagram WebView
    /FBAN|FBAV/i.test(ua)    ||   // Facebook
    /WhatsApp/i.test(ua)     ||   // WhatsApp
    /Line\//i.test(ua)       ||   // Line
    /TikTok/i.test(ua)       ||   // TikTok
    /Snapchat/i.test(ua)     ||   // Snapchat
    /Twitter/i.test(ua)      ||   // Twitter
    /MicroMessenger/i.test(ua)    // WeChat
  )
}

// ── Deteksi apakah GPS kemungkinan bisa jalan ─────────────────
function isGPSLikelyAvailable(): boolean {
  if (typeof navigator === 'undefined') return false
  if (!('geolocation' in navigator)) return false   // browser tidak support
  if (isInAppBrowser()) return false                // in-app browser → blocked
  // iOS Safari butuh HTTPS (kecuali localhost)
  if (typeof window !== 'undefined') {
    const isHTTPS    = window.location.protocol === 'https:'
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (!isHTTPS && !isLocalhost) return false
  }
  return true
}

// ── Reverse geocode GPS → nama kota (Nominatim OSM, gratis) ───
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; region: string; country: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=id`,
      {
        headers: { 'User-Agent': 'ShopLink-Analytics/1.0' },
        signal:  AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) throw new Error('nominatim error')

    const d = await res.json() as {
      address?: {
        city?: string; town?: string; village?: string; hamlet?: string
        county?: string; suburb?: string; municipality?: string
        state?: string; province?: string; country_code?: string
      }
    }

    const a = d.address ?? {}
    // Prioritas nama lokasi dari yang paling spesifik
    const city   = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? a.suburb ?? 'Unknown'
    const region = a.state ?? a.province ?? 'Unknown'
    const country = (a.country_code ?? 'id').toUpperCase()
    return { city, region, country }
  } catch {
    return { city: 'Unknown', region: 'Unknown', country: 'ID' }
  }
}

// ── LAPIS 1: GPS browser ──────────────────────────────────────
function getBrowserGPS(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      {
        enableHighAccuracy: true,    // pakai GPS hardware (lebih akurat di HP)
        timeout:            12000,   // 12 detik — HP butuh lebih lama untuk GPS lock
        maximumAge:         300000,  // cache 5 menit — tidak request GPS berulang
      }
    )
  })
}

// ── LAPIS 2: IP-based geolocation ────────────────────────────
async function getIPGeo(): Promise<GeoData | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const d = await res.json() as {
      error?: boolean; city?: string; region?: string
      country_code?: string; latitude?: number; longitude?: number
    }
    if (d.error || !d.latitude || !d.longitude) return null

    return {
      city:      d.city         ?? 'Unknown',
      region:    d.region       ?? 'Unknown',
      country:   d.country_code ?? 'ID',
      latitude:  d.latitude,
      longitude: d.longitude,
      source:    'ip',
    }
  } catch {
    return null
  }
}

// ── Cache per session ─────────────────────────────────────────
let geoCache:   GeoData | null             = null
let geoPromise: Promise<GeoData> | null    = null

// ── Fungsi utama: ambil geo dengan fallback bertingkat ────────
async function getUserGeoLocation(): Promise<GeoData> {
  if (geoCache) return geoCache

  // Cek sessionStorage
  try {
    const stored = sessionStorage.getItem('sl_geo')
    if (stored) {
      const parsed = JSON.parse(stored) as GeoData
      geoCache = parsed
      return parsed
    }
  } catch { /* korup, fetch ulang */ }

  // Deduplicate concurrent calls
  if (geoPromise) return geoPromise

  geoPromise = (async (): Promise<GeoData> => {
    let geo: GeoData | null = null

    // ── LAPIS 1: GPS browser ──────────────────────────────────
    if (isGPSLikelyAvailable()) {
      try {
        const coords = await getBrowserGPS()
        // Reverse geocode → nama kota yang akurat
        const place = await reverseGeocode(coords.latitude, coords.longitude)
        geo = { ...place, latitude: coords.latitude, longitude: coords.longitude, source: 'gps' }
      } catch (err) {
        // GeolocationPositionError:
        //   code 1 = PERMISSION_DENIED  → user tap Deny
        //   code 2 = POSITION_UNAVAILABLE → GPS off, indoor, hardware error
        //   code 3 = TIMEOUT            → GPS belum lock dalam 12 detik
        const code = (err as GeolocationPositionError)?.code
        console.debug(`[analytics] GPS failed (code=${code}), falling back to IP`)
      }
    } else {
      console.debug('[analytics] GPS skipped (in-app browser or HTTP), using IP fallback')
    }

    // ── LAPIS 2: IP fallback ──────────────────────────────────
    if (!geo) {
      geo = await getIPGeo()
    }

    // ── LAPIS 3: Tanpa geo ────────────────────────────────────
    if (!geo) {
      geo = { city: '', region: '', country: 'ID', latitude: 0, longitude: 0, source: 'none' }
    }

    geoCache = geo
    try { sessionStorage.setItem('sl_geo', JSON.stringify(geo)) } catch { /* private mode */ }
    return geo
  })()

  try {
    return await geoPromise
  } finally {
    geoPromise = null
  }
}

// ── Dedup client-side (cegah double-fire React StrictMode) ────
const sentEvents = new Set<string>()

// ── trackEvent — fungsi utama yang dipanggil dari halaman ─────
interface TrackPayload {
  event_type:   'category_view' | 'product_click'
  category_id?: string
  product_id?:  string
}

export async function trackEvent(payload: TrackPayload): Promise<void> {
  if (typeof window === 'undefined') return

  const targetId = payload.product_id ?? payload.category_id ?? 'unknown'
  const key      = `${payload.event_type}:${targetId}`
  if (sentEvents.has(key)) return
  sentEvents.add(key)

  const [sessionId, geo] = await Promise.all([
    Promise.resolve(getSessionId()),
    getUserGeoLocation(),
  ])

  try {
    await analyticsApi.recordEvent({
      ...payload,
      session_id: sessionId,
      city:       geo.source !== 'none' ? geo.city      : undefined,
      region:     geo.source !== 'none' ? geo.region    : undefined,
      country:    geo.source !== 'none' ? geo.country   : undefined,
      latitude:   geo.source !== 'none' ? geo.latitude  : undefined,
      longitude:  geo.source !== 'none' ? geo.longitude : undefined,
    })
  } catch {
    sentEvents.delete(key)
  }
}

// ── Shorthand helpers ─────────────────────────────────────────
export function trackCategoryView(categoryId: string): void {
  trackEvent({ event_type: 'category_view', category_id: categoryId })
}

export function trackProductClick(productId: string, categoryId?: string): void {
  trackEvent({ event_type: 'product_click', product_id: productId, category_id: categoryId })
}