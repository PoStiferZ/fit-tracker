'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MOMENTS } from '@/lib/constants'
import type { SupplementLibraryItem } from '@/types'
import { Search, ChevronLeft, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  protein: 'Protéines',
  amino: 'Acides aminés',
  vitamin: 'Vitamines',
  mineral: 'Minéraux',
  booster: 'Boosters',
  recovery: 'Récupération',
  health: 'Santé',
}

const CATEGORY_COLORS: Record<string, string> = {
  protein: 'bg-blue-50 text-blue-600',
  amino: 'bg-purple-50 text-purple-600',
  vitamin: 'bg-orange-50 text-orange-600',
  mineral: 'bg-stone-100 text-stone-600',
  booster: 'bg-red-50 text-red-600',
  recovery: 'bg-green-50 text-green-600',
  health: 'bg-teal-50 text-teal-600',
}

const CATEGORIES = ['all', 'protein', 'amino', 'vitamin', 'mineral', 'booster', 'recovery', 'health'] as const
type Category = typeof CATEGORIES[number]

interface ConfigForm {
  dosage_type: 'gelule' | 'poudre'
  dosage_amount: number
  moments: string[]
}

interface SupplementLibraryProps {
  onClose: () => void
  onGoToMySupplements: () => void
  onAddSupplement: (item: SupplementLibraryItem, config: ConfigForm) => Promise<void>
  alreadyAddedIds: (string | null | undefined)[]
}

export default function SupplementLibrary({
  onClose,
  onGoToMySupplements,
  onAddSupplement,
  alreadyAddedIds,
}: SupplementLibraryProps) {
  const [items, setItems] = useState<SupplementLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [selected, setSelected] = useState<SupplementLibraryItem | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ConfigForm>({
    dosage_type: 'gelule',
    dosage_amount: 1,
    moments: [],
  })

  useEffect(() => {
    supabase
      .from('supplement_library')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setItems((data as SupplementLibraryItem[]) || [])
        setLoading(false)
      })
  }, [])

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'all' || item.category === activeCategory
    return matchSearch && matchCategory
  })

  function openDetail(item: SupplementLibraryItem) {
    setSelected(item)
    setConfiguring(false)
    setConfig({
      dosage_type: 'gelule',
      dosage_amount: 1,
      moments: item.recommended_moments.slice(0, 1),
    })
  }

  function toggleMoment(key: string) {
    setConfig(c => ({
      ...c,
      moments: c.moments.includes(key)
        ? c.moments.filter(m => m !== key)
        : [...c.moments, key],
    }))
  }

  async function handleAdd() {
    if (!selected || config.moments.length === 0) return
    setSaving(true)
    await onAddSupplement(selected, config)
    setSaving(false)
    setSelected(null)
    setConfiguring(false)
  }

  // ─── Config view ────────────────────────────────────────────────
  if (selected && configuring) {
    return (
      <div className="space-y-5 pb-4">
        <button
          onClick={() => setConfiguring(false)}
          className="flex items-center gap-1.5 text-sm text-gray-500 font-medium hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={15} />
          Retour
        </button>

        <div>
          <p className="font-black text-gray-950 text-lg">{selected.name}</p>
          <span className={cn('inline-block text-xs font-bold px-2.5 py-1 rounded-xl mt-1', CATEGORY_COLORS[selected.category] || 'bg-gray-100 text-gray-500')}>
            {CATEGORY_LABELS[selected.category] || selected.category}
          </span>
        </div>

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
                onClick={() => toggleMoment(m.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95',
                  config.moments.includes(m.key)
                    ? 'bg-gray-950 text-white border-gray-950'
                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                )}
              >
                <span>{m.emoji}</span>
                <span className="text-xs leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={saving || config.moments.length === 0}
          className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? 'Ajout...' : 'Ajouter à mes compléments'}
        </button>
        {config.moments.length === 0 && (
          <p className="text-center text-xs text-gray-400">Sélectionne au moins un moment</p>
        )}
      </div>
    )
  }

  // ─── Detail view ────────────────────────────────────────────────
  if (selected) {
    const isAlreadyAdded = alreadyAddedIds.includes(selected.id)
    return (
      <div className="space-y-5 pb-4">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 font-medium hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={15} />
          Retour
        </button>

        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">💊</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-gray-950 text-xl leading-tight">{selected.name}</h2>
            <span className={cn('inline-block text-xs font-bold px-2.5 py-1 rounded-xl mt-1', CATEGORY_COLORS[selected.category] || 'bg-gray-100 text-gray-500')}>
              {CATEGORY_LABELS[selected.category] || selected.category}
            </span>
          </div>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed">{selected.description}</p>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bienfaits</p>
          <ul className="space-y-1.5">
            {selected.benefits.map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {selected.recommended_moments.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Moments recommandés</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.recommended_moments.map(mk => {
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

        {isAlreadyAdded ? (
          <div className="w-full bg-green-50 text-green-700 rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 border border-green-200">
            ✓ Déjà dans ta liste
          </div>
        ) : (
          <button
            onClick={() => setConfiguring(true)}
            className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)]"
          >
            Ajouter à mes compléments
          </button>
        )}
      </div>
    )
  }

  // ─── List view ─────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-4">
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onGoToMySupplements}
          className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors hover:bg-indigo-100"
        >
          Mes compléments
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-all"
        />
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'shrink-0 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all',
              activeCategory === cat
                ? 'bg-gray-950 text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400 text-sm">Aucun résultat</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const isAdded = alreadyAddedIds.includes(item.id)
            return (
              <button
                key={item.id}
                onClick={() => openDetail(item)}
                className="w-full text-left bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-gray-50 p-4 transition-all active:scale-[0.98] hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">💊</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                      {isAdded && (
                        <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded-lg">✓ Ajouté</span>
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
                  <ChevronLeft size={16} className="text-gray-300 rotate-180 shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
