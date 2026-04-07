'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import type { AnyExercise, MuscleGroup, Equipment, ExerciseType, WorkoutExercise } from '@/types'
import BottomSheet from '@/components/BottomSheet'
import { Search, Plus, Check, ChevronLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Rest helpers ─────────────────────────────────────────────────────────────
function formatRest(s: number): string {
  if (s === 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  if (sec === 0) return `${m}min`
  return `${m}min${sec}s`
}

// ─── NumberPickerSheet ────────────────────────────────────────────────────────
// Generic picker for a single number (reps, kg, etc.)
function NumberPickerSheet({
  isOpen,
  title,
  value,
  min,
  max,
  step,
  unit,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  title: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onClose: () => void
  onConfirm: (v: number) => void
}) {
  const [val, setVal] = useState(value)
  useEffect(() => { setVal(value) }, [value, isOpen])
  const dec = () => setVal(v => Math.max(min, +(v - step).toFixed(2)))
  const inc = () => setVal(v => Math.min(max, +(v + step).toFixed(2)))
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6 pb-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-5">
            <button onClick={dec} className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 font-bold text-2xl flex items-center justify-center active:bg-gray-200">−</button>
            <span className="w-24 text-center text-4xl font-black text-gray-900 tabular-nums">{val}</span>
            <button onClick={inc} className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 font-bold text-2xl flex items-center justify-center active:bg-gray-200">+</button>
          </div>
          {unit && <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{unit}</span>}
        </div>
        <button
          onClick={() => onConfirm(val)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]"
        >Valider</button>
      </div>
    </BottomSheet>
  )
}

// ─── RestPickerSheet ──────────────────────────────────────────────────────────
function RestPickerSheet({
  isOpen,
  value,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  value: number
  onClose: () => void
  onConfirm: (seconds: number) => void
}) {
  const [mins, setMins] = useState(Math.floor(value / 60))
  const [secs, setSecs] = useState(value % 60)

  useEffect(() => {
    setMins(Math.floor(value / 60))
    setSecs(value % 60)
  }, [value, isOpen])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Temps de repos">
      <div className="space-y-6 pb-4">
        <div className="flex gap-6 justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Minutes</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setMins(m => Math.max(0, m - 1))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">−</button>
              <span className="w-10 text-center text-2xl font-black text-gray-900">{mins}</span>
              <button onClick={() => setMins(m => Math.min(60, m + 1))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">+</button>
            </div>
          </div>
          <div className="flex items-center pt-6"><span className="text-2xl font-black text-gray-300">:</span></div>
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Secondes</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setSecs(s => Math.max(0, s - 5))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">−</button>
              <span className="w-10 text-center text-2xl font-black text-gray-900">{String(secs).padStart(2, '0')}</span>
              <button onClick={() => setSecs(s => Math.min(59, s + 5))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">+</button>
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-gray-400 font-medium">{formatRest(mins * 60 + secs)}</div>
        <button
          onClick={() => onConfirm(mins * 60 + secs)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]"
        >Valider</button>
      </div>
    </BottomSheet>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConfiguredExercise {
  exercise: AnyExercise
  workSets: number
  workRepsPerSet: number[]
  workLoadsPerSet: number[]
  workRestSeconds: number[]
  warmupEnabled: boolean
  warmupSets: number
  warmupRepsPerSet: number[]
  warmupLoadsPerSet: number[]
  warmupRestSeconds: number[]
  // cardio
  cardioSets: number
  cardioDurations: number[]
  cardioInclines: number[]
  cardioSpeeds: number[]
  cardioRestSeconds: number[]
}

interface ExerciseLibraryProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (exercises: Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'>[]) => void
  fullPage?: boolean
}

const MUSCLE_FILTERS: { key: MuscleGroup | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'rear_delts', label: 'Rear Delts' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'forearms', label: 'Forearms' },
  { key: 'traps', label: 'Traps' },
  { key: 'core', label: 'Core' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'calves', label: 'Calves' },
  { key: 'inner_thighs', label: 'Inner Thighs' },
  { key: 'cardio', label: 'Cardio' },
]

const EQUIPMENT_FILTERS: { key: Equipment | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'cable', label: 'Cable' },
  { key: 'machine', label: 'Machine' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'cardio', label: 'Cardio' },
]

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', rear_delts: 'Rear Delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', traps: 'Traps',
  core: 'Core', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', inner_thighs: 'Inner Thighs', cardio: 'Cardio',
}

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable',
  machine: 'Machine', bodyweight: 'Bodyweight', cardio: 'Cardio',
}

function makeConfig(exercise: AnyExercise): ConfiguredExercise {
  const isCardio = exercise.exercise_type === 'cardio'
  return {
    exercise,
    workSets: isCardio ? 0 : 3,
    workRepsPerSet: isCardio ? [] : Array(3).fill(10),
    workLoadsPerSet: isCardio ? [] : Array(3).fill(0),
    workRestSeconds: isCardio ? [] : Array(3).fill(90),
    warmupEnabled: false,
    warmupSets: 2,
    warmupRepsPerSet: Array(2).fill(10),
    warmupLoadsPerSet: Array(2).fill(0),
    warmupRestSeconds: Array(2).fill(60),
    cardioSets: isCardio ? 1 : 0,
    cardioDurations: isCardio ? [20] : [],
    cardioInclines: isCardio ? [0] : [],
    cardioSpeeds: isCardio ? [8] : [],
    cardioRestSeconds: isCardio ? [60] : [],
  }
}

function configToWorkoutExercise(
  cfg: ConfiguredExercise,
  orderIndex: number
): Omit<WorkoutExercise, 'id' | 'workout_id' | 'created_at' | 'updated_at'> {
  const isCustom = cfg.exercise.source === 'custom'
  return {
    library_exercise_id: isCustom ? null : cfg.exercise.id,
    custom_exercise_id: isCustom ? cfg.exercise.id : null,
    source: cfg.exercise.source,
    order_index: orderIndex,
    superset_with: null,
    work_sets: cfg.workSets,
    work_reps_per_set: cfg.workRepsPerSet,
    work_loads: cfg.workLoadsPerSet,
    work_rest_seconds: cfg.workRestSeconds,
    warmup_sets: cfg.warmupEnabled ? cfg.warmupSets : 0,
    warmup_reps_per_set: cfg.warmupEnabled ? cfg.warmupRepsPerSet : [],
    warmup_loads: cfg.warmupEnabled ? cfg.warmupLoadsPerSet : [],
    warmup_rest_seconds: cfg.warmupEnabled ? cfg.warmupRestSeconds : [],
    cardio_sets: cfg.cardioSets,
    cardio_durations: cfg.cardioDurations,
    cardio_inclines: cfg.cardioInclines,
    cardio_speeds: cfg.cardioSpeeds,
    cardio_rest_seconds: cfg.cardioRestSeconds,
  }
}

// ─── Create Custom Exercise Sheet ────────────────────────────────────────────
function CreateCustomSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (ex: AnyExercise) => void
}) {
  const [name, setName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleGroup[]>([])
  const [saving, setSaving] = useState(false)

  const MUSCLES: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'rear_delts', 'biceps', 'triceps',
    'forearms', 'traps', 'core', 'quads', 'hamstrings', 'glutes',
    'calves', 'inner_thighs', 'cardio',
  ]

  async function handleCreate() {
    if (!name.trim()) return
    const profileId = getProfileId()!
    setSaving(true)
    const { data } = await supabase.from('custom_exercises').insert({
      profile_id: profileId,
      name: name.trim(),
      exercise_type: exerciseType,
      equipment,
      muscles_primary: primaryMuscles,
      muscles_secondary: [],
    }).select().single()
    setSaving(false)
    if (data) {
      onCreated({ ...data, source: 'custom' } as AnyExercise)
      setName(''); setPrimaryMuscles([]); setExerciseType('strength'); setEquipment('barbell')
      onClose()
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Nouvel exercice">
      <div className="space-y-4 pb-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Ex: Développé couché..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Type</label>
          <div className="flex gap-2">
            {(['strength', 'cardio'] as ExerciseType[]).map(t => (
              <button key={t} onClick={() => setExerciseType(t)}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all',
                  exerciseType === t ? 'bg-gray-950 text-white border-gray-950' : 'border-gray-200 text-gray-500'
                )}>
                {t === 'strength' ? '🏋️ Force' : '🏃 Cardio'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Équipement</label>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_FILTERS.filter(e => e.key !== 'all').map(({ key, label }) => (
              <button key={key} onClick={() => setEquipment(key as Equipment)}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                  equipment === key ? 'bg-gray-950 text-white border-gray-950' : 'border-gray-200 text-gray-500'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Muscles principaux</label>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.map(m => (
              <button key={m} onClick={() => setPrimaryMuscles(prev =>
                prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
              )}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                  primaryMuscles.includes(m) ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500'
                )}>
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleCreate} disabled={saving || !name.trim()}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? 'Création...' : 'Créer l\'exercice'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── Exercise Config Form ─────────────────────────────────────────────────────
function ExerciseConfigForm({
  cfg,
  onChange,
}: {
  cfg: ConfiguredExercise
  onChange: (updated: ConfiguredExercise) => void
}) {
  const isCardio = cfg.exercise.exercise_type === 'cardio'
  const [restPickerOpen, setRestPickerOpen] = useState<{ setType: 'work' | 'warmup' | 'cardio'; index: number } | null>(null)
  const [numPickerOpen, setNumPickerOpen] = useState<{ setType: 'work' | 'warmup'; field: 'reps' | 'kg'; index: number } | null>(null)

  // ── Propagation helper: update index i and cascade to i+1, i+2...
  function propagate<T>(arr: T[], index: number, value: T): T[] {
    return arr.map((v, j) => j >= index ? value : v)
  }

  function setWorkSets(n: number) {
    const sets = Math.max(1, n)
    onChange({
      ...cfg,
      workSets: sets,
      workRepsPerSet: Array(sets).fill(0).map((_, i) => cfg.workRepsPerSet[i] ?? 10),
      workLoadsPerSet: Array(sets).fill(0).map((_, i) => cfg.workLoadsPerSet[i] ?? 0),
      workRestSeconds: Array(sets).fill(0).map((_, i) => cfg.workRestSeconds[i] ?? 90),
    })
  }

  function setWarmupSets(n: number) {
    const sets = Math.max(1, n)
    onChange({
      ...cfg,
      warmupSets: sets,
      warmupRepsPerSet: Array(sets).fill(0).map((_, i) => cfg.warmupRepsPerSet[i] ?? 10),
      warmupLoadsPerSet: Array(sets).fill(0).map((_, i) => cfg.warmupLoadsPerSet[i] ?? 0),
      warmupRestSeconds: Array(sets).fill(0).map((_, i) => cfg.warmupRestSeconds[i] ?? 60),
    })
  }

  function setCardioSets(n: number) {
    const sets = Math.max(1, n)
    onChange({
      ...cfg,
      cardioSets: sets,
      cardioDurations: Array(sets).fill(0).map((_, i) => cfg.cardioDurations[i] ?? 20),
      cardioInclines: Array(sets).fill(0).map((_, i) => cfg.cardioInclines[i] ?? 0),
      cardioSpeeds: Array(sets).fill(0).map((_, i) => cfg.cardioSpeeds[i] ?? 8),
      cardioRestSeconds: Array(sets).fill(0).map((_, i) => cfg.cardioRestSeconds[i] ?? 60),
    })
  }

  // Rest confirm — propagates from index downward
  function handleRestConfirm(seconds: number) {
    if (!restPickerOpen) return
    const { setType, index } = restPickerOpen
    if (setType === 'work') {
      onChange({ ...cfg, workRestSeconds: propagate(cfg.workRestSeconds, index, seconds) })
    } else if (setType === 'warmup') {
      onChange({ ...cfg, warmupRestSeconds: propagate(cfg.warmupRestSeconds, index, seconds) })
    } else {
      onChange({ ...cfg, cardioRestSeconds: propagate(cfg.cardioRestSeconds, index, seconds) })
    }
    setRestPickerOpen(null)
  }

  const currentRestValue = restPickerOpen === null ? 0
    : restPickerOpen.setType === 'work' ? (cfg.workRestSeconds[restPickerOpen.index] ?? 90)
    : restPickerOpen.setType === 'warmup' ? (cfg.warmupRestSeconds[restPickerOpen.index] ?? 60)
    : (cfg.cardioRestSeconds[restPickerOpen.index] ?? 60)

  // Number (reps/kg) confirm — propagates from index downward
  function handleNumConfirm(value: number) {
    if (!numPickerOpen) return
    const { setType, field, index } = numPickerOpen
    if (setType === 'work') {
      if (field === 'reps') onChange({ ...cfg, workRepsPerSet: propagate(cfg.workRepsPerSet, index, value) })
      else onChange({ ...cfg, workLoadsPerSet: propagate(cfg.workLoadsPerSet, index, value) })
    } else {
      if (field === 'reps') onChange({ ...cfg, warmupRepsPerSet: propagate(cfg.warmupRepsPerSet, index, value) })
      else onChange({ ...cfg, warmupLoadsPerSet: propagate(cfg.warmupLoadsPerSet, index, value) })
    }
    setNumPickerOpen(null)
  }

  const currentNumValue = numPickerOpen === null ? 0
    : numPickerOpen.setType === 'work'
      ? (numPickerOpen.field === 'reps' ? (cfg.workRepsPerSet[numPickerOpen.index] ?? 10) : (cfg.workLoadsPerSet[numPickerOpen.index] ?? 0))
      : (numPickerOpen.field === 'reps' ? (cfg.warmupRepsPerSet[numPickerOpen.index] ?? 10) : (cfg.warmupLoadsPerSet[numPickerOpen.index] ?? 0))

  const numPickerConfig = numPickerOpen === null ? null
    : numPickerOpen.field === 'reps'
      ? { title: 'Répétitions', min: 1, max: 100, step: 1, unit: 'reps' }
      : { title: 'Charge', min: 0, max: 500, step: 0.5, unit: 'kg' }

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm">{cfg.exercise.name}</p>
          <div className="flex gap-1 mt-1 flex-wrap">
            {cfg.exercise.muscles_primary.slice(0, 2).map(m => (
              <span key={m} className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                {MUSCLE_LABELS[m]}
              </span>
            ))}
            <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
              {EQUIPMENT_LABELS[cfg.exercise.equipment]}
            </span>
          </div>
        </div>
      </div>

      {isCardio ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-24">Sets cardio</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setCardioSets(cfg.cardioSets - 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">−</button>
              <span className="w-6 text-center font-bold text-gray-900">{cfg.cardioSets}</span>
              <button onClick={() => setCardioSets(cfg.cardioSets + 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">+</button>
            </div>
          </div>
          {Array(cfg.cardioSets).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-gray-400">Set {i + 1}</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Durée (min)</p>
                  <input type="number" min={1} value={cfg.cardioDurations[i] ?? 20}
                    onChange={e => { const d = [...cfg.cardioDurations]; d[i] = parseInt(e.target.value) || 0; onChange({ ...cfg, cardioDurations: d }) }}
                    className="w-full bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 text-gray-900 text-xs font-bold text-center focus:outline-none" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Inclinaison</p>
                  <input type="number" min={0} value={cfg.cardioInclines[i] ?? 0}
                    onChange={e => { const d = [...cfg.cardioInclines]; d[i] = parseInt(e.target.value) || 0; onChange({ ...cfg, cardioInclines: d }) }}
                    className="w-full bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 text-gray-900 text-xs font-bold text-center focus:outline-none" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Vitesse</p>
                  <input type="number" min={0} step={0.5} value={cfg.cardioSpeeds[i] ?? 8}
                    onChange={e => { const d = [...cfg.cardioSpeeds]; d[i] = parseFloat(e.target.value) || 0; onChange({ ...cfg, cardioSpeeds: d }) }}
                    className="w-full bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 text-gray-900 text-xs font-bold text-center focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-gray-400">Repos :</p>
                <button
                  onClick={() => setRestPickerOpen({ setType: 'cardio', index: i })}
                  className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap"
                >
                  {formatRest(cfg.cardioRestSeconds[i] ?? 60)}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Work sets */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-500 w-24">Séries de travail</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setWorkSets(cfg.workSets - 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">−</button>
              <span className="w-6 text-center font-bold text-gray-900">{cfg.workSets}</span>
              <button onClick={() => setWorkSets(cfg.workSets + 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">+</button>
            </div>
          </div>
          {Array(cfg.workSets).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
              <span className="text-xs font-black text-gray-400 w-6">S{i + 1}</span>
              <button
                onClick={() => setNumPickerOpen({ setType: 'work', field: 'reps', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[42px] text-center"
              >{cfg.workRepsPerSet[i] ?? 10}r</button>
              <button
                onClick={() => setNumPickerOpen({ setType: 'work', field: 'kg', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[46px] text-center"
              >{cfg.workLoadsPerSet[i] ?? 0}kg</button>
              <button
                onClick={() => setRestPickerOpen({ setType: 'work', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap flex-1 text-center"
              >{formatRest(cfg.workRestSeconds[i] ?? 90)}</button>
            </div>
          ))}

          {/* Warmup toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-gray-500">Échauffement</span>
            <button
              onClick={() => onChange({ ...cfg, warmupEnabled: !cfg.warmupEnabled })}
              className={cn(
                'w-11 h-6 rounded-full transition-all relative',
                cfg.warmupEnabled ? 'bg-orange-500' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all',
                cfg.warmupEnabled ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>

          {cfg.warmupEnabled && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 w-24">Séries échauff.</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setWarmupSets(cfg.warmupSets - 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">−</button>
                  <span className="w-6 text-center font-bold text-gray-900">{cfg.warmupSets}</span>
                  <button onClick={() => setWarmupSets(cfg.warmupSets + 1)} className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">+</button>
                </div>
              </div>
              {Array(cfg.warmupSets).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
                  <span className="text-xs font-black text-gray-400 w-6">É{i + 1}</span>
                  <button
                    onClick={() => setNumPickerOpen({ setType: 'warmup', field: 'reps', index: i })}
                    className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[42px] text-center"
                  >{cfg.warmupRepsPerSet[i] ?? 10}r</button>
                  <button
                    onClick={() => setNumPickerOpen({ setType: 'warmup', field: 'kg', index: i })}
                    className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[46px] text-center"
                  >{cfg.warmupLoadsPerSet[i] ?? 0}kg</button>
                  <button
                    onClick={() => setRestPickerOpen({ setType: 'warmup', index: i })}
                    className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap"
                  >
                    {formatRest(cfg.warmupRestSeconds[i] ?? 60)}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {numPickerOpen !== null && numPickerConfig !== null && (
        <NumberPickerSheet
          isOpen={true}
          title={numPickerConfig.title}
          value={currentNumValue}
          min={numPickerConfig.min}
          max={numPickerConfig.max}
          step={numPickerConfig.step}
          unit={numPickerConfig.unit}
          onClose={() => setNumPickerOpen(null)}
          onConfirm={handleNumConfirm}
        />
      )}
      {restPickerOpen !== null && (
        <RestPickerSheet
          isOpen={true}
          value={currentRestValue}
          onClose={() => setRestPickerOpen(null)}
          onConfirm={handleRestConfirm}
        />
      )}
    </div>
  )
}

// ─── Main ExerciseLibrary ─────────────────────────────────────────────────────
export default function ExerciseLibrary({ isOpen, onClose, onConfirm, fullPage }: ExerciseLibraryProps) {
  const [exercises, setExercises] = useState<AnyExercise[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all')
  const [selected, setSelected] = useState<AnyExercise[]>([])
  const [screen, setScreen] = useState<'library' | 'config'>('library')
  const [configs, setConfigs] = useState<ConfiguredExercise[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setScreen('library')
    setSelected([])
    setSearch('')
    setMuscleFilter('all')
    setEquipmentFilter('all')
    loadExercises()
  }, [isOpen])

  async function loadExercises() {
    setLoading(true)
    const profileId = getProfileId()
    const [libRes, customRes] = await Promise.all([
      supabase.from('exercise_library').select('*').order('name'),
      profileId
        ? supabase.from('custom_exercises').select('*').eq('profile_id', profileId).order('name')
        : Promise.resolve({ data: [] }),
    ])
    const lib = (libRes.data || []).map((e: any) => ({ ...e, source: 'library' as const }))
    const custom = (customRes.data || []).map((e: any) => ({ ...e, source: 'custom' as const }))
    setExercises([...lib, ...custom])
    setLoading(false)
  }

  function handleCustomCreated(ex: AnyExercise) {
    setExercises(prev => [...prev, ex])
  }

  const filtered = exercises.filter(ex => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false
    if (muscleFilter !== 'all' && !ex.muscles_primary.includes(muscleFilter)) return false
    if (equipmentFilter !== 'all' && ex.equipment !== equipmentFilter) return false
    return true
  })

  const libraryExs = filtered.filter(e => e.source === 'library')
  const customExs = filtered.filter(e => e.source === 'custom')

  function toggleSelect(ex: AnyExercise) {
    setSelected(prev => {
      const key = `${ex.source}-${ex.id}`
      const exists = prev.some(e => `${e.source}-${e.id}` === key)
      return exists ? prev.filter(e => `${e.source}-${e.id}` !== key) : [...prev, ex]
    })
  }

  function isSelected(ex: AnyExercise) {
    return selected.some(e => `${e.source}-${e.id}` === `${ex.source}-${ex.id}`)
  }

  function handleConfirmSelection() {
    setConfigs(selected.map(makeConfig))
    setScreen('config')
  }

  function handleSaveConfigs() {
    const result = configs.map((cfg, i) => configToWorkoutExercise(cfg, i))
    onConfirm(result)
    onClose()
  }

  function ExerciseItem({ ex }: { ex: AnyExercise }) {
    const sel = isSelected(ex)
    return (
      <button
        onClick={() => toggleSelect(ex)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98]',
          sel ? 'border-gray-950 bg-gray-950' : 'border-gray-100 bg-white hover:border-gray-300'
        )}
      >
        <div className={cn(
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
          sel ? 'bg-white border-white' : 'border-gray-300'
        )}>
          {sel
            ? <Check size={12} className="text-gray-950" strokeWidth={3} />
            : <Plus size={12} className="text-gray-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', sel ? 'text-white' : 'text-gray-900')}>
            {ex.exercise_type === 'cardio' && <span className="mr-1">🏃</span>}
            {ex.name}
          </p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {ex.muscles_primary.slice(0, 2).map(m => (
              <span key={m} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                sel ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
              )}>
                {MUSCLE_LABELS[m]}
              </span>
            ))}
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              sel ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              {EQUIPMENT_LABELS[ex.equipment]}
            </span>
          </div>
        </div>
      </button>
    )
  }

  // ── Library screen content ───────────────────────────────────────────────
  const libraryContent = (
    <div className="space-y-3 pb-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un exercice..."
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition-all"
        />
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      {/* Muscle filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {MUSCLE_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setMuscleFilter(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
              muscleFilter === key ? 'bg-gray-950 text-white border-gray-950' : 'border-gray-200 text-gray-500 bg-white'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Equipment filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {EQUIPMENT_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setEquipmentFilter(key)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
              equipmentFilter === key ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500 bg-white'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* My exercises header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Mes exercices</p>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
          <Plus size={12} /> Créer
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {customExs.length > 0 && (
            <div className="space-y-1.5">
              {customExs.map(ex => <ExerciseItem key={`custom-${ex.id}`} ex={ex} />)}
            </div>
          )}
          {customExs.length === 0 && !search && muscleFilter === 'all' && equipmentFilter === 'all' && (
            <p className="text-xs text-gray-300 text-center py-1 font-medium">Aucun exercice custom — crée-en un !</p>
          )}

          {libraryExs.length > 0 && (
            <>
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider pt-2">Bibliothèque</p>
              <div className="space-y-1.5">
                {libraryExs.map(ex => <ExerciseItem key={`lib-${ex.id}`} ex={ex} />)}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">Aucun résultat</p>
          )}
        </div>
      )}

      {/* Confirm button */}
      {selected.length > 0 && (
        <div className="sticky bottom-0 pt-2">
          <button onClick={handleConfirmSelection}
            className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
            <Check size={18} /> Confirmer ({selected.length})
          </button>
        </div>
      )}
    </div>
  )

  // ── Config screen content ────────────────────────────────────────────────
  const configContent = (
    <div className="space-y-4 pb-4">
      {!fullPage && (
        <button onClick={() => setScreen('library')} className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={16} /> Retour à la bibliothèque
        </button>
      )}
      {configs.map((cfg, i) => (
        <div key={`${cfg.exercise.source}-${cfg.exercise.id}`} className="relative">
          <button
            onClick={() => setConfigs(prev => prev.filter((_, j) => j !== i))}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-200 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
          <ExerciseConfigForm
            cfg={cfg}
            onChange={updated => setConfigs(prev => prev.map((c, j) => j === i ? updated : c))}
          />
        </div>
      ))}
      {configs.length > 0 && (
        <button onClick={handleSaveConfigs}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          <Check size={18} /> Ajouter {configs.length} exercice{configs.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )

  // ── fullPage mode ────────────────────────────────────────────────────────
  if (fullPage) {
    if (!isOpen) return null
    return (
      <>
        <div className="fixed inset-0 z-50 bg-[#f8f8fb] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,16px)] pb-3 bg-white border-b border-gray-100 shrink-0">
            <button
              onClick={screen === 'config' ? () => setScreen('library') : onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="font-black text-gray-900 text-lg flex-1">
              {screen === 'library' ? 'Bibliothèque' : 'Configurer'}
            </h2>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {screen === 'library' ? libraryContent : configContent}
          </div>
        </div>

        <CreateCustomSheet
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCustomCreated}
        />
      </>
    )
  }

  // ── BottomSheet mode (default) ───────────────────────────────────────────
  return (
    <>
      <BottomSheet
        isOpen={isOpen && !createOpen}
        onClose={onClose}
        title={screen === 'library' ? 'Bibliothèque d\'exercices' : 'Configurer les exercices'}
      >
        {screen === 'library' ? libraryContent : configContent}
      </BottomSheet>

      <CreateCustomSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCustomCreated}
      />
    </>
  )
}
