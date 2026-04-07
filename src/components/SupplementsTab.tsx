'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { MOMENTS } from '@/lib/constants'
import type { Supplement, SupplementLog } from '@/types'
import DayNav from './DayNav'
import { Check, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Module-level cache so supplements survive tab switches
let cachedSupplements: Supplement[] | null = null

export default function SupplementsTab() {
  const [dayOffset, setDayOffset] = useState(0)
  const [supplements, setSupplements] = useState<Supplement[]>(cachedSupplements ?? [])
  const [logs, setLogs] = useState<SupplementLog[]>([])
  // Only show spinner on first-ever load, not on tab switches
  const [loading, setLoading] = useState(cachedSupplements === null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const mounted = useRef(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const viewDate = addDays(today, dayOffset)
  const viewDateISO = viewDate.toISOString().split('T')[0]
  const isPast = dayOffset < 0

  const load = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) return

    // Only show loading spinner if we have no cached data
    if (cachedSupplements === null) setLoading(true)

    const [sRes, lRes] = await Promise.all([
      supabase.from('supplements').select('*').eq('profile_id', profileId).order('created_at'),
      supabase.from('supplement_log').select('*').eq('date', viewDateISO),
    ])

    const supps: Supplement[] = sRes.data || []
    cachedSupplements = supps

    if (!mounted.current) return
    setSupplements(supps)

    let currentLogs: SupplementLog[] = lRes.data || []

    // Aujourd'hui sans logs → copier silencieusement les logs d'hier (completed uniquement)
    if (dayOffset === 0 && currentLogs.length === 0) {
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      const yesterdayISO = addDays(todayDate, -1).toISOString().split('T')[0]
      const { data: yLogs } = await supabase
        .from('supplement_log').select('*').eq('date', yesterdayISO)
      if (yLogs && yLogs.length > 0) {
        const rows = yLogs
          .filter((l: SupplementLog) => l.completed)
          .map((l: SupplementLog) => ({
            supplement_id: l.supplement_id,
            moment: l.moment,
            date: viewDateISO,
            completed: true,
          }))
        if (rows.length > 0) {
          const { data: inserted } = await supabase.from('supplement_log').insert(rows).select()
          if (inserted && mounted.current) currentLogs = inserted
        }
      }
    }

    if (mounted.current) {
      setLogs(currentLogs)
      setLoading(false)
    }
  }, [viewDateISO, dayOffset])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  async function toggleLog(supplement: Supplement, momentKey: string) {
    if (isPast) return

    const existing = logs.find(l => l.supplement_id === supplement.id && l.moment === momentKey)

    // Optimistic update
    if (existing) {
      const newCompleted = !existing.completed
      setLogs(prev => prev.map(l => l.id === existing.id ? { ...l, completed: newCompleted } : l))
      const { data } = await supabase
        .from('supplement_log')
        .update({ completed: newCompleted })
        .eq('id', existing.id)
        .select().single()
      // Reconcile with server value
      if (data && mounted.current) setLogs(prev => prev.map(l => l.id === data.id ? data : l))
    } else {
      // Optimistic: add a fake log instantly
      const tempId = `temp-${Date.now()}`
      const tempLog: SupplementLog = {
        id: tempId,
        supplement_id: supplement.id,
        profile_id: getProfileId()!,
        moment: momentKey,
        date: viewDateISO,
        completed: true,
      }
      setLogs(prev => [...prev, tempLog])
      const { data } = await supabase
        .from('supplement_log')
        .insert({ supplement_id: supplement.id, moment: momentKey, date: viewDateISO, completed: true })
        .select().single()
      if (data && mounted.current) {
        setLogs(prev => prev.map(l => l.id === tempId ? data : l))
      } else if (!data && mounted.current) {
        // Rollback on failure
        setLogs(prev => prev.filter(l => l.id !== tempId))
      }
    }
  }

  function isCompleted(supplementId: string, momentKey: string) {
    return logs.some(l => l.supplement_id === supplementId && l.moment === momentKey && l.completed)
  }

  const momentGroups = MOMENTS.map(m => ({
    ...m,
    sups: supplements.filter(s => s.moments.includes(m.key)),
  })).filter(m => m.sups.length > 0)

  const totalDoses = momentGroups.reduce((acc, m) => acc + m.sups.length, 0)
  const doneDoses = momentGroups.reduce((acc, m) =>
    acc + m.sups.filter(s => isCompleted(s.id, m.key)).length, 0)

  return (
    <div className="space-y-3">
      {/* Day navigator */}
      <DayNav
        dayOffset={dayOffset}
        onPrev={() => setDayOffset(o => o - 1)}
        onNext={() => setDayOffset(o => Math.min(0, o + 1))}
        dateLabel={formatDayLabel(viewDate)}
      />

      {/* Readonly banner */}
      {isPast && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <Lock size={14} className="text-amber-500 shrink-0" />
          <p className="text-amber-700 text-xs font-semibold">Historique — lecture seule</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : supplements.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="text-4xl mb-3">💊</div>
          <p className="font-bold text-gray-700">Aucun complément</p>
          <p className="text-gray-400 text-sm mt-1">Crée tes compléments dans l&apos;onglet dédié</p>
        </div>
      ) : momentGroups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="text-4xl mb-3">💊</div>
          <p className="font-bold text-gray-700">Aucun moment configuré</p>
        </div>
      ) : (
        <>
          {/* Daily progress bar */}
          <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">
                {doneDoses === totalDoses && totalDoses > 0 ? '✅ Tout pris !' : `${doneDoses}/${totalDoses} pris`}
              </p>
              {totalDoses > 0 && (
                <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${(doneDoses / totalDoses) * 100}%` }}
                  />
                </div>
              )}
            </div>
            {isPast && <Lock size={14} className="text-gray-300 shrink-0" />}
          </div>

          {momentGroups.map(({ key, label, emoji, sups }) => {
            const doneInMoment = sups.filter(s => isCompleted(s.id, key)).length
            const allDone = doneInMoment === sups.length
            const isOpen = expanded === key || expanded === null

            return (
              <div key={key} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5"
                  onClick={() => setExpanded(prev => prev === key ? null : key)}
                >
                  <span className="text-xl">{emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-900 text-sm">{label}</p>
                    <p className="text-xs text-gray-400">{doneInMoment}/{sups.length} pris</p>
                  </div>
                  {allDone && (
                    <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg">✓ Fait</span>
                  )}
                  {isOpen
                    ? <ChevronUp size={16} className="text-gray-300 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-300 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {sups.map(s => {
                      const done = isCompleted(s.id, key)
                      return (
                        <div key={s.id} className={cn(
                          'flex items-center gap-3 px-4 py-3.5 transition-colors',
                          done && 'bg-green-50/50'
                        )}>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-semibold', done ? 'text-gray-400 line-through' : 'text-gray-900')}>
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {s.dosage_type === 'gelule'
                                ? `${s.dosage_amount} gélule${s.dosage_amount > 1 ? 's' : ''}`
                                : `${s.dosage_amount}g`}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleLog(s, key)}
                            disabled={isPast}
                            className={cn(
                              'w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all shrink-0',
                              done
                                ? 'bg-green-500 border-green-500 shadow-[0_2px_8px_rgba(34,197,94,0.3)]'
                                : isPast
                                  ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-400 active:scale-90'
                            )}
                          >
                            {done && <Check size={16} className="text-white" strokeWidth={3} />}
                            {!done && isPast && <Lock size={12} className="text-gray-300" />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
