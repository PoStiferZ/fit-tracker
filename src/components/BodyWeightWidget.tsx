'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateISO } from '@/lib/utils'
import type { BodyWeightEntry } from '@/types'
import { Plus, Check, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  profileId: string
}

const HISTORY_COUNT = 8

function relativeDate(dateStr: string): string {
  const today = formatDateISO(new Date())
  if (dateStr === today) return "Aujourd'hui"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === formatDateISO(yesterday)) return 'Hier'
  const diff = Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000)
  return `Il y a ${diff} jours`
}

export default function BodyWeightWidget({ profileId }: Props) {
  const [entries, setEntries] = useState<BodyWeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)

  const today = formatDateISO(new Date())

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('body_weight_log')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: false })
      .limit(HISTORY_COUNT)
    // Keep ascending for chart rendering
    setEntries((data || []).slice().reverse())
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  const latest = entries[entries.length - 1]
  const todayEntry = entries.find(e => e.date === today)

  function startAdding() {
    setInputVal(todayEntry ? String(todayEntry.weight_kg) : '')
    setAdding(true)
  }

  async function handleSave() {
    const val = parseFloat(inputVal)
    if (!val || val <= 0) return
    setSaving(true)
    if (todayEntry) {
      const { data } = await supabase
        .from('body_weight_log')
        .update({ weight_kg: val })
        .eq('id', todayEntry.id)
        .select()
        .single()
      if (data) setEntries(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      const { data } = await supabase
        .from('body_weight_log')
        .insert({ profile_id: profileId, weight_kg: val, date: today })
        .select()
        .single()
      if (data) setEntries(prev => [...prev, data])
    }
    setSaving(false)
    setAdding(false)
    setInputVal('')
  }

  // SVG polyline — adaptive Y axis
  const svgW = 260
  const svgH = 64
  const padX = 4
  const padY = 8

  const chartData = (() => {
    if (entries.length < 2) return null
    const weights = entries.map(e => e.weight_kg)
    const minW = Math.min(...weights)
    const maxW = Math.max(...weights)
    const rangeW = maxW - minW || 1
    const n = entries.length

    const points = entries.map((e, i) => {
      const x = padX + (i / (n - 1)) * (svgW - padX * 2)
      const y = padY + (1 - (e.weight_kg - minW) / rangeW) * (svgH - padY * 2)
      return { x, y, entry: e }
    })
    const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return { points, polyline, minW: minW.toFixed(1), maxW: maxW.toFixed(1) }
  })()

  if (loading) return null

  // Empty state
  if (entries.length === 0 && !adding) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-5">
        <div className="flex flex-col items-center text-center py-2 gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Scale size={22} className="text-gray-400" />
          </div>
          <div>
            <p className="font-bold text-gray-700 text-sm">Poids corporel</p>
            <p className="text-xs text-gray-400 mt-0.5">Suis ton évolution dans le temps</p>
          </div>
          <button
            onClick={startAdding}
            className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform min-h-[44px]"
          >
            <Plus size={14} /> Enregistrer mon poids
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Poids corporel</p>
          {latest ? (
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-black text-gray-950 tabular-nums">{latest.weight_kg}</span>
              <span className="text-sm font-bold text-gray-400">kg</span>
              <span className="text-xs text-gray-400 font-medium ml-1.5">{relativeDate(latest.date)}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400 font-semibold mt-0.5">—</p>
          )}
        </div>
        {!adding && (
          <button
            onClick={startAdding}
            className="w-10 h-10 flex items-center justify-center bg-gray-950 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.2)] shrink-0 active:scale-95 transition-transform"
          >
            <Plus size={18} className="text-white" />
          </button>
        )}
      </div>

      {/* Inline input */}
      {adding && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="300"
              autoFocus
              placeholder="75.5"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-base font-bold text-gray-900 focus:outline-none focus:border-gray-950 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">kg</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !inputVal}
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-xl transition-all min-h-[44px] shrink-0',
              inputVal ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            )}
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check size={16} strokeWidth={3} />
            }
          </button>
          <button
            onClick={() => setAdding(false)}
            className="w-10 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0 min-h-[44px] text-base"
          >
            ✕
          </button>
        </div>
      )}

      {/* SVG chart */}
      {chartData && (
        <div>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ height: svgH }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="bwFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#111827" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#111827" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Filled area */}
            <polygon
              points={`${padX},${svgH - padY} ${chartData.polyline} ${svgW - padX},${svgH - padY}`}
              fill="url(#bwFill)"
            />
            {/* Line */}
            <polyline
              points={chartData.polyline}
              fill="none"
              stroke="#111827"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots */}
            {chartData.points.map((p, i) => {
              const isLast = i === chartData.points.length - 1
              return (
                <circle
                  key={p.entry.id}
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? 4 : 2.5}
                  fill={isLast ? '#111827' : '#d1d5db'}
                  stroke="white"
                  strokeWidth="1.5"
                />
              )
            })}
          </svg>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-semibold text-gray-400">{chartData.minW} kg</span>
            <span className="text-[10px] font-semibold text-gray-400">{entries.length} mesures</span>
            <span className="text-[10px] font-semibold text-gray-400">{chartData.maxW} kg</span>
          </div>
        </div>
      )}

      {entries.length === 1 && !adding && (
        <p className="text-[11px] text-gray-400 text-center mt-1">
          Ajoute d&apos;autres entrées pour voir la courbe
        </p>
      )}
    </div>
  )
}
