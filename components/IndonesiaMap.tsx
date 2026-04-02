'use client'

// ============================================================
// components/IndonesiaMap.tsx
// Peta interaktif Indonesia dengan titik kunjungan per kota
// Menggunakan Leaflet.js (dynamic import agar tidak SSR error)
//
// Install: npm install leaflet @types/leaflet
// ============================================================

import { useEffect, useRef } from 'react'
import { LocationStat } from '@/lib/api'

interface Props {
  locations: LocationStat[]
  loading?: boolean
}

// Warna titik berdasarkan jumlah views
function getMarkerColor(views: number, maxViews: number): string {
  const ratio = maxViews > 0 ? views / maxViews : 0
  if (ratio > 0.7) return '#7C3AED'   // violet — hotspot
  if (ratio > 0.4) return '#0D9488'   // teal — medium
  if (ratio > 0.1) return '#F59E0B'   // amber — low
  return '#94A3B8'                     // slate — minimal
}

// Radius lingkaran proporsional ke traffic (min 8, max 32)
function getRadius(views: number, maxViews: number): number {
  if (maxViews === 0) return 8
  return Math.max(8, Math.min(32, 8 + (views / maxViews) * 24))
}

export default function IndonesiaMap({ locations, loading }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || loading) return
    if (typeof window === 'undefined') return

    // Dynamic import Leaflet (client-only)
    import('leaflet').then((L) => {
      // Jika map sudah ada, destroy dulu
      if (leafletRef.current) {
        (leafletRef.current as { remove: () => void }).remove()
      }

      // Fix default icon Leaflet saat bundled dengan webpack/next
      // @ts-expect-error — leaflet icon url issue
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      // Init map terpusat di Indonesia
      const map = L.map(mapRef.current!, {
        center:          [-2.5, 118],   // center Indonesia
        zoom:            5,
        zoomControl:     true,
        attributionControl: false,
        scrollWheelZoom: false,         // disable scroll zoom agar tidak ganggu scroll page
      })

      // Tile layer — OpenStreetMap (gratis, tanpa API key)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 13,
        attribution: '© OpenStreetMap',
      }).addTo(map)

      // Tambah attribution di pojok kanan bawah (compact)
      L.control.attribution({ prefix: false }).addTo(map)

      leafletRef.current = map

      if (!locations || locations.length === 0) return

      const maxViews = Math.max(...locations.map(l => l.view_count), 1)

      // Tambah circle marker untuk setiap lokasi
      locations.forEach((loc) => {
        if (!loc.latitude || !loc.longitude) return

        const color  = getMarkerColor(loc.view_count, maxViews)
        const radius = getRadius(loc.view_count, maxViews)

        const circle = L.circleMarker([loc.latitude, loc.longitude], {
          radius,
          fillColor:   color,
          color:       '#fff',
          weight:      1.5,
          opacity:     0.9,
          fillOpacity: 0.75,
        }).addTo(map)

        // Popup konten saat klik titik
        circle.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:140px">
            <p style="font-weight:700;font-size:13px;margin:0 0 4px">${loc.city}</p>
            <p style="color:#6b7280;font-size:11px;margin:0 0 6px">${loc.region}</p>
            <div style="display:flex;gap:10px">
              <span style="font-size:11px">
                <span style="color:#7C3AED;font-weight:700">${loc.view_count.toLocaleString()}</span>
                <span style="color:#9ca3af"> kunjungan</span>
              </span>
              <span style="font-size:11px">
                <span style="color:#0D9488;font-weight:700">${loc.click_count.toLocaleString()}</span>
                <span style="color:#9ca3af"> klik</span>
              </span>
            </div>
          </div>
        `, { maxWidth: 200 })

        // Tooltip kecil on-hover
        circle.bindTooltip(loc.city, {
          permanent:  false,
          direction:  'top',
          className:  'leaflet-tooltip-shoplink',
          offset:     [0, -radius],
        })
      })

      // Auto-fit bounds ke semua titik jika ada data
      if (locations.length > 0) {
        const validLocs = locations.filter(l => l.latitude && l.longitude)
        if (validLocs.length > 0) {
          const bounds = L.latLngBounds(validLocs.map(l => [l.latitude, l.longitude] as [number, number]))
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
        }
      }
    })

    return () => {
      // Cleanup saat unmount
      if (leafletRef.current) {
        (leafletRef.current as { remove: () => void }).remove()
        leafletRef.current = null
      }
    }
  }, [locations, loading])

  // Inject CSS Leaflet (hanya sekali)
  useEffect(() => {
    if (document.getElementById('leaflet-css')) return
    const link = document.createElement('link')
    link.id   = 'leaflet-css'
    link.rel  = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)

    // Custom tooltip style
    const style = document.createElement('style')
    style.textContent = `
      .leaflet-tooltip-shoplink {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        color: #374151;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .leaflet-tooltip-shoplink::before { border: none; }
    `
    document.head.appendChild(style)
  }, [])

  if (loading) {
    return (
      <div className="h-72 bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
        <p className="text-gray-400 text-sm font-semibold">Memuat peta...</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-gray-100"
        style={{ height: '320px', zIndex: 0 }}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-100 shadow-sm z-10">
        <p className="text-xs font-bold text-gray-600 mb-1.5">Intensitas Traffic</p>
        <div className="flex flex-col gap-1">
          {[
            { color: '#7C3AED', label: 'Tinggi' },
            { color: '#0D9488', label: 'Sedang' },
            { color: '#F59E0B', label: 'Rendah' },
            { color: '#94A3B8', label: 'Minimal' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Scroll hint */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 border border-gray-100 shadow-sm z-10">
        <p className="text-xs text-gray-400">Klik titik untuk detail</p>
      </div>
    </div>
  )
}
