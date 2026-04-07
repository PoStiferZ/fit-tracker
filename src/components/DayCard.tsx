'use client'
import { cn } from '@/lib/utils'
import type { Program, Workout } from '@/types'
import { Lock, Play } from 'lucide-react'

interface DayCardProps {
  dayName: string
  dayNum: number
  program: Program | null
  workout: Workout | null
  completed: boolean
  isToday?: boolean
  isOverride?: boolean
  isRestDay?: boolean      // explicitly set to rest (entry exists, no workout)
  readonly?: boolean
  onEdit?: () => void      // opens assign modal — triggered by clicking the whole card
  onToggle?: () => void
  onLaunch?: () => void
}

export default function DayCard({
  dayName,
  dayNum,
  program,
  workout,
  completed,
  isToday,
  isOverride,
  isRestDay,
  readonly,
  onEdit,
  onToggle,
  onLaunch,
}: DayCardProps) {
  const today = new Date().getDay()
  const todayNum = today === 0 ? 7 : today
  const isPast = !isToday && dayNum < todayNum
  const hasSession = !!workout

  function handleCardClick() {
    if (readonly) return
    onEdit?.()
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all',
        !readonly && 'cursor-pointer active:scale-[0.98]',
        isToday
          ? 'bg-gray-950 shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
          : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100',
        isPast && !completed && !isToday && 'opacity-50',
      )}
    >
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

      {/* Workout info */}
      <div className="flex-1 min-w-0">
        {hasSession ? (
          <div>
            <div className="flex items-center gap-1.5">
              <p className={cn('text-sm font-semibold truncate', isToday ? 'text-white' : 'text-gray-900')}>
                {workout!.name}
              </p>
              {isOverride && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              )}
            </div>
            {program && (
              <p className={cn('text-xs truncate mt-0.5', isToday ? 'text-white/40' : 'text-gray-400')}>
                {program.name}
              </p>
            )}
          </div>
        ) : isRestDay ? (
          <p className={cn('text-sm font-medium', isToday ? 'text-white/50' : 'text-gray-400')}>
            🧘 Repos
          </p>
        ) : (
          <p className={cn('text-sm italic', isToday ? 'text-white/30' : 'text-gray-300')}>
            {readonly ? '—' : 'Appuyer pour planifier'}
          </p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
        {readonly ? (
          <div className="w-9 h-9 flex items-center justify-center">
            <Lock size={13} className={isToday ? 'text-white/30' : 'text-gray-300'} />
          </div>
        ) : hasSession ? (
          <>
            {/* Démarrer — toujours visible */}
            {onLaunch && (
              <button
                onClick={e => { e.stopPropagation(); onLaunch() }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-90',
                  isToday
                    ? 'bg-white/15 text-white hover:bg-white/25'
                    : 'bg-gray-950 text-white shadow-sm hover:bg-gray-800'
                )}
              >
                <Play size={11} className="fill-current" />
                Démarrer
              </button>
            )}
            {/* Coche — verte si terminé, vide sinon */}
            <button
              onClick={e => { e.stopPropagation(); onToggle?.() }}
              className={cn(
                'w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 shrink-0',
                completed
                  ? 'bg-green-500 border-green-500 shadow-[0_2px_8px_rgba(34,197,94,0.4)]'
                  : isToday
                    ? 'border-white/30 hover:border-white/60'
                    : 'border-gray-200 hover:border-gray-400'
              )}
            >
              {completed && (
                <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5,8.5 6.5,12.5 13.5,4.5" />
                </svg>
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
