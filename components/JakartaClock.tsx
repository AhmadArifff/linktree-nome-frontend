'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

export function JakartaClock() {
  const [time, setTime] = useState<string>('')
  const [date, setDate] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    function updateTime() {
      // Get current time in Asia/Jakarta timezone
      const jakartaTime = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      const jakartaDate = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

      setTime(jakartaTime)
      setDate(jakartaDate)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>--:--:--</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 flex-shrink-0 text-violet-600" />
        <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Jakarta</span>
      </div>
      <p className="font-mono text-lg font-bold text-gray-800">{time}</p>
      <p className="text-xs text-gray-600 capitalize">{date}</p>
    </div>
  )
}
