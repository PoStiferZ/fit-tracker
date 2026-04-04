'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WeekNavProps {
  weekOffset: number // 0 = current, -1 = last week, etc.
  onPrev: () => void
  onNext: () => void
  weekLabel: string // ex: "7 – 13 avr."
}

export default function WeekNav({ weekOffset, onPrev, onNext, weekLabel }: WeekNavProps) {
  const isCurrentWeek = weekOffset === 0

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-3 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
      <button
        onClick={onPrev}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all"
      >
        <ChevronLeft size={18} className="text-gray-500" />
      </button>

      <div className="text-center">
        <p className="text-sm font-bold text-gray-900">{weekLabel}</p>
        {!isCurrentWeek && (
          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
            {weekOffset === -1 ? 'Semaine dernière' : `Il y a ${Math.abs(weekOffset)} semaines`}
          </p>
        )}
        {isCurrentWeek && (
          <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">Cette semaine</p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={isCurrentWeek}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={18} className="text-gray-500" />
      </button>
    </div>
  )
}
