'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { MUSCLES } from '@/lib/constants'
import type { Exercise, ExerciseLoadHistory } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import { Plus, Dumbbell, Trash2, Pencil, Image as ImageIcon, X, History, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const btnPrimary = 'w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none'
const btnSecondary = 'w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100'
const inputField = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

// All numeric values stored as strings in the form to avoid blocking input
type FormState = {
  name: string
  image_url: string
  muscles: string[]
  has_warmup: boolean
  work_sets: string
  work_reps: string
  warmup_sets: string
  warmup_reps: string
  work_loads: string[]   // one per work set
  warmup_loads: string[] // one per warmup set
  exercise_type: 'strength' | 'cardio'
  cardio_sets: string
  cardio_durations: string[]
  cardio_inclines: string[]
  cardio_speeds: string[]
  work_reps_per_set: string[]
  warmup_reps_per_set: string[]
  work_rest_seconds: string[]
  warmup_rest_seconds: string[]
  cardio_rest_seconds: string[]
}

const defaultForm = (): FormState => ({
  name: '',
  image_url: '',
  muscles: [],
  has_warmup: false,
  work_sets: '',
  work_reps: '',
  warmup_sets: '',
  warmup_reps: '',
  work_loads: [],
  warmup_loads: [],
  exercise_type: 'strength',
  cardio_sets: '',
  cardio_durations: [],
  cardio_inclines: [],
  cardio_speeds: [],
  work_reps_per_set: [],
  warmup_reps_per_set: [],
  work_rest_seconds: [],
  warmup_rest_seconds: [],
  cardio_rest_seconds: [],
})

function exerciseToForm(ex: Exercise): FormState {
  const hasWarmup = ex.warmup_sets > 0
  return {
    name: ex.name,
    image_url: ex.image_url || '',
    muscles: ex.muscles,
    has_warmup: hasWarmup,
    work_sets: String(ex.work_sets),
    work_reps: String(ex.work_reps),
    warmup_sets: hasWarmup ? String(ex.warmup_sets) : '',
    warmup_reps: hasWarmup ? String(ex.warmup_reps) : '',
    work_loads: ex.work_loads.map(String),
    warmup_loads: hasWarmup ? ex.warmup_loads.map(String) : [],
    exercise_type: ex.exercise_type ?? 'strength',
    cardio_sets: ex.cardio_sets > 0 ? String(ex.cardio_sets) : '',
    cardio_durations: ex.cardio_durations.map(String),
    cardio_inclines: ex.cardio_inclines.map(String),
    cardio_speeds: ex.cardio_speeds.map(String),
    work_reps_per_set: (ex.work_reps_per_set || []).map(String),
    warmup_reps_per_set: (ex.warmup_reps_per_set || []).map(String),
    work_rest_seconds: (ex.work_rest_seconds || []).map(String),
    warmup_rest_seconds: (ex.warmup_rest_seconds || []).map(String),
    cardio_rest_seconds: (ex.cardio_rest_seconds || []).map(String),
  }
}

function formToPayload(form: FormState) {
  const workSets = parseInt(form.work_sets) || 0
  const warmupSets = form.has_warmup ? (parseInt(form.warmup_sets) || 0) : 0
  return {
    name: form.name.trim(),
    image_url: form.image_url || null,
    muscles: form.muscles,
    work_sets: workSets,
    work_reps: parseInt(form.work_reps) || 0,
    warmup_sets: warmupSets,
    warmup_reps: form.has_warmup ? (parseInt(form.warmup_reps) || 0) : 0,
    work_loads: form.work_loads.slice(0, workSets).map(v => parseFloat(v) || 0),
    warmup_loads: form.has_warmup ? form.warmup_loads.slice(0, warmupSets).map(v => parseFloat(v) || 0) : [],
    exercise_type: form.exercise_type,
    cardio_sets: form.exercise_type === 'cardio' ? (parseInt(form.cardio_sets) || 0) : 0,
    cardio_durations: form.exercise_type === 'cardio'
      ? form.cardio_durations.slice(0, parseInt(form.cardio_sets) || 0).map(v => parseFloat(v) || 0)
      : [],
    cardio_inclines: form.exercise_type === 'cardio'
      ? form.cardio_inclines.slice(0, parseInt(form.cardio_sets) || 0).map(v => parseFloat(v) || 0)
      : [],
    cardio_speeds: form.exercise_type === 'cardio'
      ? form.cardio_speeds.slice(0, parseInt(form.cardio_sets) || 0).map(v => parseFloat(v) || 0)
      : [],
    work_reps_per_set: workSets > 0
      ? form.work_reps_per_set.slice(0, workSets).map(v => parseInt(v) || 0)
      : [],
    warmup_reps_per_set: warmupSets > 0
      ? form.warmup_reps_per_set.slice(0, warmupSets).map(v => parseInt(v) || 0)
      : [],
    work_rest_seconds: workSets > 0
      ? form.work_rest_seconds.slice(0, workSets).map(v => parseInt(v) || 0)
      : [],
    warmup_rest_seconds: warmupSets > 0
      ? form.warmup_rest_seconds.slice(0, warmupSets).map(v => parseInt(v) || 0)
      : [],
    cardio_rest_seconds: form.exercise_type === 'cardio'
      ? form.cardio_rest_seconds.slice(0, parseInt(form.cardio_sets) || 0).map(v => parseInt(v) || 0)
      : [],
  }
}

function loadsChanged(ex: Exercise, form: FormState): boolean {
  const p = formToPayload(form)
  if (ex.work_sets !== p.work_sets || ex.work_reps !== p.work_reps) return true
  if (ex.warmup_sets !== p.warmup_sets || ex.warmup_reps !== p.warmup_reps) return true
  if (ex.work_loads.length !== p.work_loads.length) return true
  for (let i = 0; i < ex.work_loads.length; i++) if (ex.work_loads[i] !== p.work_loads[i]) return true
  if (ex.warmup_loads.length !== p.warmup_loads.length) return true
  for (let i = 0; i < ex.warmup_loads.length; i++) if (ex.warmup_loads[i] !== p.warmup_loads[i]) return true
  return false
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Resize loads array when set count changes (preserve existing values)
function resizeLoads(loads: string[], newSize: number): string[] {
  if (newSize <= 0) return []
  return Array.from({ length: newSize }, (_, i) => loads[i] ?? '')
}

function RestInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const total = parseInt(value) || 0
  const mins = Math.floor(total / 60)
  const secs = total % 60
  function update(m: number, s: number) {
    onChange(String(Math.max(0, m) * 60 + Math.max(0, Math.min(59, s))))
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" inputMode="numeric" min={0} max={99}
        value={mins || ''}
        onChange={e => update(parseInt(e.target.value) || 0, secs)}
        placeholder="0"
        className="w-10 bg-orange-50 border border-orange-200 rounded-lg px-1 py-1.5 text-gray-900 text-xs font-bold text-center placeholder:text-gray-300 focus:outline-none"
      />
      <span className="text-[10px] text-orange-400 font-bold">m</span>
      <input
        type="number" inputMode="numeric" min={0} max={59}
        value={secs || ''}
        onChange={e => update(mins, parseInt(e.target.value) || 0)}
        placeholder="0"
        className="w-10 bg-orange-50 border border-orange-200 rounded-lg px-1 py-1.5 text-gray-900 text-xs font-bold text-center placeholder:text-gray-300 focus:outline-none"
      />
      <span className="text-[10px] text-orange-400 font-bold">s</span>
    </div>
  )
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<ExerciseLoadHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const profileId = getProfileId()
    if (!profileId) return
    supabase.from('exercises').select('*').eq('profile_id', profileId).order('created_at')
      .then(({ data }) => { setExercises(data || []); setLoading(false) })
  }, [])

  function openCreate() {
    setEditId(null); setEditExercise(null); setForm(defaultForm()); setSheetOpen(true)
  }
  function openEdit(ex: Exercise) {
    setEditId(ex.id); setEditExercise(ex); setForm(exerciseToForm(ex)); setSheetOpen(true)
  }

  async function openHistory() {
    if (!editId) return
    const profileId = getProfileId()
    setHistoryLoading(true); setHistorySheetOpen(true)
    const { data } = await supabase
      .from('exercise_load_history').select('*')
      .eq('exercise_id', editId)
      .eq('profile_id', profileId)
      .order('recorded_at', { ascending: false })
    setHistoryEntries(data || []); setHistoryLoading(false)
  }

  function setWorkSets(val: string) {
    const n = parseInt(val) || 0
    setForm(f => ({
      ...f,
      work_sets: val,
      work_loads: resizeLoads(f.work_loads, n),
      work_reps_per_set: resizeLoads(f.work_reps_per_set, n),
      work_rest_seconds: resizeLoads(f.work_rest_seconds, n),
    }))
  }

  function setWarmupSets(val: string) {
    const n = parseInt(val) || 0
    setForm(f => ({
      ...f,
      warmup_sets: val,
      warmup_loads: resizeLoads(f.warmup_loads, n),
      warmup_reps_per_set: resizeLoads(f.warmup_reps_per_set, n),
      warmup_rest_seconds: resizeLoads(f.warmup_rest_seconds, n),
    }))
  }

  function toggleHasWarmup(val: boolean) {
    setForm(f => ({ ...f, has_warmup: val, warmup_sets: val ? f.warmup_sets : '', warmup_reps: val ? f.warmup_reps : '', warmup_loads: val ? f.warmup_loads : [], warmup_reps_per_set: val ? f.warmup_reps_per_set : [], warmup_rest_seconds: val ? f.warmup_rest_seconds : [] }))
  }

  function setCardioSets(val: string) {
    const n = parseInt(val) || 0
    setForm(f => ({
      ...f,
      cardio_sets: val,
      cardio_durations: resizeLoads(f.cardio_durations, n),
      cardio_inclines: resizeLoads(f.cardio_inclines, n),
      cardio_speeds: resizeLoads(f.cardio_speeds, n),
      cardio_rest_seconds: resizeLoads(f.cardio_rest_seconds, n),
    }))
  }
  function updateCardioDuration(i: number, val: string) {
    setForm(f => { const arr = [...f.cardio_durations]; arr[i] = val; return { ...f, cardio_durations: arr } })
  }
  function updateCardioIncline(i: number, val: string) {
    setForm(f => { const arr = [...f.cardio_inclines]; arr[i] = val; return { ...f, cardio_inclines: arr } })
  }
  function updateCardioSpeed(i: number, val: string) {
    setForm(f => { const arr = [...f.cardio_speeds]; arr[i] = val; return { ...f, cardio_speeds: arr } })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    await supabase.storage.from('exercise-images').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('exercise-images').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: data.publicUrl }))
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const profileId = getProfileId()!
    setSaving(true)

    if (editId && editExercise && loadsChanged(editExercise, form)) {
      await supabase.from('exercise_load_history').insert({
        exercise_id: editId,
        profile_id: profileId,
        work_loads: editExercise.work_loads,
        warmup_loads: editExercise.warmup_loads,
        work_sets: editExercise.work_sets,
        work_reps: editExercise.work_reps,
        warmup_sets: editExercise.warmup_sets,
        warmup_reps: editExercise.warmup_reps,
      })
    }

    const payload = formToPayload(form)
    if (editId) {
      const { data } = await supabase.from('exercises').update(payload).eq('id', editId).select().single()
      if (data) setExercises(prev => prev.map(e => e.id === editId ? data : e))
    } else {
      const { data } = await supabase.from('exercises').insert({ ...payload, profile_id: profileId }).select().single()
      if (data) setExercises(prev => [...prev, data])
    }
    setSaving(false); setSheetOpen(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(prev => prev.filter(e => e.id !== id))
    setDeleteConfirm(null)
  }

  function toggleMuscle(m: string) {
    setForm(f => ({ ...f, muscles: f.muscles.includes(m) ? f.muscles.filter(x => x !== m) : [...f.muscles, m] }))
  }

  const workSetsNum = parseInt(form.work_sets) || 0
  const warmupSetsNum = form.has_warmup ? (parseInt(form.warmup_sets) || 0) : 0

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Exercices</h1>
            <p className="text-gray-400 text-sm mt-0.5">{exercises.length} exercice{exercises.length !== 1 ? 's' : ''}</p>
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
        ) : exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
              <Dumbbell size={36} className="text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 text-lg">Aucun exercice</p>
            <p className="text-gray-400 text-sm mt-1">Crée ton premier exercice</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map(ex => (
              <div key={ex.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {ex.image_url ? (
                    <img src={ex.image_url} alt={ex.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Dumbbell size={26} className="text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{ex.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">
                      {ex.exercise_type === 'cardio' ? (
                        <span>🏃 {ex.cardio_sets} série(s)</span>
                      ) : (
                        <>
                          {ex.work_sets}×{ex.work_reps} reps
                          {ex.warmup_sets > 0 && <span className="ml-1.5 text-orange-400">· {ex.warmup_sets} échauff.</span>}
                        </>
                      )}
                    </p>
                    {ex.exercise_type === 'strength' && ex.muscles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {ex.muscles.slice(0, 2).map(m => (
                          <span key={m} className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{m}</span>
                        ))}
                        {ex.muscles.length > 2 && (
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">+{ex.muscles.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(ex)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteConfirm(ex.id)} className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors">
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
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer l'exercice ?">
        <div className="space-y-3 pb-2">
          <p className="text-gray-500 text-sm">Cette action est irréversible.</p>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.3)] active:scale-[0.98] transition-all">
            Supprimer
          </button>
          <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Annuler</button>
        </div>
      </BottomSheet>

      {/* Create / Edit */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? "Modifier l'exercice" : 'Nouvel exercice'}>
        <div className="space-y-6 pb-4">

          {/* Nom */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Développé couché"
              className={inputField + ' font-semibold'} />
          </div>

          {/* Type d'exercice */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['strength', 'cardio'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, exercise_type: t }))}
                  className={cn(
                    'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                    form.exercise_type === t
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                  )}>
                  {t === 'strength' ? '🏋️ Musculation' : '🏃 Cardio'}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Image</label>
            {form.image_url ? (
              <div className="relative">
                <img src={form.image_url} alt="preview" className="w-full h-40 object-cover rounded-2xl" />
                <button onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl py-8 flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors active:bg-gray-50">
                <ImageIcon size={28} className="text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-400">{uploading ? 'Envoi en cours...' : 'Ajouter une image'}</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Strength-only fields */}
          {form.exercise_type === 'strength' && (
            <>
              {/* Muscles */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Muscles {form.muscles.length > 0 && <span className="text-gray-950 normal-case">({form.muscles.length})</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLES.map(m => (
                    <button key={m} type="button" onClick={() => toggleMuscle(m)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95',
                        form.muscles.includes(m)
                          ? 'bg-gray-950 text-white border-gray-950'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400 bg-white'
                      )}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Séries de travail */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Séries de travail</label>
                <input type="number" inputMode="numeric" min={1} max={20}
                  value={form.work_sets}
                  onChange={e => setWorkSets(e.target.value)}
                  placeholder="Nombre de séries"
                  className={inputField + " text-center text-xl font-bold"} />
                {workSetsNum > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 px-1">
                      <div />
                      <p className="text-[10px] font-bold text-gray-400 uppercase text-center">Poids (kg)</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase text-center">Reps</p>
                      <p className="text-[10px] font-bold text-orange-400 uppercase">Repos</p>
                    </div>
                    {Array.from({ length: workSetsNum }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 items-center">
                        <span className="text-xs font-black text-gray-300 text-center">{i + 1}</span>
                        <input type="number" inputMode="decimal" step={0.5} min={0}
                          value={form.work_loads[i] ?? ''}
                          onChange={e => setForm(f => { const a = [...f.work_loads]; a[i] = e.target.value; return { ...f, work_loads: a } })}
                          placeholder="0"
                          className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-gray-900" />
                        <input type="number" inputMode="numeric" min={1}
                          value={form.work_reps_per_set[i] ?? ''}
                          onChange={e => setForm(f => { const a = [...f.work_reps_per_set]; a[i] = e.target.value; return { ...f, work_reps_per_set: a } })}
                          placeholder="0"
                          className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-gray-900" />
                        <RestInput
                          value={form.work_rest_seconds[i] ?? ''}
                          onChange={v => setForm(f => { const a = [...f.work_rest_seconds]; a[i] = v; return { ...f, work_rest_seconds: a } })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle échauffement */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleHasWarmup(!form.has_warmup)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all active:scale-[0.98]',
                    form.has_warmup
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                    form.has_warmup ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                  )}>
                    {form.has_warmup && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Séries d&apos;échauffement</p>
                    <p className="text-xs opacity-60 mt-0.5">Séries légères avant les séries de travail</p>
                  </div>
                </button>
              </div>

              {/* Échauffement — conditional */}
              {form.has_warmup && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Échauffement</label>
                  </div>
                  <input type="number" inputMode="numeric" min={1} max={10}
                    value={form.warmup_sets}
                    onChange={e => setWarmupSets(e.target.value)}
                    placeholder="Nombre de séries"
                    className={inputField + " text-center text-xl font-bold"} />
                  {warmupSetsNum > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 px-1">
                        <div />
                        <p className="text-[10px] font-bold text-gray-400 uppercase text-center">Poids (kg)</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase text-center">Reps</p>
                        <p className="text-[10px] font-bold text-orange-400 uppercase">Repos</p>
                      </div>
                      {Array.from({ length: warmupSetsNum }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_auto] gap-2 items-center">
                          <span className="text-xs font-black text-gray-300 text-center">{i + 1}</span>
                          <input type="number" inputMode="decimal" step={0.5} min={0}
                            value={form.warmup_loads[i] ?? ''}
                            onChange={e => setForm(f => { const a = [...f.warmup_loads]; a[i] = e.target.value; return { ...f, warmup_loads: a } })}
                            placeholder="0"
                            className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-gray-900" />
                          <input type="number" inputMode="numeric" min={1}
                            value={form.warmup_reps_per_set[i] ?? ''}
                            onChange={e => setForm(f => { const a = [...f.warmup_reps_per_set]; a[i] = e.target.value; return { ...f, warmup_reps_per_set: a } })}
                            placeholder="0"
                            className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-gray-900" />
                          <RestInput
                            value={form.warmup_rest_seconds[i] ?? ''}
                            onChange={v => setForm(f => { const a = [...f.warmup_rest_seconds]; a[i] = v; return { ...f, warmup_rest_seconds: a } })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Cardio-only fields */}
          {form.exercise_type === 'cardio' && (
            <div className="bg-sky-50 rounded-2xl p-4 space-y-3 border border-sky-100">
              <p className="text-xs font-bold text-sky-500 uppercase tracking-wider">🏃 Séries cardio</p>
              <div>
                <p className="text-xs text-sky-400 mb-1.5 font-semibold">Nombre de séries</p>
                <input type="number" inputMode="numeric" min={1} max={10}
                  value={form.cardio_sets}
                  onChange={e => setCardioSets(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white border border-sky-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-sky-400 transition-all" />
              </div>
              {(parseInt(form.cardio_sets) || 0) > 0 && (
                <div className="space-y-3">
                  {Array.from({ length: parseInt(form.cardio_sets) || 0 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-3 border border-sky-100">
                      <p className="text-xs font-bold text-sky-400 mb-2">Série {i + 1}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-sky-400 mb-1 font-semibold text-center">Durée (min)</p>
                          <input type="number" inputMode="decimal" min={0} step={0.5}
                            value={form.cardio_durations[i] ?? ''}
                            onChange={e => updateCardioDuration(i, e.target.value)}
                            placeholder="0"
                            className="w-full bg-sky-50 border border-sky-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none transition-all" />
                        </div>
                        <div>
                          <p className="text-[10px] text-sky-400 mb-1 font-semibold text-center">Inclinaison</p>
                          <input type="number" inputMode="decimal" min={0} max={30} step={0.5}
                            value={form.cardio_inclines[i] ?? ''}
                            onChange={e => updateCardioIncline(i, e.target.value)}
                            placeholder="0"
                            className="w-full bg-sky-50 border border-sky-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none transition-all" />
                        </div>
                        <div>
                          <p className="text-[10px] text-sky-400 mb-1 font-semibold text-center">Vitesse</p>
                          <input type="number" inputMode="decimal" min={0} max={30} step={0.1}
                            value={form.cardio_speeds[i] ?? ''}
                            onChange={e => updateCardioSpeed(i, e.target.value)}
                            placeholder="0"
                            className="w-full bg-sky-50 border border-sky-200 rounded-xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none transition-all" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-[10px] text-orange-400 font-semibold">Repos</p>
                        <RestInput
                          value={form.cardio_rest_seconds[i] ?? ''}
                          onChange={v => setForm(f => { const a = [...f.cardio_rest_seconds]; a[i] = v; return { ...f, cardio_rest_seconds: a } })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !form.name.trim()} className={btnPrimary}>
            {saving ? 'Enregistrement...' : editId ? "Mettre à jour" : "Créer l'exercice"}
          </button>

          {editId && (
            <button onClick={openHistory}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 border-2 border-gray-100 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all text-sm font-semibold min-h-[52px]">
              <History size={16} /> Voir l&apos;historique des charges
            </button>
          )}
        </div>
      </BottomSheet>

      {/* History */}
      <BottomSheet isOpen={historySheetOpen} onClose={() => setHistorySheetOpen(false)} title="Historique des charges">
        <div className="pb-4">
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <History size={28} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-600 text-base">Aucun historique</p>
              <p className="text-gray-400 text-sm mt-1">Les charges seront archivées à chaque modification</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyEntries.map((entry, idx) => (
                <div key={entry.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-wider">
                      {idx === 0 ? 'Précédent' : `Modif. -${idx + 1}`}
                    </span>
                    <span className="text-xs font-semibold text-gray-400">{formatHistoryDate(entry.recorded_at)}</span>
                  </div>
                  <div className="space-y-2">
                    {entry.work_sets > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Travail · {entry.work_sets}×{entry.work_reps} reps
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.work_loads.map((kg, i) => (
                            <span key={i} className="text-xs font-bold bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-xl">
                              S{i + 1}: {kg} kg
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.warmup_sets > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">
                          Échauff. · {entry.warmup_sets}×{entry.warmup_reps} reps
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.warmup_loads.map((kg, i) => (
                            <span key={i} className="text-xs font-bold bg-orange-50 border border-orange-100 text-orange-600 px-2.5 py-1 rounded-xl">
                              S{i + 1}: {kg} kg
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
