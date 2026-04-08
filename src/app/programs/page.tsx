'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import type { AnyExercise, MuscleGroup, Program, Workout, WorkoutExercise } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import ExerciseLibrary from '@/components/ExerciseLibrary'
import { Plus, ClipboardList, Trash2, Pencil, ChevronLeft, ChevronDown, ChevronRight, Dumbbell, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type View = 'list' | 'program-detail' | 'program-name' | 'workouts' | 'exercise-library'

interface WorkoutDraft {
  id: string | null
  name: string
  order_index: number
  exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]
}

interface ProgramDraft {
  id: string | null
  name: string
  workouts: WorkoutDraft[]
}

interface EnrichedExercise {
  workoutExercise: WorkoutExercise
  info: AnyExercise | null
}

interface WorkoutWithEnrichedExercises extends Workout {
  workout_exercises: WorkoutExercise[]
  enriched: EnrichedExercise[]
}

interface ProgramWithWorkouts extends Program {
  workouts: WorkoutWithEnrichedExercises[]
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Épaules', rear_delts: 'Arrière delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', traps: 'Trapèzes',
  core: 'Abdos', quads: 'Quadriceps', hamstrings: 'Ischio', glutes: 'Fessiers',
  calves: 'Mollets', inner_thighs: 'Adducteurs', cardio: 'Cardio',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithWorkouts[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // View machine
  const [view, setView] = useState<View>('list')
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithWorkouts | null>(null)
  const [draft, setDraft] = useState<ProgramDraft>({ id: null, name: '', workouts: [] })
  const [activeWorkoutIdx, setActiveWorkoutIdx] = useState<number | null>(null)

  // Workout name sheet
  const [workoutSheet, setWorkoutSheet] = useState<{ open: boolean; name: string; idx: number | null }>({
    open: false, name: '', idx: null,
  })

  // Delete confirm (program)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Detail view: rename program, create workout, delete workout
  const [renameProgramSheet, setRenameProgramSheet] = useState<{ open: boolean; name: string }>({ open: false, name: '' })
  const [detailNewWorkoutSheet, setDetailNewWorkoutSheet] = useState<{ open: boolean; name: string }>({ open: false, name: '' })
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState<string | null>(null)

  // Expanded workouts in detail view
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())

  // Add exercises to a workout in detail view (without going through full editor)
  const [detailAddWorkoutId, setDetailAddWorkoutId] = useState<string | null>(null)

  // Exercise edit sheet (in detail view)
  const [editExSheet, setEditExSheet] = useState<{
    open: boolean
    workoutId: string
    exerciseId: string
    workRepsPerSet: number[]
    workLoadsPerSet: number[]
    warmupRepsPerSet: number[]
    warmupLoadsPerSet: number[]
  } | null>(null)

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    const profileId = getProfileId()
    if (!profileId) return
    setLoading(true)

    const { data: progs } = await supabase.from('programs').select('*').eq('profile_id', profileId).order('created_at')
    if (!progs) { setLoading(false); return }

    // Load exercises info from library + custom
    const [libRes, customRes] = await Promise.all([
      supabase.from('exercise_library').select('*'),
      supabase.from('custom_exercises').select('*').eq('profile_id', profileId),
    ])
    const allExercises: AnyExercise[] = [
      ...((libRes.data || []).map((e: AnyExercise) => ({ ...e, source: 'library' as const }))),
      ...((customRes.data || []).map((e: AnyExercise) => ({ ...e, source: 'custom' as const }))),
    ]

    const withWorkouts: ProgramWithWorkouts[] = await Promise.all(
      progs.map(async (p: Program) => {
        const { data: wks } = await supabase
          .from('workouts').select('*, workout_exercises(*)')
          .eq('program_id', p.id).order('order_index')
        const workouts: WorkoutWithEnrichedExercises[] = (wks || []).map((w: Workout & { workout_exercises: WorkoutExercise[] }) => ({
          ...w,
          enriched: (w.workout_exercises || []).map(we => ({
            workoutExercise: we,
            info: allExercises.find(e =>
              we.source === 'library' ? e.id === we.library_exercise_id : e.id === we.custom_exercise_id
            ) ?? null,
          })),
        }))
        return { ...p, workouts }
      })
    )
    setPrograms(withWorkouts)
    setLoading(false)
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  function openProgramDetail(p: ProgramWithWorkouts) {
    setSelectedProgram(p)
    setExpandedWorkouts(new Set())
    setView('program-detail')
  }

  function startCreate() {
    setDraft({ id: null, name: '', workouts: [] })
    setView('program-name')
  }

  function startEdit(p: ProgramWithWorkouts) {
    setDraft({
      id: p.id,
      name: p.name,
      workouts: p.workouts.map((w, i) => ({
        id: w.id,
        name: w.name,
        order_index: i,
        exercises: w.workout_exercises.map((we, j) => ({ ...we, order_index: j })),
      })),
    })
    setView('program-name')
  }

  // ── Workout sheet ───────────────────────────────────────────────────────────
  function openWorkoutSheet(idx: number | null) {
    const name = idx !== null ? (draft.workouts[idx]?.name ?? '') : ''
    setWorkoutSheet({ open: true, name, idx })
  }

  function confirmWorkoutSheet() {
    const name = workoutSheet.name.trim() || 'Séance'
    if (workoutSheet.idx !== null) {
      setDraft(d => ({
        ...d,
        workouts: d.workouts.map((w, i) => i === workoutSheet.idx ? { ...w, name } : w),
      }))
      setWorkoutSheet({ open: false, name: '', idx: null })
    } else {
      const newIdx = draft.workouts.length
      setDraft(d => ({
        ...d,
        workouts: [...d.workouts, { id: null, name, order_index: newIdx, exercises: [] }],
      }))
      setActiveWorkoutIdx(newIdx)
      setWorkoutSheet({ open: false, name: '', idx: null })
      setView('exercise-library')
    }
  }

  function removeWorkout(idx: number) {
    setDraft(d => ({
      ...d,
      workouts: d.workouts.filter((_, i) => i !== idx).map((w, i) => ({ ...w, order_index: i })),
    }))
  }

  function addExercisesToWorkout(
    exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]
  ) {
    if (activeWorkoutIdx === null) return
    setDraft(d => ({
      ...d,
      workouts: d.workouts.map((w, i) => {
        if (i !== activeWorkoutIdx) return w
        const merged = [...w.exercises, ...exercises].map((e, j) => ({ ...e, order_index: j }))
        return { ...w, exercises: merged }
      }),
    }))
    setView('workouts')
  }

  // ── Detail view: rename program ─────────────────────────────────────────────
  async function saveProgramRename() {
    if (!selectedProgram || !renameProgramSheet.name.trim()) return
    const name = renameProgramSheet.name.trim()
    await supabase.from('programs').update({ name }).eq('id', selectedProgram.id)
    setSelectedProgram(p => p ? { ...p, name } : p)
    setPrograms(ps => ps.map(p => p.id === selectedProgram.id ? { ...p, name } : p))
    setRenameProgramSheet({ open: false, name: '' })
  }

  // ── Detail view: create new workout directly ─────────────────────────────────
  async function createWorkoutInDetail() {
    if (!selectedProgram || !detailNewWorkoutSheet.name.trim()) return
    const profileId = getProfileId()!
    const name = detailNewWorkoutSheet.name.trim()
    const order_index = selectedProgram.workouts.length
    const { data } = await supabase.from('workouts').insert({
      profile_id: profileId,
      program_id: selectedProgram.id,
      name,
      order_index,
    }).select().single()
    if (!data) return
    const newWorkout: WorkoutWithEnrichedExercises = {
      ...data,
      workout_exercises: [],
      enriched: [],
    }
    setSelectedProgram(p => p ? { ...p, workouts: [...p.workouts, newWorkout] } : p)
    setPrograms(ps => ps.map(p => p.id === selectedProgram.id ? { ...p, workouts: [...p.workouts, newWorkout] } : p))
    setDetailNewWorkoutSheet({ open: false, name: '' })
  }

  // ── Detail view: delete workout ──────────────────────────────────────────────
  async function deleteWorkoutInDetail(workoutId: string) {
    await supabase.from('workout_exercises').delete().eq('workout_id', workoutId)
    await supabase.from('workouts').delete().eq('id', workoutId)
    setSelectedProgram(p => p ? { ...p, workouts: p.workouts.filter(w => w.id !== workoutId) } : p)
    setPrograms(ps => ps.map(p => p.id === selectedProgram?.id
      ? { ...p, workouts: p.workouts.filter(w => w.id !== workoutId) }
      : p))
    setDeleteWorkoutConfirm(null)
  }

  // ── Detail view: exercise actions ───────────────────────────────────────────
  async function removeExerciseFromWorkout(workoutId: string, exerciseId: string) {
    await supabase.from('workout_exercises').delete().eq('id', exerciseId)
    setSelectedProgram(p => {
      if (!p) return p
      return {
        ...p,
        workouts: p.workouts.map(w => {
          if (w.id !== workoutId) return w
          const filtered = w.workout_exercises.filter(e => e.id !== exerciseId)
          return {
            ...w,
            workout_exercises: filtered,
            enriched: w.enriched.filter(e => e.workoutExercise.id !== exerciseId),
          }
        }),
      }
    })
    // Also refresh programs list
    setPrograms(ps => ps.map(p => {
      if (!selectedProgram || p.id !== selectedProgram.id) return p
      return {
        ...p,
        workouts: p.workouts.map(w => {
          if (w.id !== workoutId) return w
          const filtered = w.workout_exercises.filter(e => e.id !== exerciseId)
          return {
            ...w,
            workout_exercises: filtered,
            enriched: w.enriched.filter(e => e.workoutExercise.id !== exerciseId),
          }
        }),
      }
    }))
  }

  // Add exercises directly from detail view
  async function addExercisesToDetailWorkout(
    exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]
  ) {
    if (!detailAddWorkoutId || !selectedProgram) return
    const profileId = getProfileId()!
    const workout = selectedProgram.workouts.find(w => w.id === detailAddWorkoutId)
    if (!workout) return

    const startIdx = workout.workout_exercises.length
    const rows = exercises.map((e, i) => ({ ...e, workout_id: detailAddWorkoutId, order_index: startIdx + i }))
    const { data: inserted } = await supabase.from('workout_exercises').insert(rows).select()
    if (!inserted) return

    // Reload exercise info
    const [libRes, customRes] = await Promise.all([
      supabase.from('exercise_library').select('*'),
      supabase.from('custom_exercises').select('*').eq('profile_id', profileId),
    ])
    const allExercises: AnyExercise[] = [
      ...((libRes.data || []).map((e: AnyExercise) => ({ ...e, source: 'library' as const }))),
      ...((customRes.data || []).map((e: AnyExercise) => ({ ...e, source: 'custom' as const }))),
    ]

    const newEnriched: EnrichedExercise[] = (inserted as WorkoutExercise[]).map(we => ({
      workoutExercise: we,
      info: allExercises.find(e =>
        we.source === 'library' ? e.id === we.library_exercise_id : e.id === we.custom_exercise_id
      ) ?? null,
    }))

    const updateWorkout = (w: WorkoutWithEnrichedExercises) => {
      if (w.id !== detailAddWorkoutId) return w
      return {
        ...w,
        workout_exercises: [...w.workout_exercises, ...(inserted as WorkoutExercise[])],
        enriched: [...w.enriched, ...newEnriched],
      }
    }

    setSelectedProgram(p => p ? { ...p, workouts: p.workouts.map(updateWorkout) } : p)
    setPrograms(ps => ps.map(p =>
      p.id !== selectedProgram.id ? p : { ...p, workouts: p.workouts.map(updateWorkout) }
    ))
    setDetailAddWorkoutId(null)
    setExpandedWorkouts(prev => new Set([...prev, detailAddWorkoutId]))
  }

  // Move exercise up or down within a workout
  async function reorderExercise(workoutId: string, exerciseId: string, direction: 'up' | 'down') {
    if (!selectedProgram) return
    const workout = selectedProgram.workouts.find(w => w.id === workoutId)
    if (!workout) return

    const enriched = [...workout.enriched]
    const idx = enriched.findIndex(e => e.workoutExercise.id === exerciseId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= enriched.length) return

    // Swap
    const tmp = enriched[idx]
    enriched[idx] = enriched[swapIdx]
    enriched[swapIdx] = tmp

    // Reassign order_index
    const updated = enriched.map((e, i) => ({
      ...e,
      workoutExercise: { ...e.workoutExercise, order_index: i },
    }))

    // Optimistic update
    const updateWorkout = (w: WorkoutWithEnrichedExercises) => {
      if (w.id !== workoutId) return w
      return {
        ...w,
        enriched: updated,
        workout_exercises: updated.map(e => e.workoutExercise),
      }
    }
    setSelectedProgram(p => p ? { ...p, workouts: p.workouts.map(updateWorkout) } : p)

    // Persist to DB
    await Promise.all(updated.map(e =>
      supabase.from('workout_exercises')
        .update({ order_index: e.workoutExercise.order_index })
        .eq('id', e.workoutExercise.id)
    ))
  }

  async function saveExerciseEdit() {
    if (!editExSheet) return
    const { workoutId, exerciseId, workRepsPerSet, workLoadsPerSet, warmupRepsPerSet, warmupLoadsPerSet } = editExSheet
    await supabase.from('workout_exercises').update({
      work_reps_per_set: workRepsPerSet,
      work_loads: workLoadsPerSet,
      warmup_reps_per_set: warmupRepsPerSet,
      warmup_loads: warmupLoadsPerSet,
    }).eq('id', exerciseId)

    // Update local state
    const updateEx = (we: WorkoutExercise) =>
      we.id !== exerciseId ? we : { ...we, work_reps_per_set: workRepsPerSet, work_loads: workLoadsPerSet, warmup_reps_per_set: warmupRepsPerSet, warmup_loads: warmupLoadsPerSet }

    setSelectedProgram(p => {
      if (!p) return p
      return {
        ...p,
        workouts: p.workouts.map(w => w.id !== workoutId ? w : {
          ...w,
          workout_exercises: w.workout_exercises.map(updateEx),
          enriched: w.enriched.map(e => ({ ...e, workoutExercise: updateEx(e.workoutExercise) })),
        }),
      }
    })
    setEditExSheet(null)
  }

  // ── Save program ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft.name.trim()) return
    const profileId = getProfileId()!
    setSaving(true)

    const programPayload = {
      name: draft.name.trim(),
      profile_id: profileId,
      recurrence_weeks: null as number | null,
      recurrence_until: null as string | null,
    }

    let programId = draft.id
    if (draft.id) {
      await supabase.from('programs').update(programPayload).eq('id', draft.id)
    } else {
      const { data } = await supabase.from('programs').insert(programPayload).select().single()
      programId = data?.id
    }

    if (!programId) { setSaving(false); return }

    for (const w of draft.workouts) {
      let workoutId = w.id
      const wPayload = { profile_id: profileId, program_id: programId, name: w.name || 'Séance', order_index: w.order_index }
      if (w.id) {
        await supabase.from('workouts').update(wPayload).eq('id', w.id)
      } else {
        const { data } = await supabase.from('workouts').insert(wPayload).select().single()
        workoutId = data?.id
      }
      if (!workoutId) continue
      await supabase.from('workout_exercises').delete().eq('workout_id', workoutId)
      if (w.exercises.length > 0) {
        await supabase.from('workout_exercises').insert(
          w.exercises.map((e, j) => ({ ...e, workout_id: workoutId, order_index: j }))
        )
      }
    }

    await loadPrograms()
    setSaving(false)
    setView('list')
  }

  async function handleDelete(id: string) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: exercise-library
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'exercise-library') {
    // Coming from detail view (detailAddWorkoutId set) vs editor view
    const isFromDetail = detailAddWorkoutId !== null
    return (
      <ExerciseLibrary
        fullPage
        isOpen={true}
        onClose={() => {
          if (isFromDetail) { setDetailAddWorkoutId(null); setView('program-detail') }
          else setView('workouts')
        }}
        onConfirm={(exercises) => {
          if (isFromDetail) addExercisesToDetailWorkout(exercises)
          else addExercisesToWorkout(exercises)
        }}
      />
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: program-name
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'program-name') {
    return (
      <div className="h-[100dvh] bg-white flex flex-col">
        <div className="shrink-0 flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button onClick={() => setView('list')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 text-lg flex-1">
            {draft.id ? 'Modifier le programme' : 'Nouveau programme'}
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-8">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom du programme</label>
          <input
            type="text" value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && draft.name.trim()) setView('workouts') }}
            placeholder="Ex: Push Pull Legs, Full Body..."
            autoFocus
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-lg font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
          />
        </div>
        <div className="shrink-0 px-5 pt-4 bg-white"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button
            onClick={() => { if (draft.name.trim()) setView('workouts') }}
            disabled={!draft.name.trim()}
            className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[56px] flex items-center justify-center gap-2 text-base active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40 disabled:shadow-none"
          >Suivant →</button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: workouts (editor)
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'workouts') {
    return (
      <div className="h-[100dvh] bg-white flex flex-col">
        <div className="shrink-0 flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button onClick={() => setView('program-name')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 text-lg flex-1 truncate">{draft.name}</h1>
          <button onClick={() => openWorkoutSheet(null)}
            className="flex items-center gap-1.5 bg-gray-950 text-white px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform shrink-0">
            <Plus size={15} /> Séance
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {draft.workouts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 flex flex-col items-center gap-3 mt-4">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Dumbbell size={24} className="text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-400">Aucune séance</p>
              <p className="text-xs text-gray-300">Ajoute ta première séance via le bouton +</p>
            </div>
          ) : (
            draft.workouts.map((w, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{w.name || 'Séance sans nom'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{w.exercises.length} exercice{w.exercises.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setActiveWorkoutIdx(i); setView('exercise-library') }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                      <Plus size={15} className="text-gray-500" />
                    </button>
                    <button onClick={() => openWorkoutSheet(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => removeWorkout(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 bg-white border-t border-gray-100"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          <button onClick={handleSave} disabled={saving || !draft.name.trim()}
            className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center gap-2 text-base active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40 disabled:shadow-none">
            {saving ? 'Enregistrement...' : draft.id ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>

        {/* Workout name sheet */}
        <BottomSheet isOpen={workoutSheet.open} onClose={() => setWorkoutSheet(s => ({ ...s, open: false }))}
          title={workoutSheet.idx !== null ? 'Renommer la séance' : 'Nouvelle séance'}>
          <div className="space-y-4 pb-4">
            <input type="text" value={workoutSheet.name}
              onChange={e => setWorkoutSheet(s => ({ ...s, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') confirmWorkoutSheet() }}
              placeholder="Ex: Push, Pull, Legs..."
              autoFocus
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
            />
            <button onClick={confirmWorkoutSheet}
              className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
              {workoutSheet.idx !== null ? 'Renommer' : 'Suivant →'}
            </button>
          </div>
        </BottomSheet>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: program-detail
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'program-detail' && selectedProgram) {
    const prog = selectedProgram

    function calcRestTime(exercises: WorkoutExercise[]): string {
      const total = exercises.reduce((acc, we) => {
        const workRest = we.work_rest_seconds.reduce((s, v) => s + (v || 0), 0)
        const warmupRest = we.warmup_rest_seconds.reduce((s, v) => s + (v || 0), 0)
        const cardioRest = we.cardio_rest_seconds.reduce((s, v) => s + (v || 0), 0)
        return acc + workRest + warmupRest + cardioRest
      }, 0)
      if (total === 0) return ''
      const m = Math.floor(total / 60)
      const s = total % 60
      if (m === 0) return `${s}s de repos`
      if (s === 0) return `~${m}min de repos`
      return `~${m}min${s}s de repos`
    }

    function toggleWorkout(id: string) {
      setExpandedWorkouts(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    return (
      <div className="h-[100dvh] bg-white flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button onClick={() => setView('list')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <h1 className="font-black text-gray-900 text-lg truncate">{prog.name}</h1>
            <button
              onClick={() => setRenameProgramSheet({ open: true, name: prog.name })}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            >
              <Pencil size={13} className="text-gray-400" />
            </button>
          </div>
          <button
            onClick={() => setDetailNewWorkoutSheet({ open: true, name: '' })}
            className="flex items-center gap-1.5 bg-gray-950 text-white px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform shrink-0"
          >
            <Plus size={13} /> Séance
          </button>
        </div>

        {/* Workout list with expand */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {prog.workouts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 flex flex-col items-center gap-3 mt-4">
              <Dumbbell size={28} className="text-gray-300" />
              <p className="text-sm font-bold text-gray-400">Aucune séance dans ce programme</p>
            </div>
          ) : prog.workouts.map(w => {
            const expanded = expandedWorkouts.has(w.id)
            return (
              <div key={w.id} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                {/* Workout header */}
                <div className="flex items-center gap-2 px-4 py-3.5">
                  {/* Expand toggle — takes most space */}
                  <button onClick={() => toggleWorkout(w.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{w.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {w.workout_exercises.length} exercice{w.workout_exercises.length !== 1 ? 's' : ''}
                        </span>
                        {calcRestTime(w.workout_exercises) !== '' && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">
                            ⏱ {calcRestTime(w.workout_exercises)}
                          </span>
                        )}
                      </div>
                      {w.enriched.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[...new Set(w.enriched.flatMap(e => e.info?.muscles_primary ?? []))].slice(0, 3)
                            .map(m => MUSCLE_LABELS[m]).join(', ')}
                        </p>
                      )}
                    </div>
                    <ChevronDown size={18} className={cn('text-gray-400 transition-transform shrink-0', expanded && 'rotate-180')} />
                  </button>
                  {/* Add exercise + delete workout buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => { setDetailAddWorkoutId(w.id); setView('exercise-library') }}
                      className="flex items-center gap-1 bg-gray-950 text-white px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    >
                      <Plus size={13} /> Ajouter
                    </button>
                    <button
                      onClick={() => setDeleteWorkoutConfirm(w.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded: exercises */}
                {expanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {w.enriched.length === 0 ? (
                      <div className="px-4 py-4 flex flex-col items-center gap-2">
                        <p className="text-xs text-gray-400 italic">Aucun exercice</p>
                        <button
                          onClick={() => { setDetailAddWorkoutId(w.id); setView('exercise-library') }}
                          className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                        >
                          <Plus size={13} /> Ajouter un exercice
                        </button>
                      </div>
                    ) : w.enriched.map(({ workoutExercise: we, info }, exIdx) => (
                      <div key={we.id} className="px-4 py-3 space-y-2">
                        {/* Exercise title row */}
                        <div className="flex items-center gap-2">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={() => reorderExercise(w.id, we.id, 'up')}
                              disabled={exIdx === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-20"
                            >
                              <ArrowUp size={11} className="text-gray-400" />
                            </button>
                            <button
                              onClick={() => reorderExercise(w.id, we.id, 'down')}
                              disabled={exIdx === w.enriched.length - 1}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-20"
                            >
                              <ArrowDown size={11} className="text-gray-400" />
                            </button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {info?.exercise_type === 'cardio' && <span className="mr-1">🏃</span>}
                              {info?.name ?? 'Exercice inconnu'}
                            </p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {(info?.muscles_primary ?? []).slice(0, 2).map(m => (
                                <span key={m} className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                                  {MUSCLE_LABELS[m]}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {/* Edit button */}
                            <button
                              onClick={() => setEditExSheet({
                                open: true,
                                workoutId: w.id,
                                exerciseId: we.id,
                                workRepsPerSet: [...we.work_reps_per_set],
                                workLoadsPerSet: [...we.work_loads],
                                warmupRepsPerSet: [...we.warmup_reps_per_set],
                                warmupLoadsPerSet: [...we.warmup_loads],
                              })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <Pencil size={13} className="text-gray-400" />
                            </button>
                            {/* Delete button */}
                            <button
                              onClick={() => removeExerciseFromWorkout(w.id, we.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </div>

                        {/* Sets summary */}
                        {we.work_sets > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Array(we.work_sets).fill(0).map((_, i) => (
                              <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                                <span className="text-[10px] font-black text-gray-400">S{i + 1}</span>
                                <span className="text-[11px] font-bold text-gray-700">
                                  {we.work_reps_per_set[i] ?? '?'}r
                                </span>
                                {(we.work_loads[i] ?? 0) > 0 && (
                                  <span className="text-[11px] font-bold text-orange-500">
                                    · {we.work_loads[i]}kg
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {we.warmup_sets > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Array(we.warmup_sets).fill(0).map((_, i) => (
                              <div key={i} className="flex items-center gap-1 bg-amber-50 rounded-lg px-2 py-1">
                                <span className="text-[10px] font-black text-amber-400">É{i + 1}</span>
                                <span className="text-[11px] font-bold text-gray-700">
                                  {we.warmup_reps_per_set[i] ?? '?'}r
                                </span>
                                {(we.warmup_loads[i] ?? 0) > 0 && (
                                  <span className="text-[11px] font-bold text-orange-500">
                                    · {we.warmup_loads[i]}kg
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rename program sheet */}
        <BottomSheet isOpen={renameProgramSheet.open} onClose={() => setRenameProgramSheet({ open: false, name: '' })} title="Renommer le programme">
          <div className="space-y-4 pb-4">
            <input
              type="text" value={renameProgramSheet.name}
              onChange={e => setRenameProgramSheet(s => ({ ...s, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveProgramRename() }}
              placeholder="Nom du programme"
              autoFocus
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
            />
            <button onClick={saveProgramRename} disabled={!renameProgramSheet.name.trim()}
              className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40">
              Renommer
            </button>
          </div>
        </BottomSheet>

        {/* Create new workout sheet */}
        <BottomSheet isOpen={detailNewWorkoutSheet.open} onClose={() => setDetailNewWorkoutSheet({ open: false, name: '' })} title="Nouvelle séance">
          <div className="space-y-4 pb-4">
            <input
              type="text" value={detailNewWorkoutSheet.name}
              onChange={e => setDetailNewWorkoutSheet(s => ({ ...s, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') createWorkoutInDetail() }}
              placeholder="Ex: Push, Pull, Legs..."
              autoFocus
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
            />
            <button onClick={createWorkoutInDetail} disabled={!detailNewWorkoutSheet.name.trim()}
              className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40">
              Créer la séance
            </button>
          </div>
        </BottomSheet>

        {/* Delete workout confirm modal */}
        {deleteWorkoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xl font-black text-gray-950">Supprimer cette séance ?</p>
                <p className="text-sm text-gray-400">Les exercices associés seront aussi supprimés.</p>
              </div>
              <button onClick={() => deleteWorkoutInDetail(deleteWorkoutConfirm)}
                className="w-full bg-red-500 text-white font-bold rounded-2xl min-h-[52px] flex items-center justify-center active:scale-[0.97] transition-all">
                Oui, supprimer
              </button>
              <button onClick={() => setDeleteWorkoutConfirm(null)}
                className="w-full bg-gray-100 text-gray-700 font-bold rounded-2xl min-h-[52px] flex items-center justify-center active:scale-[0.97] transition-all">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Exercise edit sheet */}
        {editExSheet && (
          <BottomSheet isOpen={editExSheet.open} onClose={() => setEditExSheet(null)} title="Modifier l'exercice">
            <div className="space-y-4 pb-4">
              {/* Work sets */}
              {editExSheet.workRepsPerSet.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Séries de travail</p>
                  {editExSheet.workRepsPerSet.map((reps, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <span className="text-xs font-black text-gray-400 w-6">S{i + 1}</span>
                      {/* Reps */}
                      <div className="flex items-center gap-1.5 flex-1">
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.workRepsPerSet]; r[i] = Math.max(1, r[i] - 1); return { ...s, workRepsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-gray-100">−</button>
                        <span className="text-sm font-black text-gray-900 w-8 text-center tabular-nums">{reps}r</span>
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.workRepsPerSet]; r[i] = r[i] + 1; return { ...s, workRepsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-gray-100">+</button>
                      </div>
                      {/* Load */}
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.workLoadsPerSet]; r[i] = Math.max(0, +(r[i] - 2.5).toFixed(2)); return { ...s, workLoadsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-gray-100">−</button>
                        <span className="text-sm font-black text-orange-500 w-12 text-center tabular-nums">{editExSheet.workLoadsPerSet[i] ?? 0}kg</span>
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.workLoadsPerSet]; r[i] = +(r[i] + 2.5).toFixed(2); return { ...s, workLoadsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-gray-100">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Warmup sets */}
              {editExSheet.warmupRepsPerSet.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Échauffement</p>
                  {editExSheet.warmupRepsPerSet.map((reps, i) => (
                    <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5">
                      <span className="text-xs font-black text-amber-400 w-6">É{i + 1}</span>
                      <div className="flex items-center gap-1.5 flex-1">
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.warmupRepsPerSet]; r[i] = Math.max(1, r[i] - 1); return { ...s, warmupRepsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-amber-100">−</button>
                        <span className="text-sm font-black text-gray-900 w-8 text-center tabular-nums">{reps}r</span>
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.warmupRepsPerSet]; r[i] = r[i] + 1; return { ...s, warmupRepsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-amber-100">+</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.warmupLoadsPerSet]; r[i] = Math.max(0, +(r[i] - 2.5).toFixed(2)); return { ...s, warmupLoadsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-amber-100">−</button>
                        <span className="text-sm font-black text-orange-500 w-12 text-center tabular-nums">{editExSheet.warmupLoadsPerSet[i] ?? 0}kg</span>
                        <button onClick={() => setEditExSheet(s => {
                          if (!s) return s; const r = [...s.warmupLoadsPerSet]; r[i] = +(r[i] + 2.5).toFixed(2); return { ...s, warmupLoadsPerSet: r }
                        })} className="w-7 h-7 rounded-lg bg-white border border-amber-200 text-gray-700 font-bold text-sm flex items-center justify-center active:bg-amber-100">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={saveExerciseEdit}
                className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
                Enregistrer
              </button>
            </div>
          </BottomSheet>
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: list
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-white min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Programmes</h1>
            <p className="text-gray-400 text-sm mt-0.5">{programs.length} programme{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={startCreate}
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
              <button
                key={p.id}
                onClick={() => openProgramDetail(p)}
                className="w-full bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4 text-left active:scale-[0.98] transition-transform"
              >
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
                            <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{w.name || 'Séance sans nom'}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{w.workout_exercises.length} ex.</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p.id) }}
                      className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                    <ChevronRight size={16} className="text-gray-300 self-center ml-1" />
                  </div>
                </div>
              </button>
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
          <button onClick={() => setDeleteConfirm(null)}
            className="w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center border border-gray-100 shadow-sm">
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
