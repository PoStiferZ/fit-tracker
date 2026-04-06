'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId, setProfileId } from '@/lib/cookies'
import { calculateAge, getMonday, formatDateISO, cn } from '@/lib/utils'
import { fetchStreak } from '@/lib/streak'
import { DAYS } from '@/lib/constants'
import type { Profile, Program, Workout, WeeklyPlan } from '@/types'
import Navbar from '@/components/Navbar'
import DayCard from '@/components/DayCard'
import BottomSheet from '@/components/BottomSheet'
import ProgressRing from '@/components/ProgressRing'
import ProfileAvatar from '@/components/ProfileAvatar'
import SupplementsTab from '@/components/SupplementsTab'
import WeekNav from '@/components/WeekNav'
import { Users, Check, Plus, Lock, ChevronRight } from 'lucide-react'

type Tab = 'semaine' | 'complements'

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('fr-FR', opts)} – ${sunday.toLocaleDateString('fr-FR', opts)}`
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([]) // all workouts across all programs
  const [weekPlan, setWeekPlan] = useState<WeeklyPlan[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('semaine')
  const [weekOffset, setWeekOffset] = useState(0)

  // Assignment sheet
  const [editDay, setEditDay] = useState<number | null>(null)
  const [assignStep, setAssignStep] = useState<'program' | 'workout'>('program')
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('')

  const todayMonday = getMonday(new Date())
  const viewMonday = addWeeks(todayMonday, weekOffset)
  const weekStart = formatDateISO(viewMonday)
  const isCurrentWeek = weekOffset === 0
  const isPastWeek = weekOffset < 0

  const todayJS = new Date().getDay()
  const todayNum = todayJS === 0 ? 7 : todayJS

  const load = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) { router.replace('/'); return }
    const [pRes, allPRes, progRes, wpRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('programs').select('*').eq('profile_id', profileId).order('created_at'),
      supabase.from('weekly_plan').select('*').eq('profile_id', profileId).eq('week_start', weekStart),
    ])
    if (!pRes.data) { router.replace('/'); return }
    setProfile(pRes.data)
    setAllProfiles(allPRes.data || [])
    const progs: Program[] = progRes.data || []
    setPrograms(progs)

    // Load all workouts for these programs
    if (progs.length > 0) {
      const programIds = progs.map(p => p.id)
      const { data: wks } = await supabase
        .from('workouts')
        .select('*')
        .in('program_id', programIds)
        .order('order_index')
      setWorkouts(wks || [])
    } else {
      setWorkouts([])
    }

    let currentPlan: WeeklyPlan[] = wpRes.data || []

    // Auto-copy previous week if current week is empty
    if (isCurrentWeek && currentPlan.length === 0) {
      const prevMonday = addWeeks(todayMonday, -1)
      const prevWeekStart = formatDateISO(prevMonday)
      const { data: prevData } = await supabase
        .from('weekly_plan')
        .select('*')
        .eq('profile_id', profileId)
        .eq('week_start', prevWeekStart)
      if (prevData && prevData.length > 0) {
        const rows = prevData
          .filter((d: WeeklyPlan) => d.workout_id || d.program_id)
          .map((d: WeeklyPlan) => ({
            profile_id: profileId,
            day_of_week: d.day_of_week,
            program_id: d.program_id,
            workout_id: d.workout_id,
            completed: false,
            week_start: weekStart,
            is_override: false,
          }))
        if (rows.length > 0) {
          const { data: inserted } = await supabase.from('weekly_plan').insert(rows).select()
          if (inserted) currentPlan = inserted
        }
      }
    }

    setWeekPlan(currentPlan)
    setLoading(false)
    if (isCurrentWeek) {
      const s = await fetchStreak()
      setStreak(s)
    }
  }, [router, weekStart, isCurrentWeek, todayMonday])

  useEffect(() => { load() }, [load])

  const getProgramForDay = (day: number): Program | null => {
    const entry = weekPlan.find(d => d.day_of_week === day)
    if (!entry?.program_id) return null
    return programs.find(p => p.id === entry.program_id) || null
  }

  const getWorkoutForDay = (day: number): Workout | null => {
    const entry = weekPlan.find(d => d.day_of_week === day)
    if (!entry?.workout_id) return null
    return workouts.find(w => w.id === entry.workout_id) || null
  }

  const getDayEntry = (day: number) => weekPlan.find(d => d.day_of_week === day)

  const completedCount = weekPlan.filter(d => d.completed).length
  const scheduledCount = weekPlan.filter(d => d.workout_id || d.program_id).length

  const workoutsForProgram = (programId: string) =>
    workouts.filter(w => w.program_id === programId).sort((a, b) => a.order_index - b.order_index)

  async function toggleCompleted(dayOfWeek: number, current: boolean) {
    if (isPastWeek) return
    const entry = weekPlan.find(d => d.day_of_week === dayOfWeek)
    if (!entry) return
    const { data } = await supabase.from('weekly_plan').update({ completed: !current }).eq('id', entry.id).select().single()
    if (data) setWeekPlan(prev => prev.map(d => d.id === data.id ? data : d))
  }

  function openAssignSheet(day: number) {
    const entry = getDayEntry(day)
    setEditDay(day)
    setSelectedProgramId(entry?.program_id || '')
    setSelectedWorkoutId(entry?.workout_id || '')
    setAssignStep('program')
  }

  async function assignWorkout() {
    const profileId = getProfileId()!
    const programId = selectedProgramId || null
    const workoutId = selectedWorkoutId || null
    const existing = weekPlan.find(d => d.day_of_week === editDay)
    let result
    if (existing) {
      result = await supabase
        .from('weekly_plan')
        .update({ program_id: programId, workout_id: workoutId, completed: false })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('weekly_plan')
        .insert({
          day_of_week: editDay,
          program_id: programId,
          workout_id: workoutId,
          completed: false,
          week_start: weekStart,
          profile_id: profileId,
          is_override: false,
        })
        .select()
        .single()
    }
    if (result.data) setWeekPlan(prev => [...prev.filter(d => d.day_of_week !== editDay), result.data])
    setEditDay(null)
  }

  async function clearDay() {
    const profileId = getProfileId()!
    const existing = weekPlan.find(d => d.day_of_week === editDay)
    if (existing) {
      await supabase.from('weekly_plan').update({ program_id: null, workout_id: null, completed: false }).eq('id', existing.id)
      setWeekPlan(prev => prev.map(d => d.day_of_week === editDay ? { ...d, program_id: null, workout_id: null, completed: false } : d))
    }
    setEditDay(null)
  }

  function switchProfile(p: Profile) {
    setProfileId(p.id)
    setProfileSheetOpen(false)
    setLoading(true)
    load()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8fb]">
      <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <ProfileAvatar name={profile!.first_name} size="md" />
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-gray-950 text-xl leading-tight">Bonjour {profile?.first_name} 👋</h1>
            <p className="text-gray-400 text-xs font-medium mt-0.5">
              {calculateAge(profile!.birth_date)} ans · {profile?.height_cm} cm · {profile?.weight_kg} kg
            </p>
          </div>
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <Users size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
          {([
            { key: 'semaine', label: '🗓 Ma semaine' },
            { key: 'complements', label: '💊 Compléments' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                activeTab === t.key
                  ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                  : 'text-gray-400 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Semaine tab ── */}
        {activeTab === 'semaine' && (
          <div className="space-y-3">

            {/* Progress card */}
            <div className={cn(
              'rounded-3xl p-5 flex items-center gap-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)] relative overflow-hidden',
              isPastWeek ? 'bg-gray-700' : 'bg-gray-950'
            )}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 60%)' }} />
              <div className="relative">
                <ProgressRing done={completedCount} total={scheduledCount} size={90} strokeWidth={8} />
              </div>
              <div className="flex-1 relative space-y-2">
                <div>
                  <p className="text-white font-bold text-base leading-tight">
                    {completedCount === scheduledCount && scheduledCount > 0
                      ? '🎉 Semaine complète !'
                      : scheduledCount === 0
                        ? 'Aucune séance planifiée'
                        : `${scheduledCount - completedCount} séance${scheduledCount - completedCount > 1 ? 's' : ''} restante${scheduledCount - completedCount > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">{completedCount}/{scheduledCount} séances</p>
                </div>
                {isCurrentWeek && streak > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/20">
                    🔥 {streak} semaine{streak > 1 ? 's' : ''} consécutive{streak > 1 ? 's' : ''}
                  </div>
                )}
                {isPastWeek && (
                  <div className="inline-flex items-center gap-1.5 bg-white/10 text-white/50 text-xs font-bold px-3 py-1.5 rounded-full">
                    <Lock size={10} /> Historique
                  </div>
                )}
              </div>
            </div>

            {/* Week navigator */}
            <WeekNav
              weekOffset={weekOffset}
              onPrev={() => setWeekOffset(o => o - 1)}
              onNext={() => setWeekOffset(o => Math.min(0, o + 1))}
              weekLabel={formatWeekLabel(viewMonday)}
            />

            {/* Readonly banner for past weeks */}
            {isPastWeek && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <Lock size={14} className="text-amber-500 shrink-0" />
                <p className="text-amber-700 text-xs font-semibold">Historique — lecture seule</p>
              </div>
            )}

            {/* Day cards */}
            <div className="space-y-2">
              {DAYS.map((dayName, i) => {
                const dayNum = i + 1
                const isToday = isCurrentWeek && dayNum === todayNum
                const entry = getDayEntry(dayNum)
                return (
                  <DayCard
                    key={dayNum}
                    dayName={dayName}
                    dayNum={dayNum}
                    program={getProgramForDay(dayNum)}
                    workout={getWorkoutForDay(dayNum)}
                    completed={entry?.completed || false}
                    isToday={isToday}
                    isOverride={entry?.is_override || false}
                    readonly={isPastWeek}
                    onEdit={isPastWeek ? undefined : () => openAssignSheet(dayNum)}
                    onToggle={isPastWeek ? undefined : () => toggleCompleted(dayNum, entry?.completed || false)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Compléments tab ── */}
        {activeTab === 'complements' && (
          <SupplementsTab />
        )}
      </main>

      {/* Bottom sheet — assign workout (step 1: choose program) */}
      <BottomSheet
        isOpen={editDay !== null && assignStep === 'program'}
        onClose={() => setEditDay(null)}
        title={`${editDay ? DAYS[editDay - 1] : ''} — Choisir un programme`}
      >
        <div className="space-y-2.5 pb-2">
          {/* Rest option */}
          <button
            onClick={clearDay}
            className={cn(
              'w-full text-left px-4 py-4 rounded-2xl border-2 transition-all text-sm font-semibold min-h-[56px]',
              !getDayEntry(editDay ?? 0)?.workout_id
                ? 'border-gray-950 bg-gray-950 text-white'
                : 'border-gray-100 bg-gray-50 text-gray-700'
            )}
          >
            🧘 Repos
          </button>

          {programs.map(p => {
            const wks = workoutsForProgram(p.id)
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProgramId(p.id)
                  setSelectedWorkoutId('')
                  setAssignStep('workout')
                }}
                className={cn(
                  'w-full text-left px-4 py-4 rounded-2xl border-2 transition-all min-h-[56px] flex items-center justify-between',
                  selectedProgramId === p.id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-100 bg-gray-50 text-gray-700'
                )}
              >
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className={cn('text-xs mt-0.5', selectedProgramId === p.id ? 'text-white/50' : 'text-gray-400')}>
                    {wks.length} séance{wks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} className={selectedProgramId === p.id ? 'text-white/50' : 'text-gray-300'} />
              </button>
            )
          })}

          {programs.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">Crée d&apos;abord un programme dans l&apos;onglet Programmes</p>
          )}
        </div>
      </BottomSheet>

      {/* Bottom sheet — assign workout (step 2: choose workout) */}
      <BottomSheet
        isOpen={editDay !== null && assignStep === 'workout'}
        onClose={() => setAssignStep('program')}
        title={`${editDay ? DAYS[editDay - 1] : ''} — Choisir une séance`}
      >
        <div className="space-y-2.5 pb-2">
          <button
            onClick={() => setAssignStep('program')}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-gray-900 mb-2 transition-colors"
          >
            ← {programs.find(p => p.id === selectedProgramId)?.name}
          </button>

          {workoutsForProgram(selectedProgramId).map((w, i) => (
            <button
              key={w.id}
              onClick={() => setSelectedWorkoutId(w.id)}
              className={cn(
                'w-full text-left px-4 py-4 rounded-2xl border-2 transition-all text-sm font-semibold min-h-[56px] flex items-center gap-3',
                selectedWorkoutId === w.id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-100 bg-gray-50 text-gray-700'
              )}
            >
              <span className={cn('text-xs font-black w-5', selectedWorkoutId === w.id ? 'text-white/50' : 'text-gray-300')}>
                {i + 1}.
              </span>
              {w.name}
              {selectedWorkoutId === w.id && <Check size={16} className="ml-auto text-white" />}
            </button>
          ))}

          {workoutsForProgram(selectedProgramId).length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">
              Ce programme n&apos;a pas encore de séances. Modifie-le d&apos;abord.
            </p>
          )}

          {selectedWorkoutId && (
            <button
              onClick={assignWorkout}
              className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] mt-2"
            >
              <Check size={18} /> Confirmer
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Profile switcher */}
      <BottomSheet isOpen={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} title="Changer de profil">
        <div className="space-y-2.5 pb-2">
          {allProfiles.map(p => (
            <button key={p.id} onClick={() => switchProfile(p)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all min-h-[60px]',
                p.id === profile?.id ? 'border-gray-950 bg-gray-950/5' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
              )}
            >
              <ProfileAvatar name={p.first_name} size="sm" />
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-900 text-sm">{p.first_name}</p>
                <p className="text-xs text-gray-400">{calculateAge(p.birth_date)} ans · {p.weight_kg} kg</p>
              </div>
              {p.id === profile?.id && <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Actif</span>}
            </button>
          ))}
          <button
            onClick={() => { setProfileSheetOpen(false); router.push('/') }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 border-2 border-dashed border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-all text-sm font-semibold"
          >
            <Plus size={16} /> Nouveau profil
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
