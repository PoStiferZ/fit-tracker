'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Program, Exercise } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import { Plus, ClipboardList, Trash2, Pencil, Check, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

const btnPrimary = 'w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none'
const btnSecondary = 'w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100'
const inputField = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  // selectedIds is the ordered list for this program
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Drag state
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('*').order('created_at'),
      supabase.from('exercises').select('*').order('name'),
    ]).then(([p, e]) => {
      setPrograms(p.data || [])
      setExercises(e.data || [])
      setLoading(false)
    })
  }, [])

  function openCreate() { setEditId(null); setName(''); setSelectedIds([]); setSheetOpen(true) }
  function openEdit(p: Program) { setEditId(p.id); setName(p.name); setSelectedIds(p.exercise_ids); setSheetOpen(true) }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const payload = { name: name.trim(), exercise_ids: selectedIds }
    if (editId) {
      const { data } = await supabase.from('programs').update(payload).eq('id', editId).select().single()
      if (data) setPrograms(prev => prev.map(p => p.id === editId ? data : p))
    } else {
      const { data } = await supabase.from('programs').insert(payload).select().single()
      if (data) setPrograms(prev => [...prev, data])
    }
    setSaving(false); setSheetOpen(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  function toggleExercise(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  function handleDragStart(index: number) {
    dragIndexRef.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === dropIndex) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const newIds = [...selectedIds]
    const [moved] = newIds.splice(fromIndex, 1)
    newIds.splice(dropIndex, 0, moved)
    setSelectedIds(newIds)
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  // Exercises not yet selected
  const availableExercises = exercises.filter(e => !selectedIds.includes(e.id))
  // Exercises in program, in order
  const selectedExercises = selectedIds
    .map(id => exercises.find(e => e.id === id))
    .filter((e): e is Exercise => !!e)

  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Programmes</h1>
            <p className="text-gray-400 text-sm mt-0.5">{programs.length} programme{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-gray-950 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform">
            <Plus size={16} /> Créer
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
              <ClipboardList size={36} className="text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 text-lg">Aucun programme</p>
            <p className="text-gray-400 text-sm mt-1">Crée ton premier programme</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map(p => {
              const exs = p.exercise_ids
                .map(id => exercises.find(e => e.id === id))
                .filter((e): e is Exercise => !!e)
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-medium">{exs.length} exercice{exs.length !== 1 ? 's' : ''}</p>
                      {exs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {exs.map((e, i) => (
                            <span key={e.id} className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-xl">
                              {i + 1}. {e.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 mt-0.5">
                      <button onClick={() => openEdit(p)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                        <Pencil size={14} className="text-gray-400" />
                      </button>
                      <button onClick={() => setDeleteConfirm(p.id)} className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le programme ?">
        <div className="space-y-3 pb-2">
          <p className="text-gray-500 text-sm">Cette action est irréversible.</p>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.3)] active:scale-[0.98] transition-all">
            Supprimer
          </button>
          <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Annuler</button>
        </div>
      </BottomSheet>

      {/* Create / Edit sheet */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? 'Modifier le programme' : 'Nouveau programme'}>
        <div className="space-y-5 pb-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom du programme</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Push A, Pectoraux..."
              className={inputField + " font-semibold"} />
          </div>

          {/* ── Section: Dans ce programme (drag & drop) ── */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Dans ce programme
              {selectedIds.length > 0 && <span className="text-gray-950 normal-case ml-1">({selectedIds.length})</span>}
            </label>

            {selectedExercises.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-5 text-center">
                <p className="text-sm text-gray-400 font-medium">Aucun exercice sélectionné</p>
                <p className="text-xs text-gray-300 mt-0.5">Ajoute depuis la liste ci-dessous</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {selectedExercises.map((ex, index) => (
                  <div
                    key={ex.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDrop={e => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-2xl border-2 bg-gray-950 border-gray-950 cursor-grab active:cursor-grabbing select-none transition-all',
                      dragOverIndex === index && dragIndexRef.current !== index
                        ? 'opacity-50 scale-[0.98]'
                        : 'opacity-100'
                    )}
                  >
                    <GripVertical size={16} className="text-white/40 shrink-0" />
                    <span className="text-xs font-black text-white/50 w-4 shrink-0">{index + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-white truncate">{ex.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleExercise(ex.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors shrink-0"
                    >
                      <span className="text-white/60 text-base leading-none">×</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section: Exercices disponibles ── */}
          {availableExercises.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Exercices disponibles
              </label>
              <div className="space-y-1.5">
                {availableExercises.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => toggleExercise(ex.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-gray-300 text-left transition-all active:scale-[0.98] min-h-[52px]"
                  >
                    <div className="w-6 h-6 rounded-lg border-2 border-gray-300 flex items-center justify-center shrink-0">
                      <Plus size={12} className="text-gray-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{ex.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {exercises.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">Crée d&apos;abord des exercices</p>
          )}

          <button onClick={handleSave} disabled={saving || !name.trim()} className={btnPrimary}>
            {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Créer le programme'}
          </button>

          {/* Confirm with check icon */}
          {selectedIds.length > 0 && (
            <p className="text-center text-xs text-gray-400 -mt-2">
              <Check size={11} className="inline mr-1" />
              Glisse les exercices pour les réordonner
            </p>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
