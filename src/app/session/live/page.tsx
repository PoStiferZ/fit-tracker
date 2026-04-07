'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import type { WorkoutExercise, LiveSession, LiveSessionSet } from '@/types'
import { ChevronLeft, Check, SkipForward, Plus, Minus } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseWithName extends WorkoutExercise {
  name: string
  muscles_primary: string[]
  muscles_secondary: string[]
  exercise_type: 'strength' | 'cardio'
}

type SetType = 'warmup' | 'work' | 'cardio'

interface LiveSetState {
  exerciseIndex: number
  setIndex: number
  setType: SetType
  reps: number
  weight: number
  restSeconds: number
  durationSeconds: number
  incline: number
  speed: number
  skipped: boolean
  completed: boolean
}

type Phase = 'exercise' | 'rest' | 'finished'

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  label,
  unit,
  small,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  label?: string
  unit?: string
  small?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>}
      <div className={cn('flex items-center gap-1.5', small ? 'gap-1' : '')}>
        <button
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          className={cn(
            'rounded-lg bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors',
            small ? 'w-6 h-6' : 'w-8 h-8'
          )}
        >
          <Minus size={small ? 10 : 12} className="text-gray-600" />
        </button>
        <span className={cn('font-bold text-gray-900 text-center tabular-nums', small ? 'text-xs w-10' : 'text-sm w-12')}>
          {value}{unit}
        </span>
        <button
          onClick={() => onChange(+(value + step).toFixed(2))}
          className={cn(
            'rounded-lg bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors',
            small ? 'w-6 h-6' : 'w-8 h-8'
          )}
        >
          <Plus size={small ? 10 : 12} className="text-gray-600" />
        </button>
      </div>
    </div>
  )
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({
  initialSeconds,
  onDone,
  onSkip,
  nextSet,
  nextExercise,
}: {
  initialSeconds: number
  onDone: () => void
  onSkip: () => void
  nextSet: LiveSetState | null
  nextExercise: ExerciseWithName | null
}) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const [total, setTotal] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneCalledRef = useRef(false)

  const adjust = (delta: number) => {
    setRemaining(prev => {
      const next = Math.max(0, prev + delta)
      setTotal(t => Math.max(t, next))
      return next
    })
  }

  useEffect(() => {
    doneCalledRef.current = false
    setRemaining(initialSeconds)
    setTotal(initialSeconds)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [initialSeconds])

  useEffect(() => {
    if (remaining === 0 && !doneCalledRef.current) {
      doneCalledRef.current = true
      const t = setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }
  }, [remaining, onDone])

  const progress = total > 0 ? remaining / total : 0
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  // SVG ring — same style as exercise phase
  const RADIUS = 120
  const STROKE = 10
  const circumference = 2 * Math.PI * RADIUS
  const dashOffset = circumference * (1 - progress)

  // Next set info
  const isNextNewExercise = nextSet && nextExercise &&
    (nextSet.exerciseIndex !== (nextSet.setIndex > 0 ? nextSet.exerciseIndex : -99))
  const nextLabel = nextSet
    ? nextSet.setType === 'warmup'
      ? `Échauffement ${nextSet.setIndex + 1}`
      : nextSet.setType === 'cardio'
        ? `Cardio ${nextSet.setIndex + 1}`
        : `Série ${nextSet.setIndex + 1}`
    : null

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-5 pb-[env(safe-area-inset-bottom,20px)]">

      {/* Ring timer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="relative" style={{ width: RADIUS * 2 + STROKE * 2 + 8, height: RADIUS * 2 + STROKE * 2 + 8 }}>
          <svg
            width={RADIUS * 2 + STROKE * 2 + 8}
            height={RADIUS * 2 + STROKE * 2 + 8}
            className="-rotate-90"
            viewBox={`0 0 ${RADIUS * 2 + STROKE * 2 + 8} ${RADIUS * 2 + STROKE * 2 + 8}`}
          >
            {/* Track */}
            <circle
              cx={(RADIUS * 2 + STROKE * 2 + 8) / 2}
              cy={(RADIUS * 2 + STROKE * 2 + 8) / 2}
              r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={STROKE}
            />
            {/* Progress — animates over total duration */}
            <circle
              cx={(RADIUS * 2 + STROKE * 2 + 8) / 2}
              cy={(RADIUS * 2 + STROKE * 2 + 8) / 2}
              r={RADIUS}
              fill="none"
              stroke="#6366f1"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          {/* Center: time + label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Repos</span>
            <span className="font-mono text-5xl font-black text-gray-950 tabular-nums leading-none">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* +/- buttons */}
        <div className="flex items-center gap-4">
          <button onClick={() => adjust(-10)}
            className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm active:scale-95 transition-transform">
            −10s
          </button>
          <button onClick={() => adjust(10)}
            className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm active:scale-95 transition-transform">
            +10s
          </button>
        </div>
      </div>

      {/* Next up card */}
      {nextSet && nextExercise && (
        <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Prochaine série</p>
          <div className="flex items-center gap-3">
            <div className={cn(
              'px-2.5 py-1 rounded-xl text-xs font-bold shrink-0',
              nextSet.setType === 'warmup' ? 'bg-amber-100 text-amber-700' :
              nextSet.setType === 'cardio' ? 'bg-green-100 text-green-700' :
              'bg-indigo-100 text-indigo-700'
            )}>
              {nextLabel}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{nextExercise.name}</p>
              {nextSet.setType === 'cardio' ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  {Math.floor(nextSet.durationSeconds / 60)}min
                  {nextSet.speed > 0 && ` · ${nextSet.speed}km/h`}
                  {nextSet.incline > 0 && ` · ${nextSet.incline}% pente`}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">
                  {nextSet.reps} rép.
                  {nextSet.weight > 0 && <span className="font-bold text-gray-700"> · {nextSet.weight}kg</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skip */}
      <button onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 text-gray-500 text-sm font-semibold bg-white border border-gray-200 rounded-2xl min-h-[52px] active:scale-[0.98] transition-all mb-2">
        <SkipForward size={16} />
        Passer le repos
      </button>
    </div>
  )
}

// ─── Finished screen ──────────────────────────────────────────────────────────

function FinishedScreen({
  exercises,
  completedSets,
  totalSeconds,
  restSeconds,
  profileWeight,
  onReturn,
}: {
  exercises: ExerciseWithName[]
  completedSets: LiveSetState[]
  totalSeconds: number
  restSeconds: number
  profileWeight: number
  onReturn: () => void
}) {
  const exerciseSeconds = totalSeconds - restSeconds

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m${sec > 0 ? ` ${sec}s` : ''}`
  }

  // Calories estimation
  let totalCal = 0
  exercises.forEach(ex => {
    if (ex.exercise_type === 'cardio') {
      const exSets = completedSets.filter(s => exercises[s.exerciseIndex]?.id === ex.id && s.setType === 'cardio' && !s.skipped)
      const totalDurationMins = exSets.reduce((sum, s) => sum + s.durationSeconds / 60, 0)
      totalCal += (totalDurationMins * 7 * profileWeight) / 60
    } else {
      const exSets = completedSets.filter(s => exercises[s.exerciseIndex]?.id === ex.id && s.setType === 'work' && !s.skipped)
      exSets.forEach(s => {
        totalCal += s.reps * s.weight * 0.05
      })
    }
  })

  return (
    <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-12 pb-32">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-black text-gray-950">Séance terminée !</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-black text-gray-950">{formatDuration(exerciseSeconds)}</p>
            <p className="text-xs text-gray-400 mt-1 font-semibold">Exercice</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-black text-gray-950">{formatDuration(restSeconds)}</p>
            <p className="text-xs text-gray-400 mt-1 font-semibold">Repos</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-2xl font-black text-indigo-600">🔥 {Math.round(totalCal)}</p>
            <p className="text-xs text-gray-400 mt-1 font-semibold">kcal</p>
          </div>
        </div>

        {/* Exercises summary */}
        <div className="space-y-3">
          {exercises.map((ex, exIdx) => {
            const exSets = completedSets.filter(s => s.exerciseIndex === exIdx)
            const done = exSets.filter(s => !s.skipped)
            const skipped = exSets.filter(s => s.skipped)
            return (
              <div key={ex.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="font-bold text-gray-900 text-sm">{ex.name}</p>
                <div className="mt-2 space-y-1">
                  {done.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <Check size={12} className="text-green-500" />
                      {s.setType === 'cardio'
                        ? `${Math.round(s.durationSeconds / 60)}min · ${s.speed}km/h · ${s.incline}%`
                        : `${s.reps} reps × ${s.weight}kg`}
                    </div>
                  ))}
                  {skipped.length > 0 && (
                    <p className="text-xs text-gray-300">{skipped.length} passé{skipped.length > 1 ? 's' : ''}</p>
                  )}
                  {exSets.length === 0 && (
                    <p className="text-xs text-gray-300 italic">Non réalisé</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 pb-[env(safe-area-inset-bottom,20px)] bg-[#f8f8fb] pt-4">
        <button
          onClick={onReturn}
          className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[64px] flex items-center justify-center gap-2 text-base active:scale-[0.97] transition-transform"
        >
          Retour au dashboard
        </button>
      </div>
    </div>
  )
}

// ─── Main page (inner) ────────────────────────────────────────────────────────

function LiveSessionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('id')

  const [liveSession, setLiveSession] = useState<LiveSession | null>(null)
  const [exercises, setExercises] = useState<ExerciseWithName[]>([])
  const [sets, setSets] = useState<LiveSetState[]>([])
  const [phase, setPhase] = useState<Phase>('exercise')
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [currentSetIdx, setCurrentSetIdx] = useState(0)
  const [currentSetType, setCurrentSetType] = useState<SetType>('warmup')
  const [loading, setLoading] = useState(true)
  const [profileWeight, setProfileWeight] = useState(75)
  const [restDuration, setRestDuration] = useState(60)
  const [cycleSeconds, setCycleSeconds] = useState(0)

  // Timer total
  const startTimeRef = useRef<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [totalRestSeconds, setTotalRestSeconds] = useState(0)
  const restStartRef = useRef<number>(0)

  useEffect(() => {
    const iv = setInterval(() => {
      if (phase !== 'finished') {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [phase])

  // Cycle animation for exercise ring (60s loop) — must be unconditional
  useEffect(() => {
    setCycleSeconds(0)
    const iv = setInterval(() => {
      setCycleSeconds(prev => (prev + 1) % 60)
    }, 1000)
    return () => clearInterval(iv)
  }, [currentExIdx, currentSetIdx, currentSetType])

  // Build sets from workout_exercises
  const buildSets = useCallback((exs: ExerciseWithName[]): LiveSetState[] => {
    const result: LiveSetState[] = []
    exs.forEach((ex, exIdx) => {
      // Warmup sets
      for (let i = 0; i < ex.warmup_sets; i++) {
        result.push({
          exerciseIndex: exIdx,
          setIndex: i,
          setType: 'warmup',
          reps: ex.warmup_reps_per_set[i] ?? 10,
          weight: ex.warmup_loads[i] ?? 0,
          restSeconds: ex.warmup_rest_seconds[i] ?? 60,
          durationSeconds: 0,
          incline: 0,
          speed: 0,
          skipped: false,
          completed: false,
        })
      }
      // Work sets
      for (let i = 0; i < ex.work_sets; i++) {
        result.push({
          exerciseIndex: exIdx,
          setIndex: i,
          setType: 'work',
          reps: ex.work_reps_per_set[i] ?? 8,
          weight: ex.work_loads[i] ?? 0,
          restSeconds: ex.work_rest_seconds[i] ?? 90,
          durationSeconds: 0,
          incline: 0,
          speed: 0,
          skipped: false,
          completed: false,
        })
      }
      // Cardio sets
      for (let i = 0; i < ex.cardio_sets; i++) {
        result.push({
          exerciseIndex: exIdx,
          setIndex: i,
          setType: 'cardio',
          reps: 0,
          weight: 0,
          restSeconds: ex.cardio_rest_seconds[i] ?? 30,
          durationSeconds: ex.cardio_durations[i] ?? 600,
          incline: ex.cardio_inclines[i] ?? 0,
          speed: ex.cardio_speeds[i] ?? 8,
          skipped: false,
          completed: false,
        })
      }
    })
    return result
  }, [])

  const load = useCallback(async () => {
    if (!sessionId) return
    const profileId = getProfileId()
    if (!profileId) { router.replace('/'); return }

    const [sessionRes, profileRes] = await Promise.all([
      supabase.from('live_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('profiles').select('weight_kg').eq('id', profileId).single(),
    ])

    if (!sessionRes.data) { router.replace('/dashboard'); return }
    setLiveSession(sessionRes.data as LiveSession)
    if (profileRes.data?.weight_kg) setProfileWeight(profileRes.data.weight_kg)

    // Load workout_exercises with exercise names
    const { data: weData } = await supabase
      .from('workout_exercises')
      .select(`
        *,
        library_ex:exercise_library(name, muscles_primary, muscles_secondary, exercise_type),
        custom_ex:custom_exercises(name, muscles_primary, muscles_secondary, exercise_type)
      `)
      .eq('workout_id', sessionRes.data.workout_id)
      .order('order_index')

    if (!weData) { setLoading(false); return }

    const enriched: ExerciseWithName[] = weData.map((we: Record<string, unknown>) => {
      const libEx = we.library_ex as { name: string; muscles_primary: string[]; muscles_secondary: string[]; exercise_type: 'strength' | 'cardio' } | null
      const custEx = we.custom_ex as { name: string; muscles_primary: string[]; muscles_secondary: string[]; exercise_type: 'strength' | 'cardio' } | null
      const ex = libEx || custEx
      return {
        ...(we as unknown as WorkoutExercise),
        name: ex?.name ?? 'Exercice',
        muscles_primary: ex?.muscles_primary ?? [],
        muscles_secondary: ex?.muscles_secondary ?? [],
        exercise_type: ex?.exercise_type ?? 'strength',
      }
    })

    setExercises(enriched)

    // Load already completed sets
    const { data: existingSets } = await supabase
      .from('live_session_sets')
      .select('*')
      .eq('live_session_id', sessionId)

    const builtSets = buildSets(enriched)

    // Mark already completed sets (resume session)
    if (existingSets && existingSets.length > 0) {
      existingSets.forEach((ls: LiveSessionSet) => {
        const exIdx = enriched.findIndex(e => e.id === ls.workout_exercise_id)
        if (exIdx === -1) return
        const sIdx = builtSets.findIndex(
          s => s.exerciseIndex === exIdx && s.setIndex === ls.set_index && s.setType === ls.set_type
        )
        if (sIdx !== -1) {
          builtSets[sIdx].completed = true
          builtSets[sIdx].skipped = ls.skipped
          if (ls.reps !== null) builtSets[sIdx].reps = ls.reps
          if (ls.weight_kg !== null) builtSets[sIdx].weight = ls.weight_kg
        }
      })
    }

    // Always position on the first uncompleted set (covers new sessions too)
    const firstUncompleted = builtSets.findIndex(s => !s.completed)
    if (firstUncompleted !== -1) {
      setCurrentExIdx(builtSets[firstUncompleted].exerciseIndex)
      setCurrentSetIdx(builtSets[firstUncompleted].setIndex)
      setCurrentSetType(builtSets[firstUncompleted].setType)
    } else {
      setPhase('finished')
    }

    setSets(builtSets)
    setLoading(false)
  }, [sessionId, router, buildSets])

  useEffect(() => { load() }, [load])

  // Current flat index
  const currentFlatIdx = sets.findIndex(
    s => s.exerciseIndex === currentExIdx && s.setIndex === currentSetIdx && s.setType === currentSetType
  )

  // Sets for current exercise
  const currentExSets = sets.filter(s => s.exerciseIndex === currentExIdx)

  // Exercise set numbers display
  const getSetLabel = (s: LiveSetState) => {
    const exSetsOfType = sets.filter(ss => ss.exerciseIndex === s.exerciseIndex && ss.setType === s.setType)
    const idx = exSetsOfType.findIndex(ss => ss.setIndex === s.setIndex)
    const total = exSetsOfType.length
    if (s.setType === 'warmup') return `Éch. ${idx + 1}/${total}`
    if (s.setType === 'cardio') return `Cardio ${idx + 1}/${total}`
    return `Série ${idx + 1}/${total}`
  }

  const updateSet = (flatIdx: number, field: keyof LiveSetState, value: number) => {
    setSets(prev => prev.map((s, i) => i === flatIdx ? { ...s, [field]: value } : s))
  }

  async function saveSet(flatIdx: number, skipped: boolean) {
    const s = sets[flatIdx]
    const ex = exercises[s.exerciseIndex]
    if (!ex || !liveSession) return

    const payload: Omit<LiveSessionSet, 'id' | 'created_at'> = {
      live_session_id: liveSession.id,
      workout_exercise_id: ex.id,
      set_index: s.setIndex,
      set_type: s.setType,
      reps: s.setType !== 'cardio' ? s.reps : null,
      weight_kg: s.setType !== 'cardio' ? s.weight : null,
      rest_seconds: s.restSeconds,
      duration_seconds: s.setType === 'cardio' ? s.durationSeconds : null,
      skipped,
      completed_at: new Date().toISOString(),
    }

    await supabase.from('live_session_sets').insert(payload)

    // Update history if improved
    if (!skipped && s.setType === 'work') {
      const origReps = ex.work_reps_per_set[s.setIndex] ?? 0
      const origLoad = ex.work_loads[s.setIndex] ?? 0
      if (s.reps > origReps || s.weight > origLoad) {
        await supabase.from('workout_exercise_history').insert({
          workout_exercise_id: ex.id,
          set_index: s.setIndex,
          reps: s.reps,
          weight_kg: s.weight,
          recorded_at: new Date().toISOString(),
        })
      }
    }

    setSets(prev => prev.map((ss, i) => i === flatIdx ? { ...ss, completed: true, skipped } : ss))
  }

  async function finishSession() {
    if (!liveSession) return
    await supabase.from('live_sessions').update({
      status: 'finished',
      finished_at: new Date().toISOString(),
    }).eq('id', liveSession.id)

    // Mark weekly_plan day as completed
    const profileId = getProfileId()!
    const today = new Date()
    const todayNum = today.getDay() === 0 ? 7 : today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (todayNum - 1))
    const weekStart = monday.toISOString().split('T')[0]

    await supabase.from('weekly_plan')
      .update({ completed: true })
      .eq('profile_id', profileId)
      .eq('week_start', weekStart)
      .eq('workout_id', liveSession.workout_id)
  }

  function advanceToNext(fromFlatIdx: number) {
    const next = sets.findIndex((s, i) => i > fromFlatIdx && !s.completed)
    if (next === -1) {
      // All done
      finishSession()
      setPhase('finished')
    } else {
      setCurrentExIdx(sets[next].exerciseIndex)
      setCurrentSetIdx(sets[next].setIndex)
      setCurrentSetType(sets[next].setType)
      setPhase('exercise')
    }
  }

  async function completeCurrentSet(skipped = false) {
    if (currentFlatIdx === -1) return
    await saveSet(currentFlatIdx, skipped)
    const restSec = sets[currentFlatIdx].restSeconds
    if (!skipped && restSec > 0) {
      setRestDuration(restSec)
      restStartRef.current = Date.now()
      setPhase('rest')
    } else {
      advanceToNext(currentFlatIdx)
    }
  }

  function onRestDone() {
    setTotalRestSeconds(prev => prev + Math.round((Date.now() - restStartRef.current) / 1000))
    advanceToNext(currentFlatIdx)
  }

  function onRestSkip() {
    setTotalRestSeconds(prev => prev + Math.round((Date.now() - restStartRef.current) / 1000))
    advanceToNext(currentFlatIdx)
  }

  const elapsedMins = Math.floor(elapsed / 60)
  const elapsedSecs = elapsed % 60

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8fb]">
      <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (phase === 'finished') {
    return (
      <FinishedScreen
        exercises={exercises}
        completedSets={sets}
        totalSeconds={elapsed}
        restSeconds={totalRestSeconds}
        profileWeight={profileWeight}
        onReturn={() => router.replace('/dashboard')}
      />
    )
  }

  const currentEx = exercises[currentExIdx]
  const isCardio = currentEx?.exercise_type === 'cardio'

  // Progress: exercises done vs total
  const uniqueExDone = new Set(sets.filter(s => s.completed).map(s => s.exerciseIndex)).size
  const totalEx = exercises.length

  if (phase === 'rest') {
    // Find next incomplete set
    const nextFlatIdx = sets.findIndex((s, i) => i > currentFlatIdx && !s.completed)
    const nextSet = nextFlatIdx !== -1 ? sets[nextFlatIdx] : null
    const nextExercise = nextSet ? (exercises[nextSet.exerciseIndex] ?? null) : null

    return (
      <div className="h-[100dvh] flex flex-col bg-[#f8f8fb]">
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-5 bg-[#f8f8fb]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button
            onClick={() => router.replace('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={22} className="text-gray-600" />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold text-gray-400">Exercice {currentExIdx + 1}/{totalEx}</p>
            <p className="font-mono text-sm font-bold text-gray-600">
              {String(elapsedMins).padStart(2, '0')}:{String(elapsedSecs).padStart(2, '0')}
            </p>
          </div>
          <div className="w-10" />
        </div>
        <RestTimer
          key={restDuration}
          initialSeconds={restDuration}
          onDone={onRestDone}
          onSkip={onRestSkip}
          nextSet={nextSet}
          nextExercise={nextExercise}
        />
      </div>
    )
  }

  const circumference = 2 * Math.PI * 120 // ≈ 754
  const currentSet = sets[currentFlatIdx]

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8fb]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top,16px)] pb-3 bg-[#f8f8fb] shrink-0">
        <button
          onClick={() => router.replace('/dashboard')}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-gray-400">Exercice {currentExIdx + 1}/{totalEx}</p>
          <p className="font-mono text-sm font-bold text-gray-600">
            {String(elapsedMins).padStart(2, '0')}:{String(elapsedSecs).padStart(2, '0')}
          </p>
        </div>
        <div className="w-10" />
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 pb-[env(safe-area-inset-bottom,20px)]">

        {/* Set badge + exercise name */}
        <div className="flex flex-col items-center gap-2">
          {currentSet && (
            <span className={cn(
              'text-sm font-bold px-3 py-1 rounded-full',
              currentSetType === 'warmup'
                ? 'bg-amber-100 text-amber-700'
                : currentSetType === 'cardio'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-indigo-100 text-indigo-700'
            )}>
              {getSetLabel(currentSet)}
            </span>
          )}
          <h1 className="text-2xl font-black text-gray-950 text-center leading-tight">
            {currentEx?.name}
          </h1>
        </div>

        {/* Controls above circle: weight */}
        {currentSet && (
          <div className="flex items-center gap-5">
            <button
              onClick={() => isCardio
                ? updateSet(currentFlatIdx, 'durationSeconds', Math.max(0, currentSet.durationSeconds - 30))
                : updateSet(currentFlatIdx, 'weight', Math.max(0, +(currentSet.weight - 2.5).toFixed(2)))
              }
              className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <Minus size={18} className="text-gray-700" />
            </button>
            <div className="text-center min-w-[90px]">
              <p className="text-3xl font-black text-gray-950 tabular-nums">
                {isCardio ? `${Math.round(currentSet.durationSeconds / 60)}` : currentSet.weight}
              </p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                {isCardio ? 'min' : 'kg'}
              </p>
            </div>
            <button
              onClick={() => isCardio
                ? updateSet(currentFlatIdx, 'durationSeconds', currentSet.durationSeconds + 30)
                : updateSet(currentFlatIdx, 'weight', +(currentSet.weight + 2.5).toFixed(2))
              }
              className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus size={18} className="text-gray-700" />
            </button>
          </div>
        )}

        {/* SVG circle — Terminer button fills the inside */}
        <div className="relative" style={{ width: 280, height: 280 }}>
          {/* SVG ring */}
          <svg width={280} height={280} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={140} cy={140} r={120} fill="none" stroke="#e5e7eb" strokeWidth={10} />
            <circle
              cx={140} cy={140} r={120}
              fill="none"
              stroke="#111827"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - cycleSeconds / 60)}
              transform="rotate(-90 140 140)"
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
            />
          </svg>

          {/* Terminer button fills inner circle (r=115 → ~220px diameter) */}
          <button
            onClick={() => completeCurrentSet(false)}
            className="absolute bg-gray-950 text-white font-black flex flex-col items-center justify-center active:scale-95 transition-transform shadow-xl"
            style={{
              width: 220,
              height: 220,
              borderRadius: '50%',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-xs font-mono text-white/50 mb-1">
              {String(elapsedMins).padStart(2, '0')}:{String(elapsedSecs).padStart(2, '0')}
            </span>
            <Check size={32} strokeWidth={3} className="mb-1" />
            <span className="text-base font-black">Terminer</span>
          </button>
        </div>

        {/* Controls below circle: reps */}
        {currentSet && (
          <div className="flex items-center gap-5">
            <button
              onClick={() => isCardio
                ? updateSet(currentFlatIdx, 'speed', Math.max(0, +(currentSet.speed - 0.5).toFixed(1)))
                : updateSet(currentFlatIdx, 'reps', Math.max(0, currentSet.reps - 1))
              }
              className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <Minus size={18} className="text-gray-700" />
            </button>
            <div className="text-center min-w-[90px]">
              <p className="text-3xl font-black text-gray-950 tabular-nums">
                {isCardio ? currentSet.speed : currentSet.reps}
              </p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                {isCardio ? 'km/h' : 'reps'}
              </p>
            </div>
            <button
              onClick={() => isCardio
                ? updateSet(currentFlatIdx, 'speed', +(currentSet.speed + 0.5).toFixed(1))
                : updateSet(currentFlatIdx, 'reps', currentSet.reps + 1)
              }
              className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus size={18} className="text-gray-700" />
            </button>
          </div>
        )}

        {/* Skip button */}
        <button
          onClick={() => completeCurrentSet(true)}
          className="text-gray-400 text-sm font-semibold"
        >
          Passer la série
        </button>

      </div>
    </div>
  )
}

// ─── Wrapper with Suspense ────────────────────────────────────────────────────

export default function LiveSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8fb]">
        <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LiveSessionInner />
    </Suspense>
  )
}
