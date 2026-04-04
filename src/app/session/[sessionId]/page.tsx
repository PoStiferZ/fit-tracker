'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { WorkoutSession, WorkoutSet, Exercise } from '@/types'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check, SkipForward } from 'lucide-react'

// ─── Rest Timer ────────────────────────────────────────────────────────────────
interface RestTimerProps {
  seconds: number
  onSkip: () => void
}

function RestTimer({ seconds, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [seconds])

  useEffect(() => {
    if (remaining === 0) {
      const t = setTimeout(onSkip, 300)
      return () => clearTimeout(t)
    }
  }, [remaining, onSkip])

  const radius = 44
  const circumference = 2 * Math.PI * radius
  const progress = remaining / seconds
  const dashOffset = circumference * (1 - progress)

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#111827"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-gray-950 tabular-nums">
            {mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`}
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">repos</span>
        </div>
      </div>
      <button
        onClick={onSkip}
        className="flex items-center gap-1.5 text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2.5 rounded-2xl hover:bg-gray-200 transition-colors min-h-[44px]"
      >
        <SkipForward size={14} /> Passer
      </button>
    </div>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SetRow {
  set: WorkoutSet
  exercise: Exercise
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()

  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  // Local editable values for weight/reps
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [reps, setReps] = useState<Record<string, string>>({})

  // Which set is currently resting after validation
  const [restingAfterIndex, setRestingAfterIndex] = useState<number | null>(null)

  const [finishing, setFinishing] = useState(false)

  // Ordered set rows: sorted by exercise order, then set_index
  const orderedRows: SetRow[] = (() => {
    if (!session || exercises.length === 0) return []

    // Get exercise order from program (we'll load it from exercises sorted by program order)
    const exerciseOrder: string[] = exercises.map(e => e.id)

    const sorted = [...sets].sort((a, b) => {
      const ai = exerciseOrder.indexOf(a.exercise_id)
      const bi = exerciseOrder.indexOf(b.exercise_id)
      if (ai !== bi) return ai - bi
      // warmup before work
      if (a.set_type !== b.set_type) return a.set_type === 'warmup' ? -1 : 1
      return a.set_index - b.set_index
    })

    return sorted.map(s => ({
      set: s,
      exercise: exercises.find(e => e.id === s.exercise_id)!,
    })).filter(r => r.exercise)
  })()

  // Active set index = first not completed
  const activeGlobalIndex = orderedRows.findIndex(r => !r.set.completed_at)

  const load = useCallback(async () => {
    const [sessRes, setsRes] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_index'),
    ])
    if (!sessRes.data) { router.replace('/dashboard'); return }
    const sess: WorkoutSession = sessRes.data
    setSession(sess)

    // Load program exercises in order
    const progRes = await supabase.from('programs').select('*').eq('id', sess.program_id).single()
    if (progRes.data) {
      const exerciseIds: string[] = progRes.data.exercise_ids
      const exRes = await supabase.from('exercises').select('*').in('id', exerciseIds)
      // Sort by program order
      const exMap = Object.fromEntries((exRes.data || []).map((e: Exercise) => [e.id, e]))
      const ordered = exerciseIds.map(id => exMap[id]).filter(Boolean) as Exercise[]
      setExercises(ordered)
    }

    const fetchedSets: WorkoutSet[] = setsRes.data || []
    setSets(fetchedSets)

    // Init local weights/reps from fetched sets
    const w: Record<string, string> = {}
    const r: Record<string, string> = {}
    fetchedSets.forEach(s => {
      w[s.id] = s.weight_kg.toString()
      r[s.id] = s.reps.toString()
    })
    setWeights(w)
    setReps(r)

    setLoading(false)

    // Mark started_at if not set
    if (!sess.started_at) {
      await supabase.from('workout_sessions').update({ started_at: new Date().toISOString() }).eq('id', sessionId)
    }
  }, [sessionId, router])

  useEffect(() => { load() }, [load])

  async function validateSet(setId: string, globalIndex: number) {
    const weightVal = parseFloat(weights[setId] || '0')
    const repsVal = parseInt(reps[setId] || '0', 10)
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('workout_sets')
      .update({ weight_kg: weightVal, reps: repsVal, completed_at: now })
      .eq('id', setId)
      .select()
      .single()

    if (data) {
      setSets(prev => prev.map(s => s.id === setId ? data : s))
    }

    // Show rest timer unless it's the last set
    const isLast = globalIndex === orderedRows.length - 1
    if (!isLast) {
      setRestingAfterIndex(globalIndex)
    }
  }

  function skipRest() {
    setRestingAfterIndex(null)
  }

  async function finishSession() {
    setFinishing(true)
    await supabase.from('workout_sessions').update({ finished_at: new Date().toISOString() }).eq('id', sessionId)
    router.push('/dashboard')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8fb]">
      <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Group rows by exercise for display
  const exerciseGroups: { exercise: Exercise; rows: { row: SetRow; globalIndex: number }[] }[] = []
  orderedRows.forEach((row, globalIndex) => {
    const last = exerciseGroups[exerciseGroups.length - 1]
    if (last && last.exercise.id === row.exercise.id) {
      last.rows.push({ row, globalIndex })
    } else {
      exerciseGroups.push({ exercise: row.exercise, rows: [{ row, globalIndex }] })
    }
  })

  const allCompleted = orderedRows.length > 0 && orderedRows.every(r => r.set.completed_at)

  return (
    <div className="bg-[#f8f8fb] min-h-screen pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-gray-950 text-base leading-tight">Séance en cours</h1>
            <p className="text-gray-400 text-xs font-medium">
              {orderedRows.filter(r => r.set.completed_at).length}/{orderedRows.length} séries
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {exerciseGroups.map(({ exercise, rows }) => (
          <div key={exercise.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 overflow-hidden">
            {/* Exercise header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-black text-gray-950 text-base">{exercise.name}</p>
              {exercise.muscles && exercise.muscles.length > 0 && (
                <p className="text-xs text-gray-400 font-medium mt-0.5">{exercise.muscles.join(', ')}</p>
              )}
            </div>

            {/* Sets */}
            <div className="divide-y divide-gray-50">
              {rows.map(({ row, globalIndex }) => {
                const { set } = row
                const isCompleted = !!set.completed_at
                const isActive = globalIndex === activeGlobalIndex
                const isResting = restingAfterIndex === globalIndex

                return (
                  <div key={set.id}>
                    <div className={cn(
                      'px-4 py-3 transition-all',
                      isCompleted ? 'bg-green-50' : isActive ? 'bg-gray-950' : 'bg-white'
                    )}>
                      {/* Set label */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          'text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg',
                          set.set_type === 'warmup'
                            ? isCompleted ? 'bg-orange-100 text-orange-600' : isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-400'
                            : isCompleted ? 'bg-blue-100 text-blue-600' : isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-500'
                        )}>
                          {set.set_type === 'warmup' ? `Éch. ${set.set_number}` : `Série ${set.set_number}`}
                        </span>
                        {isCompleted && (
                          <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                            <Check size={12} strokeWidth={3} /> OK
                          </span>
                        )}
                      </div>

                      {/* Inputs */}
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', isActive ? 'text-gray-400' : 'text-gray-400')}>
                            Poids (kg)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            value={weights[set.id] ?? ''}
                            onChange={e => setWeights(prev => ({ ...prev, [set.id]: e.target.value }))}
                            disabled={isCompleted}
                            className={cn(
                              'w-full rounded-xl px-3 py-2.5 text-base font-bold text-center border-2 focus:outline-none transition-all',
                              isCompleted
                                ? 'bg-green-100 border-green-200 text-green-700 cursor-not-allowed'
                                : isActive
                                  ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-900'
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Répétitions</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={reps[set.id] ?? ''}
                            onChange={e => setReps(prev => ({ ...prev, [set.id]: e.target.value }))}
                            disabled={isCompleted}
                            className={cn(
                              'w-full rounded-xl px-3 py-2.5 text-base font-bold text-center border-2 focus:outline-none transition-all',
                              isCompleted
                                ? 'bg-green-100 border-green-200 text-green-700 cursor-not-allowed'
                                : isActive
                                  ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-900'
                            )}
                          />
                        </div>
                        {!isCompleted && isActive && (
                          <button
                            onClick={() => validateSet(set.id, globalIndex)}
                            className="h-[46px] px-4 bg-white text-gray-950 rounded-xl font-bold text-sm flex items-center gap-1.5 shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:scale-95 transition-transform min-w-[80px] justify-center"
                          >
                            <Check size={15} strokeWidth={3} /> OK
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rest timer — shown after validating this set */}
                    {isResting && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        <RestTimer
                          seconds={session?.default_rest_seconds ?? 90}
                          onSkip={skipRest}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Finish button */}
        <button
          onClick={finishSession}
          disabled={finishing}
          className={cn(
            'w-full rounded-2xl font-black text-base min-h-[56px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_20px_rgba(0,0,0,0.15)]',
            allCompleted
              ? 'bg-green-500 text-white shadow-[0_4px_20px_rgba(34,197,94,0.4)]'
              : 'bg-gray-950 text-white'
          )}
        >
          {finishing ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Check size={20} strokeWidth={3} />
              {allCompleted ? '🎉 Séance terminée !' : 'Terminer la séance'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
