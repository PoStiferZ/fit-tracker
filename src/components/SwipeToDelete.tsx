'use client'
import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

export function SwipeToDelete({
  children,
  onDelete,
  deleteLabel = 'Supprimer',
  actionWidth = 90,
}: {
  children: React.ReactNode
  onDelete: () => void
  deleteLabel?: string
  actionWidth?: number
}) {
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    dragging.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!dragging.current && Math.abs(dy) > Math.abs(dx)) { startX.current = null; return }
    dragging.current = true
    const newOffset = Math.max(-actionWidth, Math.min(0, (open ? -actionWidth : 0) + dx))
    setOffset(newOffset)
  }
  function onTouchEnd() {
    startX.current = null
    startY.current = null
    if (!dragging.current) return
    dragging.current = false
    if (offset < -actionWidth / 2) {
      setOffset(-actionWidth)
      setOpen(true)
    } else {
      setOffset(0)
      setOpen(false)
    }
  }
  function close() { setOffset(0); setOpen(false) }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete action */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: actionWidth }}
      >
        <button
          onClick={() => { close(); onDelete() }}
          className="w-full flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:opacity-80 transition-opacity"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-bold">{deleteLabel}</span>
        </button>
      </div>
      {/* Sliding content */}
      <div
        style={{ transform: `translateX(${offset}px)`, transition: dragging.current ? 'none' : 'transform 0.25s ease' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
