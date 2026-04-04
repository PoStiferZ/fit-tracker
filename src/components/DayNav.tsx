'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DayNavProps {
  dayOffset: number // 0 = today, -1 = yesterday, etc.
  onPrev: () => void
  onNext: () => void
  dateLabel: string // ex: "Ven. 4 avr."
}

export default function DayNav({ dayOffset, onPrev, onNext, dateLabel }: DayNavProps) {
  const isToday = dayOffset === 0

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-3 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
      <button
        onClick={onPrev}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all"
      >
        <ChevronLeft size={18} className="text-gray-500" />
      </button>

      <div className="text-center">
        <p className="text-sm font-bold text-gray-900 capitalize">{dateLabel}</p>
        {!isToday && (
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            {dayOffset === -1 ? 'Hier' : `Il y a ${Math.abs(dayOffset)} jours`}
          </p>
        )}
        {isToday && (
          <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">Aujourd&apos;hui</p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={isToday}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={18} className="text-gray-500" />
      </button>
    </div>
  )
}
