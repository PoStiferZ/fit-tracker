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
    setForm(f => ({ ...f, work_sets: val, work_loads: resizeLoads(f.work_loads, n) }))
  }
  function setWarmupSets(val: string) {
    const n = parseInt(val) || 0
    setForm(f => ({ ...f, warmup_sets: val, warmup_loads: resizeLoads(f.warmup_loads, n) }))
  }
  function toggleHasWarmup(val: boolean) {
    setForm(f => ({ ...f, has_warmup: val, warmup_sets: val ? f.warmup_sets : '', warmup_reps: val ? f.warmup_reps : '', warmup_loads: val ? f.warmup_loads : [] }))
  }

  function updateWorkLoad(i: number, val: string) {
    setForm(f => { const loads = [...f.work_loads]; loads[i] = val; return { ...f, work_loads: loads } })
  }
  function updateWarmupLoad(i: number, val: string) {
    setForm(f => { const loads = [...f.warmup_loads]; loads[i] = val; return { ...f, warmup_loads: loads } })
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
                      {ex.work_sets}×{ex.work_reps} reps
                      {ex.warmup_sets > 0 && <span className="ml-1.5 text-orange-400">· {ex.warmup_sets} échauff.</span>}
                    </p>
                    {ex.muscles.length > 0 && (
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
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">💪 Séries de travail</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-semibold">Nb séries</p>
                <input type="number" inputMode="numeric" min={1} max={10}
                  value={form.work_sets}
                  onChange={e => setWorkSets(e.target.value)}
                  placeholder="0"
                  className={inputField + ' text-center font-bold text-xl'} />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-semibold">Nb reps</p>
                <input type="number" inputMode="numeric" min={1} max={100}
                  value={form.work_reps}
                  onChange={e => setForm(f => ({ ...f, work_reps: e.target.value }))}
                  placeholder="0"
                  className={inputField + ' text-center font-bold text-xl'} />
              </div>
            </div>
            {workSetsNum > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 font-semibold mb-2">Charges par série</p>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: workSetsNum }).map((_, i) => (
                    <div key={i}>
                      <p className="text-[10px] text-gray-400 mb-1 font-semibold text-center">Série {i + 1}</p>
                      <div className="relative">
                        <input type="number" inputMode="decimal" min={0} step={0.5}
                          value={form.work_loads[i] ?? ''}
                          onChange={e => updateWorkLoad(i, e.target.value)}
                          placeholder="0"
                          className={inputField + ' text-center font-bold py-3 pr-7 text-sm'} />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-semibold pointer-events-none">kg</span>
                      </div>
                    </div>
                  ))}
                </div>
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

          {/* Séries d'échauffement — conditional */}
          {form.has_warmup && (
            <div className="bg-orange-50 rounded-2xl p-4 space-y-3 border border-orange-100">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">🔥 Séries d&apos;échauffement</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-orange-400 mb-1.5 font-semibold">Nb séries</p>
                  <input type="number" inputMode="numeric" min={1} max={10}
                    value={form.warmup_sets}
                    onChange={e => setWarmupSets(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white border border-orange-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-orange-400 transition-all" />
                </div>
                <div>
                  <p className="text-xs text-orange-400 mb-1.5 font-semibold">Nb reps</p>
                  <input type="number" inputMode="numeric" min={1} max={100}
                    value={form.warmup_reps}
                    onChange={e => setForm(f => ({ ...f, warmup_reps: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-white border border-orange-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-orange-400 transition-all" />
                </div>
              </div>
              {warmupSetsNum > 0 && (
                <div>
                  <p className="text-[11px] text-orange-400 font-semibold mb-2">Charges par série</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: warmupSetsNum }).map((_, i) => (
                      <div key={i}>
                        <p className="text-[10px] text-orange-400 mb-1 font-semibold text-center">Série {i + 1}</p>
                        <div className="relative">
                          <input type="number" inputMode="decimal" min={0} step={0.5}
                            value={form.warmup_loads[i] ?? ''}
                            onChange={e => updateWarmupLoad(i, e.target.value)}
                            placeholder="0"
                            className="w-full bg-white border border-orange-200 rounded-2xl px-2 py-3 text-gray-900 text-sm font-bold text-center placeholder:text-gray-300 focus:outline-none focus:border-orange-400 transition-all pr-7" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-orange-300 font-semibold pointer-events-none">kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
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
