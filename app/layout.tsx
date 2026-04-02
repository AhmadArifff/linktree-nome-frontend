import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShopLink — Etalase Digital Produk Anda',
  description: 'Temukan produk pilihan terbaik kami dan belanja langsung di marketplace favorit Anda.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              fontFamily: 'Nunito, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
            },
          }}
        />
      </body>
    </html>
  )
}
