'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { calculateAge, getMonday, formatDateISO, cn } from '@/lib/utils'
import { fetchStreak } from '@/lib/streak'
import { DAYS } from '@/lib/constants'
import type { Profile, Program, Workout, WeeklyPlan, ActiveProgram } from '@/types'
import Navbar from '@/components/Navbar'
import DayCard from '@/components/DayCard'
import BottomSheet from '@/components/BottomSheet'
import ProgressRing from '@/components/ProgressRing'
import SupplementsTab from '@/components/SupplementsTab'
import WeekNav from '@/components/WeekNav'
import { Check, Lock } from 'lucide-react'

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
  const [programs, setPrograms] = useState<Program[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [weekPlan, setWeekPlan] = useState<WeeklyPlan[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('semaine')
  const [weekOffset, setWeekOffset] = useState(0)
  const [suppDayOffset, setSuppDayOffset] = useState(0)
  const [launching, setLaunching] = useState(false)

  // Active program
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null)
  const [programSheet, setProgramSheet] = useState(false)
  const [selectingProgramId, setSelectingProgramId] = useState('')
  const [selectingRecurrence, setSelectingRecurrence] = useState<number>(1)
  const [selectingRestDays, setSelectingRestDays] = useState<number[]>([])
  const [savingActiveProgram, setSavingActiveProgram] = useState(false)

  // Assignment sheet
  const [editDay, setEditDay] = useState<number | null>(null)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('')

  const todayMonday = getMonday(new Date())
  const viewMonday = addWeeks(todayMonday, weekOffset)
  const weekStart = formatDateISO(viewMonday)
  const isCurrentWeek = weekOffset === 0
  const isPastWeek = weekOffset < 0

  const todayJS = new Date().getDay()
  const todayNum = todayJS === 0 ? 7 : todayJS

  // Min week offset based on profile creation date
  const profileCreatedAt = profile?.created_at ? new Date(profile.created_at) : new Date()
  const createdMonday = getMonday(profileCreatedAt)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const minWeekOffset = Math.round((createdMonday.getTime() - todayMonday.getTime()) / msPerWeek)
  // Min day offset for supplements
  const createdDate = new Date(profileCreatedAt); createdDate.setHours(0,0,0,0)
  const today0 = new Date(); today0.setHours(0,0,0,0)
  const minDayOffset = Math.round((createdDate.getTime() - today0.getTime()) / 86400000)

  // ── Initial load (profile + programs + workouts) — runs once ──
  const loadBase = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) { router.replace('/'); return }
    const [pRes, progRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('programs').select('*').eq('profile_id', profileId).order('created_at'),
    ])
    if (!pRes.data) { router.replace('/'); return }
    setProfile(pRes.data)
    const progs: Program[] = progRes.data || []
    setPrograms(progs)
    if (progs.length > 0) {
      const { data: wks } = await supabase
        .from('workouts').select('*')
        .in('program_id', progs.map(p => p.id))
        .order('order_index')
      setWorkouts(wks || [])
    }
    const { data: apData } = await supabase
      .from('active_program')
      .select('*')
      .eq('profile_id', profileId)
      .single()
    setActiveProgram(apData || null)
    const s = await fetchStreak()
    setStreak(s)
    setLoading(false)
  }, [router])

  // ── Week plan load — runs when weekOffset changes ──
  const loadWeekPlan = useCallback(async (ws: string, isCurrent: boolean, todayMon: Date) => {
    const profileId = getProfileId()
    if (!profileId) return
    const { data: wpData } = await supabase
      .from('weekly_plan').select('*')
      .eq('profile_id', profileId).eq('week_start', ws)
    let plan: WeeklyPlan[] = wpData || []

    // Auto-copy previous week if current week is empty
    if (isCurrent && plan.length === 0) {
      const prevWeekStart = formatDateISO(addWeeks(todayMon, -1))
      const { data: prevData } = await supabase
        .from('weekly_plan').select('*')
        .eq('profile_id', profileId).eq('week_start', prevWeekStart)
      if (prevData && prevData.length > 0) {
        const rows = prevData
          .filter((d: WeeklyPlan) => d.workout_id || d.program_id)
          .map((d: WeeklyPlan) => ({
            profile_id: profileId,
            day_of_week: d.day_of_week,
            program_id: d.program_id,
            workout_id: d.workout_id,
            completed: false,
            week_start: ws,
            is_override: false,
          }))
        if (rows.length > 0) {
          const { data: inserted } = await supabase.from('weekly_plan').insert(rows).select()
          if (inserted) plan = inserted
        }
      }
    }
    setWeekPlan(plan)
  }, [])

  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => {
    loadWeekPlan(weekStart, isCurrentWeek, todayMonday)
  }, [weekStart, isCurrentWeek, todayMonday, loadWeekPlan])

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

  const completedCount = weekPlan.filter(d => d.completed && !!d.workout_id).length
  const scheduledCount = weekPlan.filter(d => !!d.workout_id).length

  const workoutsForProgram = (programId: string) =>
    workouts.filter(w => w.program_id === programId).sort((a, b) => a.order_index - b.order_index)

  async function saveActiveProgram() {
    const profileId = getProfileId()!
    setSavingActiveProgram(true)
    const startedAt = formatDateISO(new Date())
    const row = {
      profile_id: profileId,
      program_id: selectingProgramId,
      recurrence_months: selectingRecurrence,
      rest_days: selectingRestDays,
      started_at: startedAt,
    }
    const { data: apData } = await supabase
      .from('active_program')
      .upsert(row, { onConflict: 'profile_id' })
      .select().single()
    if (apData) {
      setActiveProgram(apData)
      // Auto-fill current week based on cycle
      await autoFillWeek(profileId, apData, weekStart)
      await loadWeekPlan(weekStart, isCurrentWeek, todayMonday)
    }
    setSavingActiveProgram(false)
    setProgramSheet(false)
  }

  async function autoFillWeek(profileId: string, ap: ActiveProgram, ws: string) {
    const progWorkouts = workoutsForProgram(ap.program_id)
    if (progWorkouts.length === 0) return
    const startedDate = new Date(ap.started_at)
    startedDate.setHours(0, 0, 0, 0)
    const restSet = new Set(ap.rest_days)
    // Count training days from started_at up to (not including) monday of this week
    const monday = new Date(ws)
    let trainingDaysBefore = 0
    for (let d = new Date(startedDate); d < monday; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      if (!restSet.has(dow)) trainingDaysBefore++
    }
    // Build rows for days 1–7
    const rows = []
    let counter = trainingDaysBefore
    for (let i = 0; i < 7; i++) {
      const dow = i + 1 // 1=Mon…7=Sun
      if (restSet.has(dow)) {
        rows.push({ profile_id: profileId, day_of_week: dow, program_id: ap.program_id,
          workout_id: null as string|null, completed: false, week_start: ws, is_override: false })
      } else {
        const workout = progWorkouts[counter % progWorkouts.length]
        rows.push({ profile_id: profileId, day_of_week: dow, program_id: ap.program_id,
          workout_id: workout.id, completed: false, week_start: ws, is_override: false })
        counter++
      }
    }
    // Upsert all 7 days
    await supabase.from('weekly_plan')
      .upsert(rows, { onConflict: 'profile_id,week_start,day_of_week' })
  }

  async function toggleCompleted(dayOfWeek: number, current: boolean) {
    if (isPastWeek) return
    const entry = weekPlan.find(d => d.day_of_week === dayOfWeek)
    if (!entry) return
    const newCompleted = !current
    setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, completed: newCompleted, missed: false } : d))
    const { data } = await supabase.from('weekly_plan')
      .update({ completed: newCompleted, missed: false }).eq('id', entry.id).select().single()
    if (data) setWeekPlan(prev => prev.map(d => d.id === data.id ? data : d))
    else setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, completed: current } : d))
  }

  async function toggleMissed(dayOfWeek: number) {
    if (isPastWeek) return
    const entry = weekPlan.find(d => d.day_of_week === dayOfWeek)
    if (!entry) return
    const newMissed = !entry.missed
    setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, missed: newMissed, completed: false } : d))
    const { data } = await supabase.from('weekly_plan')
      .update({ missed: newMissed, completed: false }).eq('id', entry.id).select().single()
    if (data) setWeekPlan(prev => prev.map(d => d.id === data.id ? data : d))
    else setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, missed: entry.missed } : d))
  }



  function openAssignSheet(day: number) {
    if (!activeProgram) {
      setSelectingProgramId('')
      setSelectingRecurrence(1)
      setSelectingRestDays([])
      setProgramSheet(true)
      return
    }
    const entry = getDayEntry(day)
    setEditDay(day)
    setSelectedWorkoutId(entry?.workout_id || '')
  }

  async function assignWorkout() {
    const profileId = getProfileId()!
    const programId = activeProgram?.program_id || null
    const workoutId = selectedWorkoutId || null
    const existing = weekPlan.find(d => d.day_of_week === editDay)
    let result
    if (existing) {
      result = await supabase.from('weekly_plan')
        .update({ program_id: programId, workout_id: workoutId, completed: false })
        .eq('id', existing.id).select().single()
    } else {
      result = await supabase.from('weekly_plan')
        .insert({ day_of_week: editDay, program_id: programId, workout_id: workoutId,
          completed: false, week_start: weekStart, profile_id: profileId, is_override: false })
        .select().single()
    }
    if (result.data) setWeekPlan(prev => [...prev.filter(d => d.day_of_week !== editDay), result.data])
    setEditDay(null)
  }

  async function clearDay() {
    // "Repos" = no workout assigned
    const profileId = getProfileId()!
    const existing = weekPlan.find(d => d.day_of_week === editDay)
    if (existing) {
      const updated = { program_id: null as string | null, workout_id: null as string | null, completed: false }
      await supabase.from('weekly_plan').update(updated).eq('id', existing.id)
      setWeekPlan(prev => prev.map(d => d.day_of_week === editDay ? { ...d, ...updated } : d))
    } else {
      // No entry yet → insert a rest row
      const row = {
        profile_id: profileId,
        day_of_week: editDay!,
        program_id: null as string | null,
        workout_id: null as string | null,
        completed: false,
        week_start: weekStart,
        is_override: false,
      }
      const { data } = await supabase.from('weekly_plan').insert(row).select().single()
      if (data) setWeekPlan(prev => [...prev, data])
    }
    setEditDay(null)
  }

  async function startLiveSessionDirect(workout: Workout) {
    if (launching) return
    const profileId = getProfileId()!
    setLaunching(true)
    // Cancel any lingering non-finished session for this profile
    await supabase
      .from('live_sessions')
      .update({ status: 'abandoned', finished_at: new Date().toISOString() })
      .eq('profile_id', profileId)
      .in('status', ['active', 'paused'])
    const { data, error } = await supabase
      .from('live_sessions')
      .insert({ profile_id: profileId, workout_id: workout.id, status: 'active' })
      .select().single()
    setLaunching(false)
    if (error || !data) { console.error(error); return }
    router.push(`/session/live?id=${data.id}`)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-white min-h-screen">
      <Navbar />

      {/* ── Sticky header ── */}
      {(() => {
        const todayDate = new Date(); todayDate.setHours(0,0,0,0)

        // Build 7 day objects for the current view
        const isSemaine = activeTab === 'semaine'
        const days7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(viewMonday); d.setDate(d.getDate() + i); return d
        })
        // For compléments: anchor is today + suppDayOffset, show 7 days around it
        const suppAnchor = new Date(todayDate); suppAnchor.setDate(suppAnchor.getDate() + suppDayOffset)
        const suppWeekMonday = getMonday(suppAnchor)
        const suppDays7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(suppWeekMonday); d.setDate(d.getDate() + i); return d
        })

        const activeDays = isSemaine ? days7 : suppDays7
        const monthLabel = activeDays[0].toLocaleDateString('fr-FR', { month: 'long' })
        const monthEnd = activeDays[6].toLocaleDateString('fr-FR', { month: 'long' })
        const monthDisplay = monthLabel === monthEnd
          ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
          : `${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1,3)}. – ${monthEnd.charAt(0).toUpperCase() + monthEnd.slice(1,3)}.`

        return (
          <div className="sticky top-0 z-20 bg-white border-b border-gray-100"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Tabs — full width */}
            <div className="grid grid-cols-2 border-b border-gray-100">
              {([
                { key: 'semaine', label: '🏋️ Entraînement' },
                { key: 'complements', label: '💊 Compléments' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    'py-3 text-sm font-bold transition-all border-b-2',
                    activeTab === t.key
                      ? 'text-gray-950 border-gray-950'
                      : 'text-gray-400 border-transparent'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="max-w-lg mx-auto px-4 md:px-6 pt-3 pb-3">

              {/* Month */}
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">{monthDisplay}</p>

              {/* Arrows + pills */}
              <div className="flex items-center gap-1 mb-1">
                <button
                  onClick={() => isSemaine ? setWeekOffset(o => o - 1) : setSuppDayOffset(o => o - 7)}
                  disabled={isSemaine ? weekOffset <= minWeekOffset : suppDayOffset - 7 < minDayOffset}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-20 shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div className="flex-1 flex justify-between gap-1">
                  {activeDays.map((d, i) => {
                    const isToday = d.toDateString() === todayDate.toDateString()
                    // Semaine: highlight if workout planned/done
                    const dayEntry = isSemaine ? weekPlan.find(wp => wp.day_of_week === i + 1) : null
                    const hasWorkout = isSemaine && !!dayEntry?.workout_id
                    const done = isSemaine && !!dayEntry?.completed
                    const missed = isSemaine && !!dayEntry?.missed
                    // Compléments: selected day
                    const isSuppSelected = !isSemaine && d.toDateString() === suppAnchor.toDateString()

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                          {['L','M','M','J','V','S','D'][i]}
                        </span>
                        <button
                          disabled={isSemaine || d > todayDate || (!isSemaine && d < createdDate)}
                          onClick={() => {
                            if (!isSemaine) {
                              const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000)
                              setSuppDayOffset(diff)
                            }
                          }}
                          className={cn(
                            'w-full aspect-square max-w-[34px] rounded-xl flex items-center justify-center text-xs font-bold transition-all',
                            isSemaine
                              ? (done ? 'bg-green-500 text-white ring-2 ring-green-300' :
                                 missed ? 'bg-red-500 text-white ring-2 ring-red-300' :
                                 isToday ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]' :
                                 hasWorkout ? 'bg-orange-100 text-orange-600' :
                                 'bg-gray-100 text-gray-400')
                              : (isSuppSelected ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]' :
                                 isToday ? 'bg-gray-200 text-gray-700' :
                                 d > todayDate ? 'bg-gray-50 text-gray-300' :
                                 'bg-gray-100 text-gray-500 active:bg-gray-200')
                          )}
                        >
                          {d.getDate()}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => isSemaine ? setWeekOffset(o => Math.min(0, o + 1)) : setSuppDayOffset(o => Math.min(0, o + 7))}
                  disabled={isSemaine ? isCurrentWeek : suppDayOffset >= 0}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-20 shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              {/* spacer */}
              <div className="hidden">
              </div>
            </div>
          </div>
        )
      })()}

      <main className="max-w-lg mx-auto px-4 md:px-6 pt-4 space-y-3">

        {/* ── Semaine tab ── */}
        <div className={cn('space-y-3', activeTab !== 'semaine' && 'hidden')}>

          {/* Progress card */}
          <div className={cn(
            'rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.12)] relative overflow-hidden',
            isPastWeek ? 'bg-gray-700' : 'bg-gray-950'
          )}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 60%)' }} />

            {/* Left — programme info */}
            <div className="relative flex-1 min-w-0 space-y-1.5">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Programme</p>
              {activeProgram ? (
                <button
                  onClick={() => { setSelectingProgramId(activeProgram.program_id); setSelectingRecurrence(activeProgram.recurrence_months); setSelectingRestDays(activeProgram.rest_days ?? []); setProgramSheet(true) }}
                  className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full truncate max-w-[160px] text-left active:bg-indigo-500/30 transition-colors"
                >
                  {programs.find(p => p.id === activeProgram.program_id)?.name}
                </button>
              ) : (
                <button
                  onClick={() => { setSelectingProgramId(''); setSelectingRecurrence(1); setSelectingRestDays([]); setProgramSheet(true) }}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/60 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                >
                  <span>+ Associer</span>
                </button>
              )}
              {isCurrentWeek && streak > 0 && (
                <p className="text-orange-400 text-xs font-bold">🔥 {streak} sem. consécutive{streak > 1 ? 's' : ''}</p>
              )}
              {isPastWeek && (
                <p className="text-white/40 text-xs font-bold flex items-center gap-1"><Lock size={10}/> Historique</p>
              )}
            </div>

            {/* Right — progress ring */}
            <div className="relative shrink-0 flex flex-col items-center gap-1">
              <ProgressRing done={completedCount} total={scheduledCount} size={72} strokeWidth={7} />
            </div>
          </div>

          {/* Readonly banner */}
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
                  missed={entry?.missed || false}
                  isToday={isToday}
                  isOverride={entry?.is_override || false}
                  isRestDay={!!(entry && !entry.workout_id)}
                  readonly={isPastWeek}
                  onEdit={isPastWeek ? undefined : () => openAssignSheet(dayNum)}
                  onToggle={isPastWeek ? undefined : () => toggleCompleted(dayNum, entry?.completed || false)}
                  onMissed={!isPastWeek && !!entry?.workout_id ? () => toggleMissed(dayNum) : undefined}
                  onLaunch={getWorkoutForDay(dayNum) && !isPastWeek && !entry?.missed ? () => startLiveSessionDirect(getWorkoutForDay(dayNum)!) : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* ── Compléments tab ── */}
        <div className={cn(activeTab !== 'complements' && 'hidden')}>
          <SupplementsTab dayOffset={suppDayOffset} onDayOffsetChange={setSuppDayOffset} />
        </div>
      </main>

      {/* Bottom sheet — assign workout (choose session from active program) */}
      <BottomSheet
        isOpen={editDay !== null}
        onClose={() => setEditDay(null)}
        title={`${editDay ? DAYS[editDay - 1] : ''} — Choisir une séance`}
      >
        <div className="space-y-2.5 pb-2">
          {activeProgram ? (
            <>
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

              {workoutsForProgram(activeProgram.program_id).map((w, i) => (
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

              {workoutsForProgram(activeProgram.program_id).length === 0 && (
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
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center py-6">
              Associe d&apos;abord un programme pour planifier tes séances.
            </p>
          )}
        </div>
      </BottomSheet>

      {/* Bottom sheet — associate a program */}
      <BottomSheet isOpen={programSheet} onClose={() => setProgramSheet(false)} title="Programme de la semaine">
        <div className="space-y-3 pb-4">
          {/* Liste programmes */}
          <div className="space-y-2">
            {programs.map(p => (
              <button key={p.id} onClick={() => setSelectingProgramId(p.id)}
                className={cn('w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all text-sm font-semibold',
                  selectingProgramId === p.id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-100 bg-gray-50 text-gray-700'
                )}>
                {p.name}
                <span className={cn('text-xs ml-2', selectingProgramId === p.id ? 'text-white/50' : 'text-gray-400')}>
                  {workoutsForProgram(p.id).length} séances
                </span>
              </button>
            ))}
            {programs.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">Crée d&apos;abord un programme dans l&apos;onglet Programmes</p>
            )}
          </div>

          {/* Jours de repos */}
          {selectingProgramId && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Jours de repos</p>
              <div className="grid grid-cols-7 gap-1.5">
                {[['L',1],['M',2],['M',3],['J',4],['V',5],['S',6],['D',7]].map(([label, num]) => {
                  const n = num as number
                  const active = selectingRestDays.includes(n)
                  return (
                    <button key={n}
                      onClick={() => setSelectingRestDays(prev => active ? prev.filter(d => d !== n) : [...prev, n])}
                      className={cn(
                        'py-3 rounded-xl text-sm font-black border-2 transition-all',
                        active ? 'border-orange-400 bg-orange-50 text-orange-500' : 'border-gray-100 bg-gray-50 text-gray-700'
                      )}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {selectingRestDays.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {workoutsForProgram(selectingProgramId).length} séances · {7 - selectingRestDays.length} jours d&apos;entraînement
                </p>
              )}
            </div>
          )}

          {/* Récurrence */}
          {selectingProgramId && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Récurrence</p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 6].map(m => (
                  <button key={m} onClick={() => setSelectingRecurrence(m)}
                    className={cn('py-3 rounded-xl text-sm font-black border-2 transition-all',
                      selectingRecurrence === m ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-100 bg-gray-50 text-gray-700'
                    )}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmer */}
          {selectingProgramId && (
            <button onClick={saveActiveProgram} disabled={savingActiveProgram}
              className="w-full bg-gray-950 text-white rounded-2xl font-bold min-h-[52px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
              {savingActiveProgram ? 'Enregistrement...' : '✓ Confirmer'}
            </button>
          )}
        </div>
      </BottomSheet>

    </div>
  )
}
