'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import type { AnyExercise, LibraryExercise, MuscleGroup, Equipment, ExerciseType, WorkoutExercise } from '@/types'
import BottomSheet from '@/components/BottomSheet'
import { SpeedPickerSheet, InclinePickerSheet } from '@/components/Pickers'
import { Search, Plus, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MUSCLE_IMAGE, getMuscleLabel } from '@/lib/muscles'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

// ─── Rest helpers ─────────────────────────────────────────────────────────────
function formatRest(s: number): string {
  if (s === 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m === 0) return `${sec}s`
  if (sec === 0) return `${m}min`
  return `${m}min${sec}s`
}

// ─── DrumRoll ─────────────────────────────────────────────────────────────────
// A single vertical scroll-snap drum roll column
function DrumRoll({
  items,
  selectedIndex,
  onSelect,
  width = 72,
}: {
  items: (string | number)[]
  selectedIndex: number
  onSelect: (idx: number) => void
  width?: number
}) {
  const ITEM_H = 44
  const VISIBLE = 5 // odd number → center is selected
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)

  // Scroll to selected on mount / change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = selectedIndex * ITEM_H
  }, [selectedIndex])

  function handleScroll() {
    if (isScrolling.current) return
    const el = containerRef.current
    if (!el) return
    isScrolling.current = true
    requestAnimationFrame(() => {
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      onSelect(clamped)
      isScrolling.current = false
    })
  }

  const padCount = Math.floor(VISIBLE / 2)

  return (
    <div className="relative flex flex-col items-center" style={{ width }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 rounded-xl bg-gray-100 pointer-events-none z-10"
        style={{ top: padCount * ITEM_H, height: ITEM_H }}
      />
      {/* Fade top */}
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none"
        style={{ height: padCount * ITEM_H, background: 'linear-gradient(to bottom, rgba(248,248,251,1), rgba(248,248,251,0))' }} />
      {/* Fade bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
        style={{ height: padCount * ITEM_H, background: 'linear-gradient(to top, rgba(248,248,251,1), rgba(248,248,251,0))' }} />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll scrollbar-hide"
        style={{
          height: VISIBLE * ITEM_H,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Top padding */}
        {Array(padCount).fill(null).map((_, i) => (
          <div key={`pad-top-${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'start' }} />
        ))}
        {items.map((item, idx) => (
          <div
            key={idx}
            onClick={() => { onSelect(idx); containerRef.current!.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' }) }}
            style={{ height: ITEM_H, scrollSnapAlign: 'start', width }}
            className={cn(
              'flex items-center justify-center text-lg font-bold tabular-nums transition-colors cursor-pointer',
              idx === selectedIndex ? 'text-gray-950' : 'text-gray-400'
            )}
          >
            {item}
          </div>
        ))}
        {/* Bottom padding */}
        {Array(padCount).fill(null).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'start' }} />
        ))}
      </div>
    </div>
  )
}

// ─── WeightPickerSheet ─────────────────────────────────────────────────────────
// Two drum rolls: integer kg (0–300) + decimal (0, .25, .5, .75)
function WeightPickerSheet({
  isOpen,
  value,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  value: number
  onClose: () => void
  onConfirm: (kg: number) => void
}) {
  const decimals = [0, 0.25, 0.5, 0.75]
  const integers = Array.from({ length: 301 }, (_, i) => i)

  const intVal = Math.floor(value)
  const decVal = decimals.indexOf(+(value % 1).toFixed(2)) === -1 ? 0 : decimals.indexOf(+(value % 1).toFixed(2))

  const [intIdx, setIntIdx] = useState(intVal)
  const [decIdx, setDecIdx] = useState(decVal)

  useEffect(() => {
    if (!isOpen) return
    setIntIdx(Math.floor(value))
    const d = +(value % 1).toFixed(2)
    setDecIdx(decimals.indexOf(d) >= 0 ? decimals.indexOf(d) : 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value])

  const combined = intIdx + decimals[decIdx]

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Charge">
      <div className="pb-4 space-y-5">
        {/* Preview */}
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums">{combined}</span>
          <span className="text-lg font-bold text-gray-400 ml-1">kg</span>
        </div>
        {/* Drum rolls */}
        <div className="flex items-center justify-center gap-2">
          <DrumRoll items={integers} selectedIndex={intIdx} onSelect={setIntIdx} width={80} />
          <span className="text-2xl font-black text-gray-300 pb-1">.</span>
          <DrumRoll
            items={decimals.map(d => d === 0 ? '00' : String(d).slice(2).padEnd(2, '0'))}
            selectedIndex={decIdx}
            onSelect={setDecIdx}
            width={64}
          />
          <span className="text-base font-bold text-gray-400 pb-1">kg</span>
        </div>
        <button
          onClick={() => onConfirm(combined)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]"
        >Valider</button>
      </div>
    </BottomSheet>
  )
}

// ─── RepsPickerSheet ───────────────────────────────────────────────────────────
function RepsPickerSheet({
  isOpen,
  value,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  value: number
  onClose: () => void
  onConfirm: (reps: number) => void
}) {
  const repsItems = Array.from({ length: 100 }, (_, i) => i + 1)
  const [idx, setIdx] = useState(Math.max(0, value - 1))

  useEffect(() => {
    if (isOpen) setIdx(Math.max(0, value - 1))
  }, [isOpen, value])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Répétitions">
      <div className="pb-4 space-y-5">
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums">{idx + 1}</span>
          <span className="text-lg font-bold text-gray-400 ml-1">reps</span>
        </div>
        <div className="flex justify-center">
          <DrumRoll items={repsItems} selectedIndex={idx} onSelect={setIdx} width={80} />
        </div>
        <button
          onClick={() => onConfirm(idx + 1)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]"
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
export interface ConfiguredExercise {
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
  { key: 'outer_thighs', label: 'Outer Thighs' },
  { key: 'neck', label: 'Neck' },
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
  chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', rear_delts: 'Delts arr.',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', traps: 'Trapèzes',
  core: 'Abdos', quads: 'Quadriceps', hamstrings: 'Ischio', glutes: 'Fessiers',
  calves: 'Mollets', inner_thighs: 'Adducteurs', outer_thighs: 'Abducteurs', cardio: 'Cardio', neck: 'Cou',
}

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable',
  machine: 'Machine', bodyweight: 'Bodyweight', cardio: 'Cardio',
}

export function makeConfig(exercise: AnyExercise): ConfiguredExercise {
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

export function configToWorkoutExercise(
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
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'traps', 'core', 'quads', 'hamstrings', 'glutes',
    'calves', 'inner_thighs', 'outer_thighs', 'neck', 'cardio',
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
            {MUSCLES.map(m => {
              const active = primaryMuscles.includes(m)
              const img = MUSCLE_IMAGE[m]
              return (
                <button key={m} onClick={() => setPrimaryMuscles(prev =>
                  prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                )}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                    active ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500'
                  )}>
                  {img && (
                    <Image src={img} alt={m} width={16} height={16} className={cn('object-contain shrink-0', active ? 'brightness-0 invert' : '')} />
                  )}
                  {MUSCLE_LABELS[m]}
                </button>
              )
            })}
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
export function ExerciseConfigForm({
  cfg,
  onChange,
}: {
  cfg: ConfiguredExercise
  onChange: (updated: ConfiguredExercise) => void
}) {
  const isCardio = cfg.exercise.exercise_type === 'cardio'
  const [restPickerOpen, setRestPickerOpen] = useState<{ setType: 'work' | 'warmup' | 'cardio'; index: number } | null>(null)
  const [numPickerOpen, setNumPickerOpen] = useState<{ setType: 'work' | 'warmup'; field: 'reps' | 'kg'; index: number } | null>(null)
  const [cardioPickerOpen, setCardioPickerOpen] = useState<{ type: 'duration' | 'speed' | 'incline'; index: number } | null>(null)

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

  const isNumPickerReps = numPickerOpen?.field === 'reps'

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
      {/* Exercise header + image */}
      {(() => {
        const libEx = cfg.exercise.source === 'library' ? (cfg.exercise as LibraryExercise) : null
        const imageUrl = libEx?.image_url ?? null
        const secondaryMuscles = cfg.exercise.muscles_secondary ?? []
        return (
          <>
            {imageUrl && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200">
                <Image src={imageUrl} alt={cfg.exercise.name} fill className="object-cover" unoptimized />
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">{cfg.exercise.name}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {cfg.exercise.muscles_primary.slice(0, 2).map(m => (
                    <span key={m} className="flex items-center gap-1 text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                      {MUSCLE_IMAGE[m] && <Image src={MUSCLE_IMAGE[m]!} alt={m} width={12} height={12} className="object-contain shrink-0" />}
                      {MUSCLE_LABELS[m]}
                    </span>
                  ))}
                  {secondaryMuscles.slice(0, 2).map(m => (
                    <span key={`sec-${m}`} className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 text-orange-400 px-1.5 py-0.5 rounded-full">
                      {MUSCLE_IMAGE[m] && <Image src={MUSCLE_IMAGE[m]!} alt={m} width={12} height={12} className="object-contain shrink-0 opacity-70" />}
                      {MUSCLE_LABELS[m]}
                    </span>
                  ))}
                  <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                    {EQUIPMENT_LABELS[cfg.exercise.equipment]}
                  </span>
                </div>
              </div>
            </div>
          </>
        )
      })()}

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
            <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
              <span className="text-xs font-black text-green-500 w-6">C{i + 1}</span>
              {/* Durée en minutes */}
              <button onClick={() => setCardioPickerOpen({ type: 'duration', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[48px] text-center">
                {cfg.cardioDurations[i] ?? 20}min
              </button>
              {/* Vitesse */}
              <button onClick={() => setCardioPickerOpen({ type: 'speed', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[48px] text-center">
                {cfg.cardioSpeeds[i] ?? 8}km/h
              </button>
              {/* Inclinaison */}
              <button onClick={() => setCardioPickerOpen({ type: 'incline', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap min-w-[40px] text-center">
                {cfg.cardioInclines[i] ?? 0}%
              </button>
              {/* Repos */}
              <button onClick={() => setRestPickerOpen({ setType: 'cardio', index: i })}
                className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5 text-xs font-bold text-orange-600 whitespace-nowrap flex-1 text-center">
                {formatRest(cfg.cardioRestSeconds[i] ?? 60)}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Warmup toggle — first */}
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
                  <span className="text-xs font-black text-amber-400 w-6">É{i + 1}</span>
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

          {/* Work sets — after warmup */}
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
        </div>
      )}

      {numPickerOpen !== null && isNumPickerReps && (
        <RepsPickerSheet
          isOpen={true}
          value={currentNumValue}
          onClose={() => setNumPickerOpen(null)}
          onConfirm={handleNumConfirm}
        />
      )}
      {numPickerOpen !== null && !isNumPickerReps && (
        <WeightPickerSheet
          isOpen={true}
          value={currentNumValue}
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

      {/* Cardio: duration picker (stepper in minutes) */}
      {cardioPickerOpen?.type === 'duration' && (
        <BottomSheet isOpen={true} onClose={() => setCardioPickerOpen(null)} title="Durée">
          <div className="space-y-6 pb-4">
            <div className="flex flex-col items-center gap-4">
              <span className="text-4xl font-black text-gray-950 tabular-nums">
                {cfg.cardioDurations[cardioPickerOpen.index] ?? 20}
                <span className="text-lg font-bold text-gray-400 ml-1">min</span>
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    const idx = cardioPickerOpen.index
                    const d = [...cfg.cardioDurations]
                    d[idx] = Math.max(1, (d[idx] ?? 20) - 1)
                    onChange({ ...cfg, cardioDurations: d })
                  }}
                  className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xl flex items-center justify-center active:bg-gray-200">
                  −
                </button>
                <button
                  onClick={() => {
                    const idx = cardioPickerOpen.index
                    const d = [...cfg.cardioDurations]
                    d[idx] = Math.min(120, (d[idx] ?? 20) + 1)
                    onChange({ ...cfg, cardioDurations: d })
                  }}
                  className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xl flex items-center justify-center active:bg-gray-200">
                  +
                </button>
              </div>
            </div>
            <button
              onClick={() => setCardioPickerOpen(null)}
              className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
              Valider
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Cardio: speed picker */}
      {cardioPickerOpen?.type === 'speed' && (
        <SpeedPickerSheet
          isOpen={true}
          value={cfg.cardioSpeeds[cardioPickerOpen.index] ?? 8}
          onClose={() => setCardioPickerOpen(null)}
          onConfirm={kmh => {
            const d = [...cfg.cardioSpeeds]
            d[cardioPickerOpen.index] = kmh
            onChange({ ...cfg, cardioSpeeds: d })
            setCardioPickerOpen(null)
          }}
        />
      )}

      {/* Cardio: incline picker */}
      {cardioPickerOpen?.type === 'incline' && (
        <InclinePickerSheet
          isOpen={true}
          value={cfg.cardioInclines[cardioPickerOpen.index] ?? 0}
          onClose={() => setCardioPickerOpen(null)}
          onConfirm={pct => {
            const d = [...cfg.cardioInclines]
            d[cardioPickerOpen.index] = pct
            onChange({ ...cfg, cardioInclines: d })
            setCardioPickerOpen(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Muscle groups for Par Muscle tab ────────────────────────────────────────
// sections are keyed so the component can translate them
const MUSCLE_GROUPS_TAB_DEF: { sectionKey: string; muscles: MuscleGroup[] }[] = [
  { sectionKey: 'torso', muscles: ['chest', 'back', 'shoulders', 'traps', 'core', 'neck'] },
  { sectionKey: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { sectionKey: 'lower_body', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'inner_thighs', 'outer_thighs'] },
]

// ─── Main ExerciseLibrary ─────────────────────────────────────────────────────
export default function ExerciseLibrary({ isOpen, onClose, onConfirm, fullPage }: ExerciseLibraryProps) {
  const { lang, t } = useLanguage()
  const [exercises, setExercises] = useState<AnyExercise[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all')
  const [filterTab, setFilterTab] = useState<'all' | 'muscle' | 'category'>('all')
  const [materiauExpanded, setMateriauExpanded] = useState(false)
  const [filterLabel, setFilterLabel] = useState<string | null>(null) // label du filtre actif
  const [selected, setSelected] = useState<AnyExercise[]>([])
  const [screen, setScreen] = useState<'library' | 'config'>('library')
  const [configs, setConfigs] = useState<ConfiguredExercise[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedExIds, setExpandedExIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen) return
    setScreen('library')
    setSelected([])
    setSearch('')
    setMuscleFilter('all')
    setEquipmentFilter('all')
    setFilterTab('all')
    setMateriauExpanded(false)
    setExpandedExIds(new Set())
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
    const exKey = `${ex.source}-${ex.id}`
    const expanded = expandedExIds.has(exKey)
    const toggleExpanded = () => setExpandedExIds(prev => {
      const next = new Set(prev)
      if (next.has(exKey)) next.delete(exKey)
      else next.add(exKey)
      return next
    })
    const libEx = ex.source === 'library' ? (ex as LibraryExercise) : null
    const imageUrl = libEx?.image_url ?? null
    const instructions = libEx?.instructions ?? null
    const secondaryMuscles = ex.muscles_secondary ?? []
    const hasDetail = !!(imageUrl || secondaryMuscles.length > 0 || instructions)

    return (
      <div
        className={cn(
          'w-full rounded-2xl border-2 text-left transition-all overflow-hidden',
          sel ? 'border-gray-950 bg-gray-950' : 'border-gray-100 bg-white hover:border-gray-300'
        )}
      >
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checkbox */}
          <button
            onClick={() => toggleSelect(ex)}
            className={cn(
              'w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
              sel ? 'bg-white border-white' : 'border-gray-300'
            )}
          >
            {sel
              ? <Check size={14} className="text-gray-950" strokeWidth={3} />
              : <Plus size={14} className="text-gray-400" />
            }
          </button>
          {/* Info */}
          <button
            onClick={hasDetail ? toggleExpanded : () => toggleSelect(ex)}
            className="flex-1 min-w-0 text-left"
          >
            <p className={cn('text-sm font-semibold truncate', sel ? 'text-white' : 'text-gray-900')}>
              {ex.exercise_type === 'cardio' && <span className="mr-1">🏃</span>}
              {ex.name}
            </p>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {ex.muscles_primary.slice(0, 2).map(m => (
                <span key={m} className={cn('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  sel ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
                )}>
                  {MUSCLE_IMAGE[m] && (
                    <Image src={MUSCLE_IMAGE[m]!} alt={m} width={12} height={12} className={cn('object-contain shrink-0', sel ? 'brightness-0 invert' : '')} />
                  )}
                  {MUSCLE_LABELS[m]}
                </span>
              ))}
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                sel ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              )}>
                {EQUIPMENT_LABELS[ex.equipment]}
              </span>
            </div>
          </button>
          {/* Expand chevron */}
          {hasDetail && (
            <button
              onClick={toggleExpanded}
              className={cn('shrink-0 transition-transform', expanded ? 'rotate-90' : '')}
            >
              <ChevronRight size={16} className={sel ? 'text-white/60' : 'text-gray-400'} />
            </button>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className={cn('border-t px-4 pb-4 space-y-3', sel ? 'border-white/20' : 'border-gray-100')}>
            {/* Exercise image */}
            {imageUrl && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 mt-3">
                <Image
                  src={imageUrl}
                  alt={ex.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            {/* Secondary muscles */}
            {secondaryMuscles.length > 0 && (
              <div>
                <p className={cn('text-[10px] font-black uppercase tracking-wider mb-1.5', sel ? 'text-white/50' : 'text-gray-400')}>
                  Muscles secondaires
                </p>
                <div className="flex gap-1 flex-wrap">
                  {secondaryMuscles.map(m => (
                    <span key={m} className={cn('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      sel ? 'bg-orange-400/30 text-orange-200' : 'bg-orange-50 text-orange-400'
                    )}>
                      {MUSCLE_IMAGE[m] && (
                        <Image src={MUSCLE_IMAGE[m]!} alt={m} width={12} height={12} className={cn('object-contain shrink-0', sel ? 'brightness-0 invert opacity-70' : 'opacity-70')} />
                      )}
                      {MUSCLE_LABELS[m]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Instructions */}
            {instructions && (
              <div>
                <p className={cn('text-[10px] font-black uppercase tracking-wider mb-1', sel ? 'text-white/50' : 'text-gray-400')}>
                  Instructions
                </p>
                <p className={cn('text-xs leading-relaxed line-clamp-4', sel ? 'text-white/70' : 'text-gray-500')}>
                  {instructions}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Library screen content ───────────────────────────────────────────────
  const libraryContent = (
    <div className="space-y-3 pb-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('search_exercise')}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-9 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition-all"
        />
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      {/* 3-tab segmented control */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {([
          { key: 'all', labelKey: 'all' },
          { key: 'muscle', labelKey: 'by_muscle' },
          { key: 'category', labelKey: 'category' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setFilterTab(tab.key)
              setSearch('')
              setMuscleFilter('all')
              setEquipmentFilter('all')
              setMateriauExpanded(false)
              setFilterLabel(null)
            }}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
              filterTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab: Tout — exercise list */}
      {filterTab === 'all' && (
        <>
          {/* My exercises header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('my_exercises')}</p>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
              <Plus size={12} /> {t('create')}
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
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider pt-2">{t('library')}</p>
                  <div className="space-y-1.5">
                    {libraryExs.map(ex => <ExerciseItem key={`lib-${ex.id}`} ex={ex} />)}
                  </div>
                </>
              )}

              {filtered.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-6">{t('no_results')}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Tab: Par Muscle */}
      {filterTab === 'muscle' && (
        <>
          {/* Liste des muscles (quand aucun filtre actif) */}
          {muscleFilter === 'all' && (
            <div className="space-y-1">
              {MUSCLE_GROUPS_TAB_DEF.map(group => (
                <div key={group.sectionKey}>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider py-2">{t(group.sectionKey)}</p>
                  {group.muscles.map(muscle => {
                    const img = MUSCLE_IMAGE[muscle]
                    const count = exercises.filter(ex => ex.muscles_primary.includes(muscle)).length
                    const muscleLabel = getMuscleLabel(muscle, lang)
                    return (
                      <button
                        key={muscle}
                        onClick={() => {
                          setMuscleFilter(muscle)
                          setFilterLabel(muscleLabel)
                        }}
                        className="w-full flex items-center gap-4 px-1 py-4 border-b border-gray-100 active:bg-gray-50 transition-colors"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {img && <Image src={img} alt={muscle} width={64} height={64} className="object-contain p-1" />}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-base font-semibold text-gray-900">{muscleLabel}</p>
                          <p className="text-xs text-gray-400">{count} exercice{count !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Liste filtrée par muscle */}
          {muscleFilter !== 'all' && (
            <>
              <button
                onClick={() => { setMuscleFilter('all'); setFilterLabel(null) }}
                className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors -mt-1"
              >
                <ChevronLeft size={16} /> {filterLabel}
              </button>
              <div className="space-y-1.5">
                {filtered.length === 0
                  ? <p className="text-gray-400 text-sm text-center py-6">{t('no_results')}</p>
                  : filtered.map(ex => <ExerciseItem key={`${ex.source}-${ex.id}`} ex={ex} />)
                }
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Catégorie */}
      {filterTab === 'category' && (
        <div className="space-y-3">
          {/* Filtre actif → affiche liste + retour */}
          {equipmentFilter !== 'all' ? (
            <>
              <button
                onClick={() => { setEquipmentFilter('all'); setFilterLabel(null); setMateriauExpanded(false) }}
                className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors -mt-1"
              >
                <ChevronLeft size={16} /> {filterLabel}
              </button>
              <div className="space-y-1.5">
                {filtered.length === 0
                  ? <p className="text-gray-400 text-sm text-center py-6">{t('no_results')}</p>
                  : filtered.map(ex => <ExerciseItem key={`${ex.source}-${ex.id}`} ex={ex} />)
                }
              </div>
            </>
          ) : (
            <>
          {/* Cardio card */}
          <button
            onClick={() => {
              setEquipmentFilter('cardio')
              setFilterLabel('Cardio')
            }}
            className="w-full flex items-center justify-between px-4 py-4 bg-white rounded-2xl border-2 border-gray-100 active:border-gray-300 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏃</span>
              <p className="text-sm font-bold text-gray-900">Cardio</p>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>

          {/* Matériel card (expandable) */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
            <button
              onClick={() => setMateriauExpanded(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏋️</span>
                <p className="text-sm font-bold text-gray-900">Matériel</p>
              </div>
              <ChevronRight
                size={16}
                className={cn('text-gray-400 transition-transform', materiauExpanded ? 'rotate-90' : '')}
              />
            </button>
            {materiauExpanded && (
              <div className="border-t border-gray-100">
                {EQUIPMENT_FILTERS.filter(e => e.key !== 'all' && e.key !== 'cardio').map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setEquipmentFilter(key)
                      setFilterLabel(label)
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-b-0 active:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-700">{label}</p>
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* Confirm button — always visible when exercises selected */}
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
