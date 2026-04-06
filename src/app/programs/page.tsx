'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import type { Program, Workout, WorkoutExercise, AnyExercise } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import ExerciseLibrary from '@/components/ExerciseLibrary'
import { Plus, ClipboardList, Trash2, Pencil, Check, ChevronUp, ChevronDown, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

const btnPrimary = 'w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none'
const btnSecondary = 'w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100'
const inputField = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

const RECURRENCE_OPTIONS = [4, 8, 12, 16, 24]

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkoutDraft {
  id: string | null // null = new
  name: string
  order_index: number
  exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]
  // loaded workout exercises for display (if editing)
  loadedExercises?: AnyExercise[]
}

interface ProgramWithWorkouts extends Program {
  workouts: WorkoutWithExercises[]
}

interface WorkoutWithExercises extends Workout {
  workout_exercises: WorkoutExercise[]
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithWorkouts[]>([])
  const [loading, setLoading] = useState(true)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Program form
  const [programName, setProgramName] = useState('')
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false)
  const [recurrenceWeeks, setRecurrenceWeeks] = useState<number>(8)
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([])
  const [saving, setSaving] = useState(false)

  // Library
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState<number | null>(null)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    const profileId = getProfileId()
    if (!profileId) return
    setLoading(true)
    const { data: progs } = await supabase.from('programs').select('*').eq('profile_id', profileId).order('created_at')
    if (!progs) { setLoading(false); return }

    const withWorkouts: ProgramWithWorkouts[] = await Promise.all(
      progs.map(async (p: Program) => {
        const { data: wks } = await supabase
          .from('workouts')
          .select('*, workout_exercises(*)')
          .eq('program_id', p.id)
          .order('order_index')
        return { ...p, workouts: (wks || []) as WorkoutWithExercises[] }
      })
    )
    setPrograms(withWorkouts)
    setLoading(false)
  }

  function openCreate() {
    setEditId(null)
    setProgramName('')
    setRecurrenceEnabled(false)
    setRecurrenceWeeks(8)
    setWorkouts([])
    setSheetOpen(true)
  }

  function openEdit(p: ProgramWithWorkouts) {
    setEditId(p.id)
    setProgramName(p.name)
    setRecurrenceEnabled(!!p.recurrence_weeks)
    setRecurrenceWeeks(p.recurrence_weeks || 8)
    setWorkouts(p.workouts.map((w, i) => ({
      id: w.id,
      name: w.name,
      order_index: i,
      exercises: w.workout_exercises.map((we, j) => ({
        ...we,
        order_index: j,
      })),
    })))
    setSheetOpen(true)
  }

  function addWorkout() {
    setWorkouts(prev => [...prev, {
      id: null,
      name: '',
      order_index: prev.length,
      exercises: [],
    }])
  }

  function removeWorkout(index: number) {
    setWorkouts(prev => prev.filter((_, i) => i !== index).map((w, i) => ({ ...w, order_index: i })))
  }

  function moveWorkout(index: number, direction: 'up' | 'down') {
    setWorkouts(prev => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((w, i) => ({ ...w, order_index: i }))
    })
  }

  function openLibraryForWorkout(index: number) {
    setActiveWorkoutIndex(index)
    setLibraryOpen(true)
  }

  function handleLibraryConfirm(
    newExercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]
  ) {
    if (activeWorkoutIndex === null) return
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== activeWorkoutIndex) return w
      const merged = [...w.exercises, ...newExercises].map((e, j) => ({ ...e, order_index: j }))
      return { ...w, exercises: merged }
    }))
    setLibraryOpen(false)
    setActiveWorkoutIndex(null)
  }

  function removeExerciseFromWorkout(workoutIndex: number, exIndex: number) {
    setWorkouts(prev => prev.map((w, i) => {
      if (i !== workoutIndex) return w
      return { ...w, exercises: w.exercises.filter((_, j) => j !== exIndex).map((e, j) => ({ ...e, order_index: j })) }
    }))
  }

  async function handleSave() {
    if (!programName.trim()) return
    const profileId = getProfileId()!
    setSaving(true)

    const programPayload = {
      name: programName.trim(),
      profile_id: profileId,
      recurrence_weeks: recurrenceEnabled ? recurrenceWeeks : null,
      recurrence_until: null as string | null,
    }

    let programId = editId
    if (editId) {
      await supabase.from('programs').update(programPayload).eq('id', editId)
    } else {
      const { data } = await supabase.from('programs').insert(programPayload).select().single()
      programId = data?.id
    }

    if (!programId) { setSaving(false); return }

    // Upsert workouts
    for (const w of workouts) {
      let workoutId = w.id
      const workoutPayload = {
        profile_id: profileId,
        program_id: programId,
        name: w.name || 'Séance',
        order_index: w.order_index,
      }
      if (w.id) {
        await supabase.from('workouts').update(workoutPayload).eq('id', w.id)
      } else {
        const { data } = await supabase.from('workouts').insert(workoutPayload).select().single()
        workoutId = data?.id
      }
      if (!workoutId) continue

      // Delete existing exercises and reinsert
      await supabase.from('workout_exercises').delete().eq('workout_id', workoutId)
      if (w.exercises.length > 0) {
        await supabase.from('workout_exercises').insert(
          w.exercises.map((e, j) => ({ ...e, workout_id: workoutId, order_index: j }))
        )
      }
    }

    await loadPrograms()
    setSaving(false)
    setSheetOpen(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  function ExerciseBadge({ ex }: { ex: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'> }) {
    const isCardio = ex.cardio_sets > 0
    const sets = isCardio ? ex.cardio_sets : ex.work_sets
    return (
      <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl px-2.5 py-1.5">
        {isCardio && <span className="text-[10px]">🏃</span>}
        <span className="text-[11px] font-semibold text-gray-600">{sets}×</span>
      </div>
    )
  }

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Programmes</h1>
            <p className="text-gray-400 text-sm mt-0.5">{programs.length} programme{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform">
            <Plus size={16} /> Créer
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
              <ClipboardList size={36} className="text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 text-lg">Aucun programme</p>
            <p className="text-gray-400 text-sm mt-1">Crée ton premier programme d&apos;entraînement</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-base">{p.name}</p>
                      {p.recurrence_weeks ? (
                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                          {p.recurrence_weeks} semaines
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                          Sans récurrence
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">
                      {p.workouts.length} séance{p.workouts.length !== 1 ? 's' : ''}
                    </p>
                    {p.workouts.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {p.workouts.map((w, i) => (
                          <div key={w.id} className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-gray-300 w-5">{i + 1}.</span>
                            <span className="text-xs font-semibold text-gray-700 flex-1 truncate">
                              {w.name || 'Séance sans nom'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {w.workout_exercises.length} ex.
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    <button onClick={() => openEdit(p)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteConfirm(p.id)} className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le programme ?">
        <div className="space-y-3 pb-2">
          <p className="text-gray-500 text-sm">Cette action supprimera le programme et toutes ses séances.</p>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.3)] active:scale-[0.98] transition-all">
            Supprimer
          </button>
          <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Annuler</button>
        </div>
      </BottomSheet>

      {/* Create / Edit sheet */}
      <BottomSheet
        isOpen={sheetOpen && !libraryOpen}
        onClose={() => setSheetOpen(false)}
        title={editId ? 'Modifier le programme' : 'Nouveau programme'}
      >
        <div className="space-y-5 pb-4">

          {/* Program name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom du programme</label>
            <input type="text" value={programName} onChange={e => setProgramName(e.target.value)}
              placeholder="Ex: Push Pull Legs, Full Body..."
              className={inputField + ' font-semibold'} />
          </div>

          {/* Recurrence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Récurrence</label>
              <button
                onClick={() => setRecurrenceEnabled(e => !e)}
                className={cn(
                  'w-11 h-6 rounded-full transition-all relative',
                  recurrenceEnabled ? 'bg-indigo-500' : 'bg-gray-200'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                  recurrenceEnabled ? 'left-5' : 'left-0.5'
                )} />
              </button>
            </div>
            {recurrenceEnabled && (
              <div className="flex gap-2 flex-wrap">
                {RECURRENCE_OPTIONS.map(w => (
                  <button key={w} onClick={() => setRecurrenceWeeks(w)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all min-w-[52px]',
                      recurrenceWeeks === w ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500'
                    )}>
                    {w}sem
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Workouts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Séances {workouts.length > 0 && <span className="text-gray-950 normal-case">({workouts.length})</span>}
              </label>
            </div>

            {workouts.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-5 text-center">
                <p className="text-sm text-gray-400 font-medium">Aucune séance</p>
                <p className="text-xs text-gray-300 mt-0.5">Ajoute des séances à ce programme</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.map((w, wi) => (
                  <div key={wi} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    {/* Workout header */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveWorkout(wi, 'up')}
                          disabled={wi === 0}
                          className="w-6 h-5 flex items-center justify-center rounded disabled:opacity-20 hover:bg-gray-200 transition-colors">
                          <ChevronUp size={12} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => moveWorkout(wi, 'down')}
                          disabled={wi === workouts.length - 1}
                          className="w-6 h-5 flex items-center justify-center rounded disabled:opacity-20 hover:bg-gray-200 transition-colors">
                          <ChevronDown size={12} className="text-gray-500" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={w.name}
                        onChange={e => setWorkouts(prev => prev.map((x, i) => i === wi ? { ...x, name: e.target.value } : x))}
                        placeholder={`Séance ${wi + 1} (ex: Push, Pull, Legs...)`}
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 font-semibold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
                      />
                      <button
                        onClick={() => removeWorkout(wi)}
                        className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors shrink-0">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>

                    {/* Exercises list */}
                    {w.exercises.length > 0 && (
                      <div className="space-y-1.5">
                        {w.exercises.map((ex, ei) => (
                          <div key={ei} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                            <span className="text-xs font-black text-gray-300 w-5">{ei + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {ex.cardio_sets > 0 && <span className="mr-1">🏃</span>}
                                {ex.source === 'library'
                                  ? `Exercice lib. (${ex.work_sets > 0 ? `${ex.work_sets} séries` : `${ex.cardio_sets} sets`})`
                                  : `Exercice custom (${ex.work_sets > 0 ? `${ex.work_sets} séries` : `${ex.cardio_sets} sets`})`
                                }
                              </p>
                            </div>
                            <button
                              onClick={() => removeExerciseFromWorkout(wi, ei)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-red-50 rounded-lg transition-colors shrink-0">
                              <span className="text-red-300 text-sm leading-none">×</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add exercises button */}
                    <button
                      onClick={() => openLibraryForWorkout(wi)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-bold text-gray-400 hover:border-gray-950 hover:text-gray-950 transition-all"
                    >
                      <Dumbbell size={14} /> Ajouter des exercices
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={addWorkout}
              className="w-full flex items-center justify-center gap-2 mt-3 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-400 hover:border-gray-950 hover:text-gray-950 transition-all">
              <Plus size={16} /> Ajouter une séance
            </button>
          </div>

          <button onClick={handleSave} disabled={saving || !programName.trim()} className={btnPrimary}>
            {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Créer le programme'}
          </button>
        </div>
      </BottomSheet>

      {/* Exercise Library */}
      <ExerciseLibrary
        isOpen={libraryOpen}
        onClose={() => { setLibraryOpen(false); setActiveWorkoutIndex(null) }}
        onConfirm={handleLibraryConfirm}
      />
    </div>
  )
}
