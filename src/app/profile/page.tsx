'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId, clearProfileId } from '@/lib/cookies'
import { calculateAge, formatDateISO, getMonday } from '@/lib/utils'
import type { Profile, BodyWeightEntry, MuscleGroup } from '@/types'
import Navbar from '@/components/Navbar'
import ProfileAvatar from '@/components/ProfileAvatar'
import BottomSheet from '@/components/BottomSheet'
import { Scale, Plus, Check, LogOut, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', rear_delts: 'Delts arr.',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', traps: 'Trapèzes',
  core: 'Abdos', quads: 'Quadriceps', hamstrings: 'Ischio', glutes: 'Fessiers',
  calves: 'Mollets', inner_thighs: 'Adducteurs', cardio: 'Cardio',
}

// muscle group → emoji
const MUSCLE_EMOJI: Record<string, string> = {
  chest: '🫁', back: '🔙', shoulders: '🏔️', rear_delts: '↩️',
  biceps: '💪', triceps: '💪', forearms: '🤜', traps: '🦍',
  core: '⚡', quads: '🦵', hamstrings: '🦵', glutes: '🍑',
  calves: '🦿', inner_thighs: '🦵', cardio: '❤️',
}

interface StatsData {
  totalSessions: number
  monthSessions: number
  avgDurationMin: number
  setsByMuscle: { muscle: MuscleGroup; sets: number }[]
}

const inputField = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

function relativeDate(dateStr: string): string {
  const today = formatDateISO(new Date())
  if (dateStr === today) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === formatDateISO(yesterday)) return 'Hier'
  const diff = Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000)
  return `Il y a ${diff} jours`
}

const HISTORY_COUNT = 30

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [weights, setWeights] = useState<BodyWeightEntry[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Weight input
  const [addingWeight, setAddingWeight] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // Edit profile sheet
  const [editSheet, setEditSheet] = useState(false)
  const [editForm, setEditForm] = useState({ height_cm: 0, weight_kg: 0 })
  const [savingProfile, setSavingProfile] = useState(false)

  const today = formatDateISO(new Date())

  const load = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) { router.replace('/'); return }
    const [pRes, wRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('body_weight_log').select('*')
        .eq('profile_id', profileId)
        .order('date', { ascending: false })
        .limit(HISTORY_COUNT),
    ])
    if (!pRes.data) { router.replace('/'); return }
    setProfile(pRes.data)
    setWeights((wRes.data || []).slice().reverse())

    // ── Stats ──────────────────────────────────────────────────────────────
    const { data: sessions } = await supabase
      .from('live_sessions')
      .select('id, started_at, finished_at, workout_id')
      .eq('profile_id', profileId)
      .eq('status', 'finished')
      .order('started_at', { ascending: false })

    const finishedSessions = sessions || []
    const totalSessions = finishedSessions.length

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthSessions = finishedSessions.filter(s => s.started_at >= monthStart).length

    const durationsMin = finishedSessions
      .filter(s => s.finished_at)
      .map(s => (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)
      .filter(d => d > 0 && d < 300)
    const avgDurationMin = durationsMin.length > 0
      ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
      : 0

    // Volume par groupe musculaire — semaine courante
    const weekStart = formatDateISO(getMonday(now))
    const weekSessionIds = finishedSessions
      .filter(s => s.started_at >= weekStart)
      .map(s => s.id)

    let volumeByMuscle: { muscle: MuscleGroup; volume: number }[] = []
    if (weekSessionIds.length > 0) {
      const { data: setsData } = await supabase
        .from('live_session_sets')
        .select('weight_kg, reps, set_type, workout_exercise_id')
        .in('live_session_id', weekSessionIds)
        .eq('skipped', false)

      if (setsData && setsData.length > 0) {
        const weIds = [...new Set(setsData.map((s: { workout_exercise_id: string }) => s.workout_exercise_id))]
        const { data: weData } = await supabase
          .from('workout_exercises')
          .select(`
            id,
            library_ex:exercise_library(muscles_primary),
            custom_ex:custom_exercises(muscles_primary)
          `)
          .in('id', weIds)

        const muscleMap = new Map<MuscleGroup, number>()
        setsData.forEach((set: { weight_kg: number | null; reps: number | null; set_type: string; workout_exercise_id: string }) => {
          if (set.set_type !== 'work') return
          const we = (weData || []).find((w: { id: string }) => w.id === set.workout_exercise_id)
          if (!we) return
          const muscles: MuscleGroup[] = (
            (we.library_ex as unknown as { muscles_primary: MuscleGroup[] } | null)?.muscles_primary ||
            (we.custom_ex as unknown as { muscles_primary: MuscleGroup[] } | null)?.muscles_primary ||
            []
          )
          muscles.forEach(m => muscleMap.set(m, (muscleMap.get(m) || 0) + 1))
        })
        volumeByMuscle = Array.from(muscleMap.entries())
          .map(([muscle, volume]) => ({ muscle, volume }))
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 6)
      }
    }

    setStats({ totalSessions, monthSessions, avgDurationMin, setsByMuscle: volumeByMuscle.map(v => ({ muscle: v.muscle, sets: v.volume })) })
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const latest = weights[weights.length - 1]
  const todayEntry = weights.find(e => e.date === today)

  async function saveWeight() {
    const val = parseFloat(weightInput)
    if (!val || val <= 0 || !profile) return
    setSavingWeight(true)
    const existing = weights.find(e => e.date === today)
    if (existing) {
      const { data } = await supabase.from('body_weight_log')
        .update({ weight_kg: val }).eq('id', existing.id).select().single()
      if (data) setWeights(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      const { data } = await supabase.from('body_weight_log')
        .insert({ profile_id: profile.id, weight_kg: val, date: today })
        .select().single()
      if (data) setWeights(prev => [...prev, data])
    }
    setSavingWeight(false)
    setAddingWeight(false)
    setWeightInput('')
  }

  async function saveProfile() {
    if (!profile) return
    setSavingProfile(true)
    const { data } = await supabase.from('profiles')
      .update({ height_cm: editForm.height_cm, weight_kg: editForm.weight_kg })
      .eq('id', profile.id).select().single()
    if (data) setProfile(data)
    setSavingProfile(false)
    setEditSheet(false)
  }

  // SVG chart
  const svgW = 300
  const svgH = 80
  const padX = 8
  const padY = 10

  const chartData = (() => {
    const data = weights.slice(-20) // last 20 entries
    if (data.length < 2) return null
    const ws = data.map(e => e.weight_kg)
    const minW = Math.min(...ws)
    const maxW = Math.max(...ws)
    const rangeW = maxW - minW || 1
    const n = data.length
    const points = data.map((e, i) => ({
      x: padX + (i / (n - 1)) * (svgW - padX * 2),
      y: padY + (1 - (e.weight_kg - minW) / rangeW) * (svgH - padY * 2),
      entry: e,
    }))
    const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const prev = weights.length >= 2 ? weights[weights.length - 2] : null
    const diff = prev && latest ? (latest.weight_kg - prev.weight_kg) : null
    return { points, polyline, minW: minW.toFixed(1), maxW: maxW.toFixed(1), diff }
  })()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-white min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6 space-y-4">

        {/* Profile card */}
        <div className="bg-gray-950 rounded-3xl p-5 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 60%)'}} />
          <div className="relative flex items-center gap-4">
            <ProfileAvatar name={profile!.first_name} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white">{profile!.first_name}</h1>
              <p className="text-white/50 text-sm mt-0.5">
                {calculateAge(profile!.birth_date)} ans · {profile!.height_cm} cm
              </p>
            </div>
            <button
              onClick={() => { setEditForm({ height_cm: profile!.height_cm, weight_kg: Number(profile!.weight_kg) }); setEditSheet(true) }}
              className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            >
              <Pencil size={15} className="text-white/70" />
            </button>
          </div>

          <div className="relative grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Âge', value: `${calculateAge(profile!.birth_date)} ans` },
              { label: 'Taille', value: `${profile!.height_cm} cm` },
              { label: 'Poids init.', value: `${profile!.weight_kg} kg` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</p>
                <p className="text-base font-black text-white mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="space-y-3">
            {/* 3 KPI cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Séances totales', value: stats.totalSessions, unit: '' },
                { label: 'Ce mois', value: stats.monthSessions, unit: '' },
                { label: 'Durée moy.', value: stats.avgDurationMin, unit: 'min' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.05)] px-2 py-3 flex flex-col items-center justify-center text-center gap-1 min-h-[76px]">
                  <div className="flex items-baseline gap-0.5 justify-center">
                    <span className="text-2xl font-black text-gray-950 tabular-nums leading-none">
                      {value > 0 ? value : '—'}
                    </span>
                    {unit && value > 0 && <span className="text-[10px] font-bold text-gray-400 ml-0.5">{unit}</span>}
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Séries par groupe musculaire cette semaine */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.05)] p-4">
              {stats.setsByMuscle.length === 0 ? (
                <>
                  <p className="text-sm text-gray-300 italic text-center py-3">Aucune séance cette semaine</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mt-1">Séries par muscle · semaine</p>
                </>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {(() => {
                      const max = stats.setsByMuscle[0]?.sets || 1
                      return stats.setsByMuscle.map(({ muscle, sets }) => (
                        <div key={muscle}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                              <span>{MUSCLE_EMOJI[muscle] ?? '💪'}</span>
                              {MUSCLE_LABELS[muscle]}
                            </span>
                            <span className="text-xs font-black text-gray-950 tabular-nums">
                              {sets} série{sets > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-950 rounded-full transition-all"
                              style={{ width: `${(sets / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mt-3">Séries par muscle · semaine</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Weight tracking */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Poids corporel</p>
              {latest ? (
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-gray-950 tabular-nums">{latest.weight_kg}</span>
                  <span className="text-sm font-bold text-gray-400">kg</span>
                  {chartData?.diff !== null && chartData?.diff !== undefined && (
                    <span className={cn(
                      'text-xs font-bold ml-2 px-2 py-0.5 rounded-lg',
                      chartData.diff > 0 ? 'bg-red-50 text-red-500' : chartData.diff < 0 ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    )}>
                      {chartData.diff > 0 ? '+' : ''}{chartData.diff.toFixed(1)} kg
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 font-semibold mt-0.5">Aucune mesure</p>
              )}
              {latest && <p className="text-xs text-gray-400 mt-0.5">{relativeDate(latest.date)}</p>}
            </div>
            {!addingWeight && (
              <button
                onClick={() => { setWeightInput(todayEntry ? String(todayEntry.weight_kg) : ''); setAddingWeight(true) }}
                className="w-11 h-11 flex items-center justify-center bg-gray-950 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.2)] active:scale-95 transition-transform"
              >
                <Plus size={18} className="text-white" />
              </button>
            )}
          </div>

          {/* Inline weight input */}
          {addingWeight && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative">
                <input
                  type="number" inputMode="decimal" step="0.1" min="20" max="300"
                  autoFocus placeholder="75.5"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveWeight() }}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-base font-bold text-gray-900 focus:outline-none focus:border-gray-950 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">kg</span>
              </div>
              <button onClick={saveWeight} disabled={savingWeight || !weightInput}
                className={cn(
                  'w-11 h-11 flex items-center justify-center rounded-xl transition-all shrink-0',
                  weightInput ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                )}>
                {savingWeight
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={16} strokeWidth={3} />}
              </button>
              <button onClick={() => setAddingWeight(false)}
                className="w-10 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0 text-base">
                ✕
              </button>
            </div>
          )}

          {/* Chart */}
          {chartData ? (
            <div>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: svgH }} aria-hidden>
                <defs>
                  <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#111827" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#111827" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`${padX},${svgH - padY} ${chartData.polyline} ${svgW - padX},${svgH - padY}`} fill="url(#bwGrad)" />
                <polyline points={chartData.polyline} fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.points.map((p, i) => {
                  const isLast = i === chartData.points.length - 1
                  return <circle key={p.entry.id} cx={p.x} cy={p.y} r={isLast ? 4 : 2.5} fill={isLast ? '#111827' : '#d1d5db'} stroke="white" strokeWidth="1.5" />
                })}
              </svg>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-semibold text-gray-400">{chartData.minW} kg</span>
                <span className="text-[10px] font-semibold text-gray-400">{weights.length} mesure{weights.length > 1 ? 's' : ''}</span>
                <span className="text-[10px] font-semibold text-gray-400">{chartData.maxW} kg</span>
              </div>
            </div>
          ) : weights.length === 1 ? (
            <p className="text-[11px] text-gray-400 text-center mt-1">Ajoute d&apos;autres mesures pour voir la courbe</p>
          ) : (
            <div className="flex flex-col items-center py-6 gap-3">
              <Scale size={32} className="text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">Aucune mesure enregistrée</p>
              <button onClick={() => setAddingWeight(true)}
                className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform">
                <Plus size={14} /> Enregistrer mon poids
              </button>
            </div>
          )}
        </div>

        {/* Profile actions */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 overflow-hidden">
          <button onClick={() => { clearProfileId(); router.replace('/') }}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors">
            <span className="w-8 text-center"><LogOut size={18} className="text-red-400 mx-auto" /></span>
            <span className="flex-1 text-left text-sm font-semibold text-red-500">Déconnexion</span>
          </button>
        </div>

        <div className="pb-2" />
      </main>

      {/* Edit profile sheet */}
      <BottomSheet isOpen={editSheet} onClose={() => setEditSheet(false)} title="Modifier le profil">
        <div className="space-y-4 pb-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Taille (cm)</label>
            <input type="number" inputMode="numeric" value={editForm.height_cm || ''}
              onChange={e => setEditForm(f => ({ ...f, height_cm: parseInt(e.target.value) || 0 }))}
              className={inputField} placeholder="175" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Poids de référence (kg)</label>
            <input type="number" inputMode="decimal" step="0.1" value={editForm.weight_kg || ''}
              onChange={e => setEditForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || 0 }))}
              className={inputField} placeholder="75" />
          </div>
          <button onClick={saveProfile} disabled={savingProfile}
            className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40">
            {savingProfile ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </BottomSheet>


    </div>
  )
}
