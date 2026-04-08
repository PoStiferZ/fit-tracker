'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft } from 'lucide-react'
import type { LiveSession, LiveSessionSet, WorkoutExercise, MuscleGroup } from '@/types'

interface SessionWithWorkout extends LiveSession {
  workouts: {
    name: string
    programs: {
      name: string
    } | null
  } | null
}

interface WorkoutExerciseWithExercise extends WorkoutExercise {
  library_ex: {
    name: string
    muscles_primary: MuscleGroup[]
    exercise_type: string
  } | null
  custom_ex: {
    name: string
    muscles_primary: MuscleGroup[]
    exercise_type: string
  } | null
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  rear_delts: 'Delts post.',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  traps: 'Trapèzes',
  core: 'Abdos',
  quads: 'Quadriceps',
  hamstrings: 'Ischio',
  glutes: 'Fessiers',
  calves: 'Mollets',
  inner_thighs: 'Adducteurs',
  cardio: 'Cardio',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const min = Math.round(ms / 60000)
  return `${min}min`
}

function formatSetDisplay(set: LiveSessionSet, exerciseType: string): string {
  if (exerciseType === 'cardio') {
    const dur = set.duration_seconds != null ? `${set.duration_seconds}s` : '—'
    return dur
  }
  const reps = set.reps != null ? `${set.reps}r` : '—'
  const weight = set.weight_kg != null ? `${set.weight_kg}kg` : null
  return weight ? `${reps} · ${weight}` : reps
}

export default function HistoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [session, setSession] = useState<SessionWithWorkout | null>(null)
  const [sets, setSets] = useState<LiveSessionSet[]>([])
  const [exercises, setExercises] = useState<WorkoutExerciseWithExercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function load() {
      // Fetch session
      const { data: sessionData, error: sessionError } = await supabase
        .from('live_sessions')
        .select('*, workouts(name, programs(name))')
        .eq('id', id)
        .single()

      if (sessionError || !sessionData) {
        setLoading(false)
        return
      }
      setSession(sessionData as SessionWithWorkout)

      const workoutId = sessionData.workout_id

      // Fetch sets and exercises in parallel
      const [setsRes, exercisesRes] = await Promise.all([
        supabase
          .from('live_session_sets')
          .select('*')
          .eq('live_session_id', id)
          .order('created_at'),
        supabase
          .from('workout_exercises')
          .select(`
            *,
            library_ex:exercise_library(name, muscles_primary, exercise_type),
            custom_ex:custom_exercises(name, muscles_primary, exercise_type)
          `)
          .eq('workout_id', workoutId)
          .order('order_index'),
      ])

      if (setsRes.data) setSets(setsRes.data as LiveSessionSet[])
      if (exercisesRes.data) setExercises(exercisesRes.data as WorkoutExerciseWithExercise[])

      setLoading(false)
    }

    load()
  }, [id])

  const completedSets = sets.filter(s => !s.skipped)

  // Group sets by workout_exercise_id
  const setsByExercise: Record<string, LiveSessionSet[]> = {}
  for (const set of sets) {
    if (!setsByExercise[set.workout_exercise_id]) {
      setsByExercise[set.workout_exercise_id] = []
    }
    setsByExercise[set.workout_exercise_id].push(set)
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Fixed header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-[env(safe-area-inset-top,12px)] pb-3">
        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-700 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="font-black text-gray-950 text-base flex-1 truncate">
            {loading ? '…' : (session?.workouts?.name ?? 'Séance')}
          </h1>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 pt-4 pb-8">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 h-32 animate-pulse" />
              ))}
            </div>
          ) : !session ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-bold text-gray-700">Séance introuvable</p>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    📅 {formatDate(session.started_at)}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    ⏱ {formatDuration(session.started_at, session.finished_at)}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    ✅ {completedSets.length} série{completedSets.length !== 1 ? 's' : ''}
                  </span>
                  {session.workouts?.programs?.name && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {session.workouts.programs.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Exercises */}
              {exercises.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun exercice trouvé.</p>
              ) : (
                <div className="space-y-3">
                  {exercises.map(ex => {
                    const exSets = (setsByExercise[ex.id] || []).filter(s => !s.skipped)
                    if (exSets.length === 0) return null

                    const info = ex.library_ex ?? ex.custom_ex
                    const exName = info?.name ?? 'Exercice inconnu'
                    const muscles = info?.muscles_primary ?? []
                    const exerciseType = info?.exercise_type ?? 'strength'
                    const muscleLabels = muscles.map(m => MUSCLE_LABELS[m] ?? m).join(' · ')

                    // Separate warmup and work sets
                    const warmupSets = exSets.filter(s => s.set_type === 'warmup')
                    const workSets = exSets.filter(s => s.set_type !== 'warmup')

                    // Index for display: warmup labeled E1, E2... work labeled S1, S2...
                    return (
                      <div
                        key={ex.id}
                        className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                      >
                        <div className="mb-3">
                          <p className="font-bold text-gray-900 text-sm">{exName}</p>
                          {muscleLabels && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{muscleLabels}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {warmupSets.map((set, idx) => (
                            <div
                              key={set.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50"
                            >
                              <span className="text-[10px] font-bold text-amber-500 w-7 flex-shrink-0">
                                E{idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-amber-600">
                                {formatSetDisplay(set, exerciseType)}
                              </span>
                            </div>
                          ))}
                          {workSets.map((set, idx) => (
                            <div
                              key={set.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50"
                            >
                              <span className="text-[10px] font-bold text-gray-400 w-7 flex-shrink-0">
                                S{idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">
                                {formatSetDisplay(set, exerciseType)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
