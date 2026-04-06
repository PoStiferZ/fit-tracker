'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { MOMENTS } from '@/lib/constants'
import type { Supplement, SupplementLog, SupplementLibraryItem } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import SupplementLibrary from '@/components/SupplementLibrary'
import { Settings, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const btnPrimary = 'w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none'
const btnSecondary = 'w-full bg-white text-gray-800 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100'

const CATEGORY_LABELS: Record<string, string> = {
  protein: 'Protéines',
  amino: 'Acides aminés',
  vitamin: 'Vitamines',
  mineral: 'Minéraux',
  booster: 'Boosters',
  recovery: 'Récupération',
  health: 'Santé',
  custom: 'Custom',
}

const CATEGORY_COLORS: Record<string, string> = {
  protein: 'bg-blue-50 text-blue-600',
  amino: 'bg-purple-50 text-purple-600',
  vitamin: 'bg-orange-50 text-orange-600',
  mineral: 'bg-stone-100 text-stone-600',
  booster: 'bg-red-50 text-red-600',
  recovery: 'bg-green-50 text-green-600',
  health: 'bg-teal-50 text-teal-600',
  custom: 'bg-gray-100 text-gray-600',
}

const defaultForm = () => ({
  name: '',
  dosage_type: 'gelule' as 'gelule' | 'poudre',
  dosage_amount: 1,
  moments: [] as string[],
})

type View =
  | 'dashboard'
  | 'manage'
  | 'library'
  | 'create'
  | 'edit'

export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [logs, setLogs] = useState<SupplementLog[]>([])
  const [loading, setLoading] = useState(true)

  // Sheet states
  const [manageOpen, setManageOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) return
    const [{ data: supps }, { data: todayLogs }] = await Promise.all([
      supabase.from('supplements').select('*').eq('profile_id', profileId).order('created_at'),
      supabase.from('supplement_logs').select('*').eq('profile_id', profileId).eq('date', today),
    ])
    setSupplements((supps as Supplement[]) || [])
    setLogs((todayLogs as SupplementLog[]) || [])
    setLoading(false)
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  // ─── Daily check toggle ────────────────────────────────────────
  async function toggleLog(supplementId: string, moment: string) {
    const profileId = getProfileId()!
    const existing = logs.find(l => l.supplement_id === supplementId && l.moment === moment)
    if (existing) {
      await supabase.from('supplement_logs').delete().eq('id', existing.id)
      setLogs(prev => prev.filter(l => l.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('supplement_logs')
        .insert({ supplement_id: supplementId, moment, date: today, profile_id: profileId })
        .select()
        .single()
      if (data) setLogs(prev => [...prev, data as SupplementLog])
    }
  }

  function isLogged(supplementId: string, moment: string) {
    return logs.some(l => l.supplement_id === supplementId && l.moment === moment)
  }

  // ─── Manage: edit ─────────────────────────────────────────────
  function openEdit(s: Supplement) {
    setEditId(s.id)
    setForm({ name: s.name, dosage_type: s.dosage_type, dosage_amount: s.dosage_amount, moments: s.moments })
    setManageOpen(false)
    setFormOpen(true)
  }

  function openCreate() {
    setEditId(null)
    setForm(defaultForm())
    setManageOpen(false)
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    const profileId = getProfileId()!
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      dosage_type: form.dosage_type,
      dosage_amount: form.dosage_amount,
      moments: form.moments,
    }
    if (editId) {
      const { data } = await supabase.from('supplements').update(payload).eq('id', editId).select().single()
      if (data) setSupplements(prev => prev.map(s => s.id === editId ? (data as Supplement) : s))
    } else {
      const { data } = await supabase
        .from('supplements')
        .insert({ ...payload, profile_id: profileId, source: 'custom' })
        .select()
        .single()
      if (data) setSupplements(prev => [...prev, data as Supplement])
    }
    setSaving(false)
    setFormOpen(false)
    setManageOpen(true)
  }

  async function handleDelete(id: string) {
    await supabase.from('supplements').delete().eq('id', id)
    setSupplements(prev => prev.filter(s => s.id !== id))
    setDeleteConfirm(null)
  }

  function toggleMoment(key: string) {
    setForm(f => ({
      ...f,
      moments: f.moments.includes(key) ? f.moments.filter(m => m !== key) : [...f.moments, key],
    }))
  }

  // ─── Library: add supplement ──────────────────────────────────
  async function handleAddFromLibrary(
    item: SupplementLibraryItem,
    config: { dosage_type: 'gelule' | 'poudre'; dosage_amount: number; moments: string[] }
  ) {
    const profileId = getProfileId()!
    const { data } = await supabase
      .from('supplements')
      .insert({
        name: item.name,
        dosage_type: config.dosage_type,
        dosage_amount: config.dosage_amount,
        moments: config.moments,
        profile_id: profileId,
        library_supplement_id: item.id,
        source: 'library',
        description: item.description,
        benefits: item.benefits,
      })
      .select()
      .single()
    if (data) setSupplements(prev => [...prev, data as Supplement])
    setLibraryOpen(false)
    setManageOpen(true)
  }

  // ─── Derived: moments that have at least one supplement ────────
  const activeMoments = MOMENTS.filter(m =>
    supplements.some(s => s.moments.includes(m.key))
  )

  const totalToday = supplements.reduce((acc, s) => acc + s.moments.length, 0)
  const doneToday = logs.length

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-[#f8f8fb] min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Compléments</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {supplements.length === 0
                ? 'Aucun complément'
                : `${doneToday}/${totalToday} pris aujourd&apos;hui`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeMoments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-bold text-gray-700 text-lg">Aucun complément</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">Ajoute tes premiers compléments</p>
            <button
              onClick={() => setManageOpen(true)}
              className="bg-gray-950 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform"
            >
              Gérer mes compléments
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMoments.map(moment => {
              const momentSupps = supplements.filter(s => s.moments.includes(moment.key))
              return (
                <div key={moment.key} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-50 overflow-hidden">
                  {/* Moment header */}
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="font-bold text-gray-800 text-sm">
                      {moment.emoji} {moment.label}
                    </p>
                  </div>
                  {/* Supplements */}
                  <div className="divide-y divide-gray-50">
                    {momentSupps.map(s => {
                      const logged = isLogged(s.id, moment.key)
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleLog(s.id, moment.key)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.99] text-left',
                            logged ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'
                          )}
                        >
                          {/* Checkbox */}
                          <div className={cn(
                            'w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
                            logged
                              ? 'bg-indigo-600 border-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.35)]'
                              : 'border-gray-200'
                          )}>
                            {logged && <Check size={14} className="text-white" strokeWidth={3} />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-semibold text-sm truncate', logged ? 'text-gray-400 line-through' : 'text-gray-900')}>
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {s.dosage_type === 'gelule'
                                ? `${s.dosage_amount} gélule${s.dosage_amount > 1 ? 's' : ''}`
                                : `${s.dosage_amount}g en poudre`}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* FAB — Gérer mes compléments */}
      {supplements.length > 0 && (
        <button
          onClick={() => setManageOpen(true)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 flex items-center gap-2 bg-gray-950 text-white px-4 py-3 rounded-2xl text-sm font-bold shadow-[0_4px_20px_rgba(0,0,0,0.25)] active:scale-95 transition-transform"
        >
          <Settings size={16} />
          Gérer
        </button>
      )}

      {/* ── Sheet: Gérer mes compléments ─── */}
      <BottomSheet isOpen={manageOpen} onClose={() => setManageOpen(false)} title="Mes compléments">
        <div className="space-y-4 pb-4">
          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setManageOpen(false); setLibraryOpen(true) }}
              className="flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-2xl py-3 text-sm font-bold active:scale-95 transition-transform"
            >
              <Plus size={15} /> Bibliothèque
            </button>
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 rounded-2xl py-3 text-sm font-bold active:scale-95 transition-transform"
            >
              <Plus size={15} /> Custom
            </button>
          </div>

          {/* List */}
          {supplements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Aucun complément encore</p>
            </div>
          ) : (
            <div className="space-y-2">
              {supplements.map(s => {
                const cat = (s as Supplement & { category?: string }).category
                const source = s.source || 'custom'
                const catKey = cat || source
                return (
                  <div key={s.id} className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">💊</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', CATEGORY_COLORS[catKey] || 'bg-gray-100 text-gray-500')}>
                            {CATEGORY_LABELS[catKey] || catKey}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium py-0.5">
                            {s.dosage_type === 'gelule'
                              ? `${s.dosage_amount} gél.`
                              : `${s.dosage_amount}g`}
                          </span>
                        </div>
                        {s.moments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.moments.map(mk => {
                              const m = MOMENTS.find(x => x.key === mk)
                              return m ? (
                                <span key={mk} className="text-[10px] font-semibold bg-white text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg">
                                  {m.emoji} {m.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(s)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-xl transition-colors"
                        >
                          <Pencil size={14} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(s.id)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ── Sheet: Bibliothèque ─── */}
      <BottomSheet isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} title="Bibliothèque">
        <SupplementLibrary
          onClose={() => setLibraryOpen(false)}
          onGoToMySupplements={() => { setLibraryOpen(false); setManageOpen(true) }}
          onAddSupplement={handleAddFromLibrary}
          alreadyAddedIds={supplements.map(s => s.library_supplement_id)}
        />
      </BottomSheet>

      {/* ── Sheet: Créer / Modifier ─── */}
      <BottomSheet
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setManageOpen(true) }}
        title={editId ? 'Modifier le complément' : 'Nouveau complément'}
      >
        <div className="space-y-5 pb-4">
          {/* Nom */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Créatine, Whey, Oméga-3..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-base placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-semibold"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['gelule', 'poudre'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, dosage_type: t }))}
                  className={cn(
                    'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                    form.dosage_type === t
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                  )}
                >
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
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, dosage_amount: Math.max(0.5, f.dosage_amount - (f.dosage_type === 'gelule' ? 1 : 0.5)) }))}
                className="w-12 h-12 rounded-2xl bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-all"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-gray-950">{form.dosage_amount}</span>
                <span className="text-gray-400 text-sm ml-1">{form.dosage_type === 'gelule' ? 'gél.' : 'g'}</span>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, dosage_amount: f.dosage_amount + (f.dosage_type === 'gelule' ? 1 : 0.5) }))}
                className="w-12 h-12 rounded-2xl bg-gray-950 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
              >
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
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggleMoment(m.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95',
                    form.moments.includes(m.key)
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                  )}
                >
                  <span>{m.emoji}</span>
                  <span className="text-xs leading-tight">{m.label}</span>
                  {form.moments.includes(m.key) && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || form.moments.length === 0}
            className={btnPrimary}
          >
            {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Créer le complément'}
          </button>
          {form.moments.length === 0 && (
            <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>
          )}
        </div>
      </BottomSheet>

      {/* ── Sheet: Confirmer suppression ─── */}
      <BottomSheet isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer le complément ?">
        <div className="space-y-3 pb-2">
          <p className="text-gray-500 text-sm">L&apos;historique lié sera aussi supprimé.</p>
          <button
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold shadow-[0_4px_14px_rgba(239,68,68,0.30)] active:scale-[0.98] transition-all"
          >
            Supprimer
          </button>
          <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Annuler</button>
        </div>
      </BottomSheet>
    </div>
  )
}
