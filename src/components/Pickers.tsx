'use client'
import { useEffect, useRef, useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

// ─── DrumRoll ─────────────────────────────────────────────────────────────────
export function DrumRoll({
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
  const VISIBLE = 5
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)

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
      <div
        className="absolute left-0 right-0 rounded-xl bg-gray-100 pointer-events-none z-10"
        style={{ top: padCount * ITEM_H, height: ITEM_H }}
      />
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none"
        style={{ height: padCount * ITEM_H, background: 'linear-gradient(to bottom, rgba(248,248,251,1), rgba(248,248,251,0))' }} />
      <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
        style={{ height: padCount * ITEM_H, background: 'linear-gradient(to top, rgba(248,248,251,1), rgba(248,248,251,0))' }} />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll scrollbar-hide"
        style={{ height: VISIBLE * ITEM_H, scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
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
        {Array(padCount).fill(null).map((_, i) => (
          <div key={`pad-bot-${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'start' }} />
        ))}
      </div>
    </div>
  )
}

// ─── WeightPickerSheet ────────────────────────────────────────────────────────
export function WeightPickerSheet({
  isOpen, value, onClose, onConfirm,
}: {
  isOpen: boolean; value: number; onClose: () => void; onConfirm: (kg: number) => void
}) {
  const decimals = [0, 0.25, 0.5, 0.75]
  const integers = Array.from({ length: 301 }, (_, i) => i)

  const [intIdx, setIntIdx] = useState(Math.floor(value))
  const [decIdx, setDecIdx] = useState(0)

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
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums">{combined}</span>
          <span className="text-lg font-bold text-gray-400 ml-1">kg</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <DrumRoll items={integers} selectedIndex={intIdx} onSelect={setIntIdx} width={80} />
          <span className="text-2xl font-black text-gray-300 pb-1">.</span>
          <DrumRoll
            items={decimals.map(d => d === 0 ? '00' : String(d).slice(2).padEnd(2, '0'))}
            selectedIndex={decIdx} onSelect={setDecIdx} width={64}
          />
          <span className="text-base font-bold text-gray-400 pb-1">kg</span>
        </div>
        <button onClick={() => onConfirm(combined)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          Valider
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── RepsPickerSheet ──────────────────────────────────────────────────────────
export function RepsPickerSheet({
  isOpen, value, onClose, onConfirm,
}: {
  isOpen: boolean; value: number; onClose: () => void; onConfirm: (reps: number) => void
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
        <button onClick={() => onConfirm(idx + 1)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          Valider
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── DurationPickerSheet — mm:ss drum roll ────────────────────────────────────
export function DurationPickerSheet({
  isOpen, value, onClose, onConfirm,
}: {
  isOpen: boolean
  /** value in seconds */
  value: number
  onClose: () => void
  onConfirm: (seconds: number) => void
}) {
  const mins = Array.from({ length: 121 }, (_, i) => i)        // 0–120 min
  const secs = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] // steps of 5s

  const [mIdx, setMIdx] = useState(Math.floor(value / 60))
  const [sIdx, setSIdx] = useState(Math.max(0, secs.indexOf(Math.round((value % 60) / 5) * 5)))

  useEffect(() => {
    if (!isOpen) return
    setMIdx(Math.min(120, Math.floor(value / 60)))
    const nearestSec = Math.round((value % 60) / 5) * 5
    const si = secs.indexOf(nearestSec)
    setSIdx(si >= 0 ? si : 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value])

  const totalSecs = mins[mIdx] * 60 + secs[sIdx]
  const preview = `${String(mins[mIdx]).padStart(2, '0')}:${String(secs[sIdx]).padStart(2, '0')}`

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Durée">
      <div className="pb-4 space-y-5">
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums font-mono">{preview}</span>
          <span className="text-lg font-bold text-gray-400 ml-2">min</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <DrumRoll items={mins} selectedIndex={mIdx} onSelect={setMIdx} width={72} />
          <span className="text-2xl font-black text-gray-300">:</span>
          <DrumRoll
            items={secs.map(s => String(s).padStart(2, '0'))}
            selectedIndex={sIdx} onSelect={setSIdx} width={72}
          />
          <span className="text-sm font-bold text-gray-400">min : sec</span>
        </div>
        <button onClick={() => onConfirm(totalSecs)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          Valider
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── SpeedPickerSheet — 0.0 to 30.0 km/h ─────────────────────────────────────
export function SpeedPickerSheet({
  isOpen, value, onClose, onConfirm,
}: {
  isOpen: boolean; value: number; onClose: () => void; onConfirm: (kmh: number) => void
}) {
  // integer part 0–30, decimal 0 or 5
  const ints = Array.from({ length: 31 }, (_, i) => i)
  const decs = [0, 5]

  const [intIdx, setIntIdx] = useState(Math.floor(value))
  const [decIdx, setDecIdx] = useState(Math.round((value % 1) * 10) === 5 ? 1 : 0)

  useEffect(() => {
    if (!isOpen) return
    setIntIdx(Math.min(30, Math.floor(value)))
    setDecIdx(Math.round((value % 1) * 10) === 5 ? 1 : 0)
  }, [isOpen, value])

  const combined = +(intIdx + decs[decIdx] / 10).toFixed(1)

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Vitesse">
      <div className="pb-4 space-y-5">
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums">{combined}</span>
          <span className="text-lg font-bold text-gray-400 ml-1">km/h</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <DrumRoll items={ints} selectedIndex={intIdx} onSelect={setIntIdx} width={72} />
          <span className="text-2xl font-black text-gray-300">.</span>
          <DrumRoll
            items={decs.map(d => String(d))}
            selectedIndex={decIdx} onSelect={setDecIdx} width={48}
          />
          <span className="text-sm font-bold text-gray-400">km/h</span>
        </div>
        <button onClick={() => onConfirm(combined)}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          Valider
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── InclinePickerSheet — 0 to 20% par 0.5 ───────────────────────────────────
export function InclinePickerSheet({
  isOpen, value, onClose, onConfirm,
}: {
  isOpen: boolean; value: number; onClose: () => void; onConfirm: (pct: number) => void
}) {
  // 0, 0.5, 1, 1.5 … 20
  const items = Array.from({ length: 41 }, (_, i) => +(i * 0.5).toFixed(1))
  const [idx, setIdx] = useState(Math.round(value / 0.5))

  useEffect(() => {
    if (isOpen) setIdx(Math.min(40, Math.round(value / 0.5)))
  }, [isOpen, value])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Pente / Résistance">
      <div className="pb-4 space-y-5">
        <div className="text-center">
          <span className="text-4xl font-black text-gray-950 tabular-nums">{items[idx]}</span>
          <span className="text-lg font-bold text-gray-400 ml-1">%</span>
        </div>
        <div className="flex justify-center">
          <DrumRoll items={items} selectedIndex={idx} onSelect={setIdx} width={80} />
          <span className="self-center ml-2 text-sm font-bold text-gray-400">%</span>
        </div>
        <button onClick={() => onConfirm(items[idx])}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]">
          Valider
        </button>
      </div>
    </BottomSheet>
  )
}
