'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOMENTS } from '@/lib/constants'
import type { Supplement } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const btnPrimary = 'w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none'
const btnSecondary = 'w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100'
const inputField = 'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all'

const defaultForm = () => ({
  name: '',
  dosage_type: 'gelule' as 'gelule' | 'poudre',
  dosage_amount: 1,
  moments: [] as string[],
})

export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('supplements').select('*').order('created_at')
      .then(({ data }) => { setSupplements(data || []); setLoading(false) })
  }, [])

  function openCreate() { setEditId(null); setForm(defaultForm()); setSheetOpen(true) }
  function openEdit(s: Supplement) {
    setEditId(s.id)
    setForm({ name: s.name, dosage_type: s.dosage_type, dosage_amount: s.dosage_amount, moments: s.moments })
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { name: form.name.trim(), dosage_type: form.dosage_type, dosage_amount: form.dosage_amount, moments: form.moments }
    if (editId) {
      const { data } = await supabase.from('supplements').update(payload).eq('id', editId).select().single()
      if (data) setSupplements(prev => prev.map(s => s.id === editId ? data : s))
    } else {
      const { data } = await supabase.from('supplements').insert(payload).select().single()
      if (data) setSupplements(prev => [...prev, data])
    }
    setSaving(false); setSheetOpen(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('supplements').delete().eq('id', id)
    setSupplements(prev => prev.filter(s => s.id !== id))
    setDeleteConfirm(null)
  }

  function toggleMoment(key: string) {
    setForm(f => ({ ...f, moments: f.moments.includes(key) ? f.moments.filter(m => m !== key) : [...f.moments, key] }))
  }

  return (
    <div className="sm:pl-60 pb-28 sm:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 sm:px-6 sm:pt-6">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Compléments</h1>
            <p className="text-gray-400 text-sm mt-0.5">{supplements.length} complément{supplements.length !== 1 ? 's' : ''}</p>
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
        ) : supplements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-bold text-gray-700 text-lg">Aucun complément</p>
            <p className="text-gray-400 text-sm mt-1">Crée ton premier complément</p>
          </div>
        ) : (
          <div className="space-y-3">
            {supplements.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">💊</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">
                      {s.dosage_type === 'gelule'
                        ? `${s.dosage_amount} gélule${s.dosage_amount > 1 ? 's' : ''}`
                        : `${s.dosage_amount}g en poudre`}
                    </p>
                    {s.moments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.moments.map(mk => {
                          const m = MOMENTS.find(x => x.key === mk)
                          return m ? (
                            <span key={mk} className="text-[11px] font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl">
                              {m.emoji} {m.label}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(s)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteConfirm(s.id)} className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le complément ?">
        <div className="space-y-3 pb-2">
          <p className="text-gray-500 text-sm">L&apos;historique lié sera aussi supprimé.</p>
          <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.30)] active:scale-[0.98] transition-all">
            Supprimer
          </button>
          <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Annuler</button>
        </div>
      </BottomSheet>

      {/* Create / Edit */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? 'Modifier le complément' : 'Nouveau complément'}>
        <div className="space-y-5 pb-4">

          {/* Nom */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Créatine, Whey, Oméga-3..."
              className={inputField + " font-semibold"} />
          </div>

          {/* Type de dosage */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['gelule', 'poudre'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, dosage_type: t }))}
                  className={cn(
                    'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                    form.dosage_type === t
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                  )}>
                  {t === 'gelule' ? '💊 Gélule' : '🥄 Poudre'}
                </button>
              ))}
            </div>
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Dosage {form.dosage_type === 'gelule' ? '(nb de gélules)' : '(grammes)'}
            </label>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setForm(f => ({ ...f, dosage_amount: Math.max(0.5, f.dosage_amount - (f.dosage_type === 'gelule' ? 1 : 0.5)) }))}
                className="w-12 h-12 rounded-2xl bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-all">
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-gray-950">{form.dosage_amount}</span>
                <span className="text-gray-400 text-sm ml-1">{form.dosage_type === 'gelule' ? 'gél.' : 'g'}</span>
              </div>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, dosage_amount: f.dosage_amount + (f.dosage_type === 'gelule' ? 1 : 0.5) }))}
                className="w-12 h-12 rounded-2xl bg-gray-950 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
                +
              </button>
            </div>
          </div>

          {/* Moments */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Quand prendre{form.moments.length > 0 && <span className="text-gray-950 normal-case ml-1">({form.moments.length})</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MOMENTS.map(m => (
                <button key={m.key} type="button" onClick={() => toggleMoment(m.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95',
                    form.moments.includes(m.key)
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                  )}>
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                  {form.moments.includes(m.key) && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || !form.name.trim() || form.moments.length === 0} className={btnPrimary}>
            {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Créer le complément'}
          </button>
          {form.moments.length === 0 && <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>}
        </div>
      </BottomSheet>
    </div>
  )
}
