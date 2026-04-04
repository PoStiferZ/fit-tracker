'use client'
import { calculateAge } from '@/lib/utils'
import type { Profile } from '@/types'
import ProfileAvatar from './ProfileAvatar'
import { Plus, ChevronRight } from 'lucide-react'

interface ProfilePickerProps {
  profiles: Profile[]
  onSelect: (profile: Profile) => void
  onCreateNew: () => void
}

export default function ProfilePicker({ profiles, onSelect, onCreateNew }: ProfilePickerProps) {
  return (
    <div className="w-full">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-950 via-gray-800 to-gray-700 px-6 pt-16 pb-10 relative overflow-hidden sm:rounded-t-3xl">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 60%)'}} />
        <div className="relative">
          <span className="text-4xl">💪</span>
          <h1 className="text-white text-3xl font-bold mt-3 leading-tight">Qui es-tu ?</h1>
          <p className="text-white/60 mt-1 text-sm">Sélectionne ton profil</p>
        </div>
      </div>

      {/* Cards */}
      <div className="bg-white sm:rounded-b-3xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] px-4 py-5 space-y-3">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 text-left active:scale-[0.98] transition-all border border-gray-100"
          >
            <ProfileAvatar name={p.first_name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">{p.first_name}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {calculateAge(p.birth_date)} ans · {p.height_cm} cm · {p.weight_kg} kg
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </button>
        ))}

        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-gray-500 font-semibold text-sm transition-all active:scale-[0.98] border-2 border-dashed border-gray-200 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus size={18} />
          Nouveau profil
        </button>
      </div>
    </div>
  )
}
