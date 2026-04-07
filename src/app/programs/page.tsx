'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import type { Program, Workout, WorkoutExercise } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import ExerciseLibrary from '@/components/ExerciseLibrary'
import { Plus, ClipboardList, Trash2, Pencil, ChevronLeft, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type View = 'list' | 'program-name' | 'workouts' | 'exercise-library'

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

interface ProgramWithWorkouts extends Program {
  workouts: WorkoutWithExercises[]
}
interface WorkoutWithExercises extends Workout {
  workout_exercises: WorkoutExercise[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithWorkouts[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // View state machine
  const [view, setView] = useState<View>('list')
  const [draft, setDraft] = useState<ProgramDraft>({ id: null, name: '', workouts: [] })
  const [activeWorkoutIdx, setActiveWorkoutIdx] = useState<number | null>(null)

  // Workout name bottom sheet
  const [workoutSheet, setWorkoutSheet] = useState<{ open: boolean; name: string; idx: number | null }>({
    open: false, name: '', idx: null,
  })

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
          .from('workouts').select('*, workout_exercises(*)')
          .eq('program_id', p.id).order('order_index')
        return { ...p, workouts: (wks || []) as WorkoutWithExercises[] }
      })
    )
    setPrograms(withWorkouts)
    setLoading(false)
  }

  // ── Navigation helpers ──────────────────────────────────────────────────────
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

  // ── Workout sheet logic ─────────────────────────────────────────────────────
  function openWorkoutSheet(idx: number | null) {
    const name = idx !== null ? (draft.workouts[idx]?.name ?? '') : ''
    setWorkoutSheet({ open: true, name, idx })
  }

  function confirmWorkoutSheet() {
    const name = workoutSheet.name.trim() || 'Séance'
    if (workoutSheet.idx !== null) {
      // Rename existing
      setDraft(d => ({
        ...d,
        workouts: d.workouts.map((w, i) => i === workoutSheet.idx ? { ...w, name } : w),
      }))
      setWorkoutSheet({ open: false, name: '', idx: null })
    } else {
      // Create new → go to library
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

  // ── Save ────────────────────────────────────────────────────────────────────
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
      const wPayload = {
        profile_id: profileId,
        program_id: programId,
        name: w.name || 'Séance',
        order_index: w.order_index,
      }
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
  // VIEW: exercise-library (full page — rendered outside main div)
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'exercise-library') {
    return (
      <ExerciseLibrary
        fullPage
        isOpen={true}
        onClose={() => setView('workouts')}
        onConfirm={addExercisesToWorkout}
      />
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: program-name
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'program-name') {
    return (
      <div className="h-[100dvh] bg-[#f8f8fb] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button onClick={() => setView('list')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 text-lg flex-1">
            {draft.id ? 'Modifier le programme' : 'Nouveau programme'}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-8">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom du programme</label>
          <input
            type="text"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && draft.name.trim()) setView('workouts') }}
            placeholder="Ex: Push Pull Legs, Full Body..."
            autoFocus
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-lg font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
          />
        </div>

        {/* Footer button */}
        <div className="shrink-0 px-5 pt-4 bg-[#f8f8fb]"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button
            onClick={() => { if (draft.name.trim()) setView('workouts') }}
            disabled={!draft.name.trim()}
            className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[56px] flex items-center justify-center gap-2 text-base active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40 disabled:shadow-none"
          >
            Suivant →
          </button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: workouts
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'workouts') {
    return (
      <div className="h-[100dvh] bg-[#f8f8fb] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 bg-white border-b border-gray-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}>
          <button onClick={() => setView('program-name')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 text-lg flex-1 truncate">{draft.name}</h1>
          <button
            onClick={() => openWorkoutSheet(null)}
            className="flex items-center gap-1.5 bg-gray-950 text-white px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform shrink-0"
          >
            <Plus size={15} /> Séance
          </button>
        </div>

        {/* Scrollable content */}
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

        {/* Footer: save button */}
        <div className="shrink-0 px-4 pt-3 bg-[#f8f8fb] border-t border-gray-100"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          <button
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
            className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center gap-2 text-base active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-40 disabled:shadow-none"
          >
            {saving ? 'Enregistrement...' : draft.id ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>

        {/* Workout name bottom sheet */}
        <BottomSheet
          isOpen={workoutSheet.open}
          onClose={() => setWorkoutSheet(s => ({ ...s, open: false }))}
          title={workoutSheet.idx !== null ? 'Renommer la séance' : 'Nouvelle séance'}
        >
          <div className="space-y-4 pb-4">
            <input
              type="text"
              value={workoutSheet.name}
              onChange={e => setWorkoutSheet(s => ({ ...s, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') confirmWorkoutSheet() }}
              placeholder="Ex: Push, Pull, Legs..."
              autoFocus
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 text-gray-900 font-bold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
            />
            <button
              onClick={confirmWorkoutSheet}
              className={cn(
                'w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]',
                !workoutSheet.name.trim() && 'opacity-40'
              )}
            >
              {workoutSheet.idx !== null ? 'Renommer' : 'Suivant →'}
            </button>
          </div>
        </BottomSheet>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW: list (default)
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Programmes</h1>
            <p className="text-gray-400 text-sm mt-0.5">{programs.length} programme{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform"
          >
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
                            <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{w.name || 'Séance sans nom'}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{w.workout_exercises.length} ex.</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    <button onClick={() => startEdit(p)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
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
          <button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.3)] active:scale-[0.98] transition-all"
          >Supprimer</button>
          <button onClick={() => setDeleteConfirm(null)} className="w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center border border-gray-100 shadow-sm">
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
