'use client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Program } from '@/types'
import { Pencil, Check, Lock } from 'lucide-react'

interface DayCardProps {
  dayName: string
  dayNum: number
  program: Program | null
  completed: boolean
  isToday?: boolean
  readonly?: boolean
  onEdit?: () => void
  onToggle?: () => void
}

export default function DayCard({ dayName, dayNum, program, completed, isToday, readonly, onEdit, onToggle }: DayCardProps) {
  const router = useRouter()
  const today = new Date().getDay()
  const todayNum = today === 0 ? 7 : today
  const isPast = !isToday && dayNum < todayNum

  return (
    <div className={cn(
      'rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all',
      isToday
        ? 'bg-gray-950 shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
        : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100',
      isPast && !completed && !isToday && 'opacity-50',
    )}>
      {/* Day label */}
      <div className="w-10 shrink-0">
        <p className={cn(
          'text-xs font-bold uppercase tracking-wide',
          isToday ? 'text-white/60' : 'text-gray-400'
        )}>
          {dayName.slice(0, 3)}
        </p>
        {isToday && <p className="text-white text-xs font-semibold mt-0.5">Auj.</p>}
      </div>

      {/* Program — clickable zone navigates to programs page */}
      <div
        className={cn(
          'flex-1 min-w-0',
          program && !readonly ? 'cursor-pointer' : ''
        )}
        onClick={() => { if (program && !readonly) router.push('/programs') }}
      >
        {program
          ? <p className={cn('text-sm font-semibold truncate', isToday ? 'text-white' : 'text-gray-900')}>{program.name}</p>
          : <p className={cn('text-sm italic', isToday ? 'text-white/40' : 'text-gray-300')}>Repos</p>
        }
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {readonly ? (
          <div className="w-9 h-9 flex items-center justify-center">
            <Lock size={13} className={isToday ? 'text-white/30' : 'text-gray-300'} />
          </div>
        ) : (
          onEdit && (
            <button
              onClick={onEdit}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-xl transition-colors',
                isToday ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              )}
            >
              <Pencil size={14} className={isToday ? 'text-white/50' : 'text-gray-400'} />
            </button>
          )
        )}

        {program && (
          <button
            onClick={e => { e.stopPropagation(); if (!readonly) onToggle?.() }}
            disabled={readonly}
            className={cn(
              'w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all',
              completed
                ? 'bg-green-500 border-green-500 shadow-[0_2px_8px_rgba(34,197,94,0.4)]'
                : readonly
                  ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
                  : isToday
                    ? 'border-white/30 hover:border-white/60 active:scale-90'
                    : 'border-gray-200 hover:border-gray-400 active:scale-90'
            )}
          >
            {completed && <Check size={16} className="text-white" strokeWidth={3} />}
            {!completed && readonly && <Lock size={11} className="text-gray-300" />}
          </button>
        )}
      </div>
    </div>
  )
}
