'use client'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Program, Workout } from '@/types'
import { Lock, Play, X } from 'lucide-react'

interface DayCardProps {
  dayName: string
  dayNum: number
  program: Program | null
  workout: Workout | null
  completed: boolean
  missed: boolean
  isToday?: boolean
  isOverride?: boolean
  isRestDay?: boolean
  readonly?: boolean
  onEdit?: () => void
  onToggle?: () => void
  onMissed?: () => void   // mark as missed (swipe action)
  onLaunch?: () => void
}

export default function DayCard({
  dayName,
  dayNum,
  program,
  workout,
  completed,
  missed,
  isToday,
  isOverride,
  isRestDay,
  readonly,
  onEdit,
  onToggle,
  onMissed,
  onLaunch,
}: DayCardProps) {
  const today = new Date().getDay()
  const todayNum = today === 0 ? 7 : today
  const isPast = !isToday && dayNum < todayNum
  const hasSession = !!workout

  // Swipe state
  const [offset, setOffset] = useState(0)
  const [swipeOpen, setSwipeOpen] = useState(false)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)
  const ACTION_WIDTH = 90

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragging.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!dragging.current && Math.abs(dy) > Math.abs(dx)) { startX.current = null; return }
    dragging.current = true
    const newOffset = Math.max(-ACTION_WIDTH, Math.min(0, (swipeOpen ? -ACTION_WIDTH : 0) + dx))
    setOffset(newOffset)
  }
  function onTouchEnd() {
    startX.current = null
    startY.current = null
    if (!dragging.current) return
    dragging.current = false
    if (offset < -ACTION_WIDTH / 2) { setOffset(-ACTION_WIDTH); setSwipeOpen(true) }
    else { setOffset(0); setSwipeOpen(false) }
  }
  function closeSwipe() { setOffset(0); setSwipeOpen(false) }

  // Only show swipe if has session, not readonly, not rest day
  const swipeable = hasSession && !readonly && !!onMissed && !completed

  function handleCardClick() {
    if (swipeOpen) { closeSwipe(); return }
    if (readonly) return
    onEdit?.()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Missed action */}
      {swipeable && (
        <div className="absolute right-0 top-0 bottom-0 flex items-stretch" style={{ width: ACTION_WIDTH }}>
          <button
            onClick={() => { closeSwipe(); onMissed!() }}
            className="w-full flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:opacity-80 transition-opacity rounded-r-2xl"
          >
            <X size={18} />
            <span className="text-[10px] font-bold">Manquée</span>
          </button>
        </div>
      )}

      {/* Card */}
      <div
        style={swipeable ? { transform: `translateX(${offset}px)`, transition: dragging.current ? 'none' : 'transform 0.25s ease' } : undefined}
        onTouchStart={swipeable ? onTouchStart : undefined}
        onTouchMove={swipeable ? onTouchMove : undefined}
        onTouchEnd={swipeable ? onTouchEnd : undefined}
        onClick={handleCardClick}
        className={cn(
          'rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors',
          !readonly && !swipeOpen && 'cursor-pointer active:scale-[0.98]',
          missed
            ? 'bg-red-50 border border-red-100'
            : isToday
              ? 'bg-gray-950 shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
              : isPast && !completed
                ? 'bg-gray-50 border border-gray-100 opacity-60'
                : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100',
        )}
      >
        {/* Day label */}
        <div className="w-10 shrink-0">
          <p className={cn(
            'text-xs font-bold uppercase tracking-wide',
            missed ? 'text-red-400' : isToday ? 'text-white/60' : 'text-gray-400'
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
                <p className={cn('text-sm font-semibold truncate',
                  missed ? 'text-red-500 line-through' : isToday ? 'text-white' : 'text-gray-900'
                )}>
                  {workout!.name}
                </p>
                {isOverride && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
              </div>
              {program && (
                <p className={cn('text-xs truncate mt-0.5',
                  missed ? 'text-red-300' : isToday ? 'text-white/40' : 'text-gray-400'
                )}>
                  {program.name}
                </p>
              )}
            </div>
          ) : (
            <p className={cn('text-sm font-medium', isToday ? 'text-white/50' : 'text-gray-400')}>
              🧘 Repos
            </p>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {missed ? (
            /* Missed indicator — tappable to undo */
            <button
              onClick={() => onMissed?.()}
              className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center active:scale-90 transition-all"
              title="Annuler manquée"
            >
              <X size={16} className="text-red-500" />
            </button>
          ) : readonly ? (
            <div className="w-9 h-9 flex items-center justify-center">
              <Lock size={13} className={isToday ? 'text-white/30' : 'text-gray-300'} />
            </div>
          ) : hasSession ? (
            <>
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
    </div>
  )
}
