'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import Navbar from '@/components/Navbar'
import { ChevronRight, History } from 'lucide-react'
import type { LiveSession } from '@/types'

interface SessionWithWorkout extends LiveSession {
  workouts: {
    name: string
    programs: {
      name: string
    } | null
  } | null
  completedSets?: number
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '')
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const min = Math.round(ms / 60000)
  return `${min}min`
}

export default function HistoryPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionWithWorkout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profileId = getProfileId()
      if (!profileId) { setLoading(false); return }

      const { data, error } = await supabase
        .from('live_sessions')
        .select('*, workouts(name, programs(name))')
        .eq('profile_id', profileId)
        .eq('status', 'finished')
        .order('started_at', { ascending: false })

      if (error || !data) { setLoading(false); return }

      const sessionIds = data.map((s: SessionWithWorkout) => s.id)

      // Fetch completed sets count for all sessions
      let setsCountMap: Record<string, number> = {}
      if (sessionIds.length > 0) {
        const { data: setsData } = await supabase
          .from('live_session_sets')
          .select('live_session_id, id')
          .in('live_session_id', sessionIds)
          .eq('skipped', false)

        if (setsData) {
          for (const row of setsData) {
            setsCountMap[row.live_session_id] = (setsCountMap[row.live_session_id] || 0) + 1
          }
        }
      }

      const enriched = data.map((s: SessionWithWorkout) => ({
        ...s,
        completedSets: setsCountMap[s.id] || 0,
      }))

      setSessions(enriched)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f8fb] md:pl-60">
      <Navbar />

      <div className="max-w-xl mx-auto px-4 pt-6 pb-28 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gray-950 flex items-center justify-center">
            <History size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-950">Historique</h1>
            <p className="text-xs text-gray-400">Séances terminées</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🏋️</div>
            <p className="font-bold text-gray-700 text-lg">Aucune séance terminée</p>
            <p className="text-sm text-gray-400 mt-1">Tes séances apparaîtront ici une fois terminées.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const workoutName = session.workouts?.name ?? 'Séance inconnue'
              const programName = session.workouts?.programs?.name ?? ''
              return (
                <button
                  key={session.id}
                  onClick={() => router.push(`/history/${session.id}`)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow border border-gray-50 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{workoutName}</p>
                      {programName && <p className="text-xs text-gray-400">{programName}</p>}
                    </div>
                    <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      📅 {formatDate(session.started_at)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      ⏱ {formatDuration(session.started_at, session.finished_at)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      ✅ {session.completedSets} série{session.completedSets !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
