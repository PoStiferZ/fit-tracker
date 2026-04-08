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
import { Check, Lock, Pencil } from 'lucide-react'

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
  const [launching, setLaunching] = useState(false)

  // Active program
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null)
  const [programSheet, setProgramSheet] = useState(false)
  const [selectingProgramId, setSelectingProgramId] = useState('')
  const [selectingRecurrence, setSelectingRecurrence] = useState<number>(1)
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
    const row = {
      profile_id: profileId,
      program_id: selectingProgramId,
      recurrence_months: selectingRecurrence,
      started_at: formatDateISO(new Date()),
    }
    const { data } = await supabase
      .from('active_program')
      .upsert(row, { onConflict: 'profile_id' })
      .select().single()
    if (data) setActiveProgram(data)
    setSavingActiveProgram(false)
    setProgramSheet(false)
  }

  async function toggleCompleted(dayOfWeek: number, current: boolean) {
    if (isPastWeek) return
    const entry = weekPlan.find(d => d.day_of_week === dayOfWeek)
    if (!entry) return
    // Optimistic update — immediate visual feedback
    setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, completed: !current } : d))
    const { data } = await supabase.from('weekly_plan').update({ completed: !current }).eq('id', entry.id).select().single()
    // Reconcile with server
    if (data) setWeekPlan(prev => prev.map(d => d.id === data.id ? data : d))
    else setWeekPlan(prev => prev.map(d => d.id === entry.id ? { ...d, completed: current } : d)) // rollback
  }

  function openAssignSheet(day: number) {
    if (!activeProgram) {
      setSelectingProgramId('')
      setSelectingRecurrence(1)
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

      {/* ── Sticky week header ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-lg mx-auto px-4 md:px-6">

          {/* Tabs — centred */}
          <div className="flex justify-center gap-1 pt-3 pb-2">
            {([
              { key: 'semaine', label: '🗓 Semaine' },
              { key: 'complements', label: '💊 Compléments' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  activeTab === t.key ? 'bg-gray-950 text-white' : 'text-gray-400'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Week nav with day pills — only in semaine tab */}
          {activeTab === 'semaine' && (() => {
            const days7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(viewMonday)
              d.setDate(d.getDate() + i)
              return d
            })
            const monthLabel = days7[0].toLocaleDateString('fr-FR', { month: 'long' })
            const monthEnd = days7[6].toLocaleDateString('fr-FR', { month: 'long' })
            const monthDisplay = monthLabel === monthEnd
              ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
              : `${monthLabel.slice(0,4)}. – ${monthEnd.slice(0,4)}.`
            const todayDate = new Date()
            return (
              <div className="pb-3">
                {/* Month label */}
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">{monthDisplay}</p>
                {/* Arrows + pills row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setWeekOffset(o => o - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <div className="flex-1 flex justify-between gap-1">
                    {days7.map((d, i) => {
                      const isToday = d.toDateString() === todayDate.toDateString()
                      const dayEntry = weekPlan.find(wp => wp.day_of_week === i + 1)
                      const hasWorkout = !!dayEntry?.workout_id
                      const done = !!dayEntry?.completed
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">
                            {['L','M','M','J','V','S','D'][i]}
                          </span>
                          <div className={cn(
                            'w-full aspect-square max-w-[34px] rounded-xl flex items-center justify-center text-xs font-bold transition-all',
                            isToday && !done ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]' :
                            done ? 'bg-green-500 text-white shadow-[0_2px_6px_rgba(34,197,94,0.35)]' :
                            hasWorkout ? 'bg-orange-100 text-orange-600' :
                            'bg-gray-100 text-gray-400'
                          )}>
                            {done
                              ? <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5,8.5 6.5,12.5 13.5,4.5"/></svg>
                              : d.getDate()
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
                    disabled={isCurrentWeek}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-20 shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 md:px-6 pt-4 space-y-3">

        {/* ── Semaine tab ── */}
        <div className={cn('space-y-3', activeTab !== 'semaine' && 'hidden')}>

          {/* Progress card — compact */}
          <div className={cn(
            'rounded-2xl px-5 py-4 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.12)] relative overflow-hidden',
            isPastWeek ? 'bg-gray-700' : 'bg-gray-950'
          )}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 60%)' }} />
            <div className="relative shrink-0">
              <ProgressRing done={completedCount} total={scheduledCount} size={70} strokeWidth={7} />
            </div>
            <div className="flex-1 relative min-w-0">
              <p className="text-white font-bold text-sm leading-tight">
                {completedCount === scheduledCount && scheduledCount > 0
                  ? '🎉 Semaine complète !'
                  : scheduledCount === 0
                    ? 'Aucune séance planifiée'
                    : `${scheduledCount - completedCount} séance${scheduledCount - completedCount > 1 ? 's' : ''} restante${scheduledCount - completedCount > 1 ? 's' : ''}`}
              </p>
              {isCurrentWeek && streak > 0 && (
                <p className="text-orange-400 text-xs font-bold mt-1">🔥 {streak} sem. consécutive{streak > 1 ? 's' : ''}</p>
              )}
              {isPastWeek && (
                <p className="text-white/40 text-xs font-bold mt-1 flex items-center gap-1"><Lock size={10}/> Historique</p>
              )}
            </div>
            {/* Programme actif — inline */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              {activeProgram ? (
                <>
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">Programme</p>
                  <button
                    onClick={() => { setSelectingProgramId(activeProgram.program_id); setSelectingRecurrence(activeProgram.recurrence_months); setProgramSheet(true) }}
                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 transition-colors"
                  >
                    <p className="text-white text-xs font-bold max-w-[80px] truncate">{programs.find(p => p.id === activeProgram.program_id)?.name}</p>
                    <Pencil size={10} className="text-white/50 shrink-0" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setSelectingProgramId(''); setSelectingRecurrence(1); setProgramSheet(true) }}
                  className="bg-white/10 hover:bg-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
                >
                  + Programme
                </button>
              )}
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
                  isToday={isToday}
                  isOverride={entry?.is_override || false}
                  isRestDay={!!(entry && !entry.workout_id)}
                  readonly={isPastWeek}
                  onEdit={isPastWeek ? undefined : () => openAssignSheet(dayNum)}
                  onToggle={isPastWeek ? undefined : () => toggleCompleted(dayNum, entry?.completed || false)}
                  onLaunch={getWorkoutForDay(dayNum) && !isPastWeek ? () => startLiveSessionDirect(getWorkoutForDay(dayNum)!) : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* ── Compléments tab ── */}
        <div className={cn(activeTab !== 'complements' && 'hidden')}>
          <SupplementsTab />
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
