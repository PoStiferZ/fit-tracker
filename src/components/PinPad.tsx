'use client'
import { cn } from '@/lib/utils'
import { Delete } from 'lucide-react'

interface PinPadProps {
  value: string
  onChange: (val: string) => void
  error?: string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinPad({ value, onChange, error }: PinPadProps) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key !== '' && value.length < 4) {
      onChange(value + key)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 4 dots */}
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(
            'w-4 h-4 rounded-full border-2 transition-all duration-200',
            i < value.length
              ? 'bg-gray-950 border-gray-950 scale-110'
              : 'bg-transparent border-gray-300'
          )} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-500 text-sm font-semibold text-center -mb-2">{error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((key, i) => (
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className={cn(
                'h-16 rounded-2xl text-xl font-bold transition-all active:scale-95',
                key === '⌫'
                  ? 'bg-gray-100 text-gray-500 flex items-center justify-center'
                  : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)] border border-gray-100 text-gray-900 hover:bg-gray-50'
              )}
            >
              {key === '⌫' ? <Delete size={20} /> : key}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
