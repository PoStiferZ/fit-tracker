'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileId } from '@/lib/cookies'
import { MOMENTS } from '@/lib/constants'
import type { Supplement, SupplementLog, SupplementLibraryItem } from '@/types'
import Navbar from '@/components/Navbar'
import BottomSheet from '@/components/BottomSheet'
import { Search, ArrowLeft, Check, Pencil, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

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

const LIBRARY_CATEGORIES = ['all', 'protein', 'amino', 'vitamin', 'mineral', 'booster', 'recovery', 'health'] as const
type LibraryCategory = typeof LIBRARY_CATEGORIES[number]

type ActiveTab = 'library' | 'mine'

interface ConfigForm {
  dosage_type: 'gelule' | 'poudre'
  dosage_amount: number
  moments: string[]
}

const defaultConfig = (): ConfigForm => ({
  dosage_type: 'gelule',
  dosage_amount: 1,
  moments: [],
})

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupplementsPage() {
  // ── User data ──────────────────────────────────────────────────
  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [logs, setLogs] = useState<SupplementLog[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  // ── Library data ───────────────────────────────────────────────
  const [libraryItems, setLibraryItems] = useState<SupplementLibraryItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)

  // ── Tab & search ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('library')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('all')

  // ── Detail sheet (library item) ────────────────────────────────
  const [selectedItem, setSelectedItem] = useState<SupplementLibraryItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [config, setConfig] = useState<ConfigForm>(defaultConfig())
  const [saving, setSaving] = useState(false)

  // ── Edit supplement (user's supplement) ───────────────────────
  const [editSupplement, setEditSupplement] = useState<Supplement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<ConfigForm>(defaultConfig())
  const [editSaving, setEditSaving] = useState(false)

  // ── Delete confirm ─────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Create custom supplement ────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ConfigForm & { name: string }>({
    name: '', dosage_type: 'gelule', dosage_amount: 1, moments: [],
  })
  const [createSaving, setCreateSaving] = useState(false)

  function toggleCreateMoment(key: string) {
    setCreateForm(f => ({
      ...f,
      moments: f.moments.includes(key) ? f.moments.filter(m => m !== key) : [...f.moments, key],
    }))
  }

  async function handleCreateCustom() {
    if (!createForm.name.trim() || createForm.moments.length === 0) return
    const profileId = getProfileId()!
    setCreateSaving(true)
    const { data } = await supabase.from('supplements').insert({
      name: createForm.name.trim(),
      dosage_type: createForm.dosage_type,
      dosage_amount: createForm.dosage_amount,
      moments: createForm.moments,
      profile_id: profileId,
      source: 'custom',
    }).select().single()
    if (data) setSupplements(prev => [...prev, data as Supplement])
    setCreateSaving(false)
    setCreateOpen(false)
    setCreateForm({ name: '', dosage_type: 'gelule', dosage_amount: 1, moments: [] })
  }

  // ─── Load data ────────────────────────────────────────────────
  const loadUserData = useCallback(async () => {
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

  useEffect(() => { loadUserData() }, [loadUserData])

  useEffect(() => {
    supabase
      .from('supplement_library')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setLibraryItems((data as SupplementLibraryItem[]) || [])
        setLibraryLoading(false)
      })
  }, [])

  // ─── Daily log toggle ─────────────────────────────────────────
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

  // ─── Library: open detail ────────────────────────────────────
  function openDetail(item: SupplementLibraryItem) {
    setSelectedItem(item)
    setConfiguring(false)
    setConfig({
      dosage_type: 'gelule',
      dosage_amount: 1,
      moments: item.recommended_moments.slice(0, 1),
    })
    setDetailOpen(true)
  }

  function toggleConfigMoment(key: string) {
    setConfig(c => ({
      ...c,
      moments: c.moments.includes(key) ? c.moments.filter(m => m !== key) : [...c.moments, key],
    }))
  }

  // ─── Library: add supplement ─────────────────────────────────
  async function handleAddFromLibrary() {
    if (!selectedItem || config.moments.length === 0) return
    const profileId = getProfileId()!
    setSaving(true)
    const { data } = await supabase
      .from('supplements')
      .insert({
        name: selectedItem.name,
        dosage_type: config.dosage_type,
        dosage_amount: config.dosage_amount,
        moments: config.moments,
        profile_id: profileId,
        library_supplement_id: selectedItem.id,
        source: 'library',
        description: selectedItem.description,
        benefits: selectedItem.benefits,
      })
      .select()
      .single()
    if (data) setSupplements(prev => [...prev, data as Supplement])
    setSaving(false)
    setDetailOpen(false)
    setSelectedItem(null)
    setConfiguring(false)
  }

  // ─── Edit supplement ─────────────────────────────────────────
  function openEditSupplement(s: Supplement) {
    setEditSupplement(s)
    setEditForm({ dosage_type: s.dosage_type, dosage_amount: s.dosage_amount, moments: s.moments })
    setEditOpen(true)
  }

  function toggleEditMoment(key: string) {
    setEditForm(f => ({
      ...f,
      moments: f.moments.includes(key) ? f.moments.filter(m => m !== key) : [...f.moments, key],
    }))
  }

  async function handleEditSave() {
    if (!editSupplement || editForm.moments.length === 0) return
    setEditSaving(true)
    const { data } = await supabase
      .from('supplements')
      .update({ dosage_type: editForm.dosage_type, dosage_amount: editForm.dosage_amount, moments: editForm.moments })
      .eq('id', editSupplement.id)
      .select()
      .single()
    if (data) setSupplements(prev => prev.map(s => s.id === editSupplement.id ? (data as Supplement) : s))
    setEditSaving(false)
    setEditOpen(false)
    setEditSupplement(null)
  }

  // ─── Delete supplement ────────────────────────────────────────
  async function handleDelete(id: string) {
    await supabase.from('supplements').delete().eq('id', id)
    setSupplements(prev => prev.filter(s => s.id !== id))
    setDeleteConfirm(null)
  }

  // ─── Derived ──────────────────────────────────────────────────
  const alreadyAddedIds = supplements.map(s => s.library_supplement_id)
  const activeMoments = MOMENTS.filter(m => supplements.some(s => s.moments.includes(m.key)))

  const filteredLibrary = libraryItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'all' || item.category === activeCategory
    return matchSearch && matchCat
  })

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="md:pl-60 pb-28 md:pb-8 bg-white min-h-screen">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 pt-5 md:px-6 md:pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-950">Compléments</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {supplements.length === 0
                ? 'Aucun complément sélectionné'
                : `${supplements.length} sélectionné${supplements.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 mb-5">
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all',
              activeTab === 'library'
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            Bibliothèque
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={cn(
              'flex-1 py-2.5 text-sm font-bold rounded-xl transition-all',
              activeTab === 'mine'
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            Mes compléments
            {supplements.length > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full',
                activeTab === 'mine' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'
              )}>
                {supplements.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: Bibliothèque ─── */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un complément..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              />
            </div>

            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {LIBRARY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all',
                    activeCategory === cat
                      ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                      : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                  )}
                >
                  {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Library list */}
            {libraryLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">Aucun résultat</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLibrary.map(item => {
                  const isAdded = alreadyAddedIds.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => openDetail(item)}
                      className={cn(
                        'w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98]',
                        isAdded
                          ? 'bg-indigo-50/60 border-indigo-100 shadow-[0_2px_8px_rgba(99,102,241,0.08)]'
                          : 'bg-white border-gray-50 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">💊</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                            {isAdded && (
                              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg">✓ Ajouté</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-500')}>
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                            {item.recommended_moments.slice(0, 2).map(mk => {
                              const m = MOMENTS.find(x => x.key === mk)
                              return m ? (
                                <span key={mk} className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">
                                  {m.emoji}
                                </span>
                              ) : null
                            })}
                            {item.recommended_moments.length > 2 && (
                              <span className="text-[11px] text-gray-400">+{item.recommended_moments.length - 2}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-gray-300 shrink-0 mt-1">›</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Mes compléments ─── */}
        {activeTab === 'mine' && (
          loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeMoments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">💊</div>
              <p className="font-bold text-gray-700 text-lg">Aucun complément</p>
              <p className="text-gray-400 text-sm mt-1 mb-6">Crée un complément personnalisé ou explore la bibliothèque</p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => { setCreateForm({ name: '', dosage_type: 'gelule', dosage_amount: 1, moments: [] }); setCreateOpen(true) }}
                  className="bg-gray-950 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.2)] active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={15} /> Créer un complément
                </button>
                <button
                  onClick={() => setActiveTab('library')}
                  className="bg-white text-gray-700 px-6 py-3 rounded-2xl text-sm font-bold border border-gray-200 active:scale-95 transition-transform"
                >
                  Voir la bibliothèque
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Create custom button */}
              <button
                onClick={() => { setCreateForm({ name: '', dosage_type: 'gelule', dosage_amount: 1, moments: [] }); setCreateOpen(true) }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-400 hover:border-gray-950 hover:text-gray-950 transition-all"
              >
                <Plus size={15} /> Créer un complément personnalisé
              </button>

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
                          <div key={s.id} className={cn('flex items-center gap-3 px-4 py-3.5 transition-all', logged ? 'bg-indigo-50/40' : '')}>
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleLog(s.id, moment.key)}
                              className={cn(
                                'w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
                                logged
                                  ? 'bg-indigo-600 border-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.35)]'
                                  : 'border-gray-200'
                              )}
                            >
                              {logged && <Check size={14} className="text-white" strokeWidth={3} />}
                            </button>

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

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEditSupplement(s)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
                              >
                                <Pencil size={13} className="text-gray-400" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(s.id)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-red-50 rounded-xl transition-colors"
                              >
                                <Trash2 size={13} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </main>

      {/* ── BottomSheet: Détail complément (bibliothèque) ─── */}
      <BottomSheet
        isOpen={detailOpen && !configuring}
        onClose={() => { setDetailOpen(false); setSelectedItem(null) }}
        title={selectedItem?.name ?? ''}
      >
        {selectedItem && (
          <div className="space-y-5 pb-4">
            {/* Category badge */}
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-xl', CATEGORY_COLORS[selectedItem.category] || 'bg-gray-100 text-gray-500')}>
                {CATEGORY_LABELS[selectedItem.category] || selectedItem.category}
              </span>
              {alreadyAddedIds.includes(selectedItem.id) && (
                <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-xl">✓ Ajouté</span>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm leading-relaxed">{selectedItem.description}</p>

            {/* Benefits */}
            {selectedItem.benefits.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bienfaits</p>
                <ul className="space-y-1.5">
                  {selectedItem.benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended moments */}
            {selectedItem.recommended_moments.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Moments recommandés</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.recommended_moments.map(mk => {
                    const m = MOMENTS.find(x => x.key === mk)
                    return m ? (
                      <span key={mk} className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl">
                        {m.emoji} {m.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            {alreadyAddedIds.includes(selectedItem.id) ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const existing = supplements.find(s => s.library_supplement_id === selectedItem.id)
                    if (existing) openEditSupplement(existing)
                    setDetailOpen(false)
                  }}
                  className={btnSecondary}
                >
                  <Pencil size={15} /> Modifier dosage / moments
                </button>
                <button
                  onClick={() => {
                    const existing = supplements.find(s => s.library_supplement_id === selectedItem.id)
                    if (existing) setDeleteConfirm(existing.id)
                    setDetailOpen(false)
                  }}
                  className="w-full bg-red-50 text-red-500 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] border border-red-100"
                >
                  <Trash2 size={15} /> Retirer de mes compléments
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfiguring(true)}
                className={btnPrimary}
              >
                Ajouter à mes compléments
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── BottomSheet: Config ajout (bibliothèque) ─── */}
      <BottomSheet
        isOpen={detailOpen && configuring}
        onClose={() => setConfiguring(false)}
        title="Configurer"
      >
        {selectedItem && (
          <div className="space-y-5 pb-4">
            <button
              onClick={() => setConfiguring(false)}
              className="flex items-center gap-1.5 text-sm text-gray-500 font-medium hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={15} />
              Retour à {selectedItem.name}
            </button>

            {/* Format */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gelule', 'poudre'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setConfig(c => ({ ...c, dosage_type: t, dosage_amount: t === 'gelule' ? 1 : 10 }))}
                    className={cn(
                      'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                      config.dosage_type === t
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
                Dosage {config.dosage_type === 'gelule' ? '(nb de gélules)' : '(grammes)'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, dosage_amount: Math.max(0.5, c.dosage_amount - (c.dosage_type === 'gelule' ? 1 : 0.5)) }))}
                  className="w-12 h-12 rounded-2xl bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-all"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-black text-gray-950">{config.dosage_amount}</span>
                  <span className="text-gray-400 text-sm ml-1">{config.dosage_type === 'gelule' ? 'gél.' : 'g'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, dosage_amount: c.dosage_amount + (c.dosage_type === 'gelule' ? 1 : 0.5) }))}
                  className="w-12 h-12 rounded-2xl bg-gray-950 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
                >
                  +
                </button>
              </div>
            </div>

            {/* Moments */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Quand prendre{config.moments.length > 0 && <span className="text-gray-950 normal-case ml-1">({config.moments.length})</span>}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MOMENTS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleConfigMoment(m.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95',
                      config.moments.includes(m.key)
                        ? 'bg-gray-950 text-white border-gray-950'
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                    )}
                  >
                    <span>{m.emoji}</span>
                    <span className="text-xs leading-tight">{m.label}</span>
                    {config.moments.includes(m.key) && <Check size={13} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddFromLibrary}
              disabled={saving || config.moments.length === 0}
              className={btnPrimary}
            >
              {saving ? 'Ajout...' : 'Ajouter à mes compléments'}
            </button>
            {config.moments.length === 0 && (
              <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── BottomSheet: Modifier complément ─── */}
      <BottomSheet
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditSupplement(null) }}
        title={editSupplement ? `Modifier — ${editSupplement.name}` : 'Modifier'}
      >
        {editSupplement && (
          <div className="space-y-5 pb-4">
            {/* Format */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gelule', 'poudre'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, dosage_type: t, dosage_amount: t === 'gelule' ? 1 : 10 }))}
                    className={cn(
                      'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                      editForm.dosage_type === t
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
                Dosage {editForm.dosage_type === 'gelule' ? '(nb de gélules)' : '(grammes)'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, dosage_amount: Math.max(0.5, f.dosage_amount - (f.dosage_type === 'gelule' ? 1 : 0.5)) }))}
                  className="w-12 h-12 rounded-2xl bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-all"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-black text-gray-950">{editForm.dosage_amount}</span>
                  <span className="text-gray-400 text-sm ml-1">{editForm.dosage_type === 'gelule' ? 'gél.' : 'g'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, dosage_amount: f.dosage_amount + (f.dosage_type === 'gelule' ? 1 : 0.5) }))}
                  className="w-12 h-12 rounded-2xl bg-gray-950 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
                >
                  +
                </button>
              </div>
            </div>

            {/* Moments */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Quand prendre{editForm.moments.length > 0 && <span className="text-gray-950 normal-case ml-1">({editForm.moments.length})</span>}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MOMENTS.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleEditMoment(m.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95',
                      editForm.moments.includes(m.key)
                        ? 'bg-gray-950 text-white border-gray-950'
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                    )}
                  >
                    <span>{m.emoji}</span>
                    <span className="text-xs leading-tight">{m.label}</span>
                    {editForm.moments.includes(m.key) && <Check size={13} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleEditSave}
              disabled={editSaving || editForm.moments.length === 0}
              className={btnPrimary}
            >
              {editSaving ? 'Enregistrement...' : 'Mettre à jour'}
            </button>
            {editForm.moments.length === 0 && (
              <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* ── BottomSheet: Créer complément custom ─── */}
      <BottomSheet isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau complément">
        <div className="space-y-5 pb-4">
          {/* Nom */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nom</label>
            <input
              type="text"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Magnésium, Collagène..."
              autoFocus
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 font-semibold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-all"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['gelule', 'poudre'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setCreateForm(f => ({ ...f, dosage_type: t, dosage_amount: t === 'gelule' ? 1 : 10 }))}
                  className={cn(
                    'py-3.5 rounded-2xl text-sm font-bold border-2 transition-all active:scale-95',
                    createForm.dosage_type === t ? 'bg-gray-950 text-white border-gray-950' : 'bg-gray-50 text-gray-500 border-gray-100'
                  )}>
                  {t === 'gelule' ? '💊 Gélule' : '🥄 Poudre'}
                </button>
              ))}
            </div>
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Dosage {createForm.dosage_type === 'gelule' ? '(nb de gélules)' : '(grammes)'}
            </label>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setCreateForm(f => ({ ...f, dosage_amount: Math.max(0.5, f.dosage_amount - (f.dosage_type === 'gelule' ? 1 : 0.5)) }))}
                className="w-12 h-12 rounded-2xl bg-gray-100 text-xl font-bold flex items-center justify-center active:scale-90 transition-all">−</button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-gray-950">{createForm.dosage_amount}</span>
                <span className="text-gray-400 text-sm ml-1">{createForm.dosage_type === 'gelule' ? 'gél.' : 'g'}</span>
              </div>
              <button type="button"
                onClick={() => setCreateForm(f => ({ ...f, dosage_amount: f.dosage_amount + (f.dosage_type === 'gelule' ? 1 : 0.5) }))}
                className="w-12 h-12 rounded-2xl bg-gray-950 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all shadow-[0_4px_10px_rgba(0,0,0,0.2)]">+</button>
            </div>
          </div>

          {/* Moments */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Quand prendre{createForm.moments.length > 0 && <span className="text-gray-950 normal-case ml-1">({createForm.moments.length})</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MOMENTS.map(m => (
                <button key={m.key} type="button"
                  onClick={() => toggleCreateMoment(m.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95',
                    createForm.moments.includes(m.key) ? 'bg-gray-950 text-white border-gray-950' : 'bg-gray-50 text-gray-500 border-gray-100'
                  )}>
                  <span>{m.emoji}</span>
                  <span className="text-xs leading-tight">{m.label}</span>
                  {createForm.moments.includes(m.key) && <Check size={13} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCreateCustom}
            disabled={createSaving || !createForm.name.trim() || createForm.moments.length === 0}
            className={btnPrimary}>
            {createSaving ? 'Création...' : 'Créer le complément'}
          </button>
          {createForm.moments.length === 0 && createForm.name.trim() && (
            <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>
          )}
        </div>
      </BottomSheet>

      {/* ── BottomSheet: Confirmer suppression ─── */}
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
