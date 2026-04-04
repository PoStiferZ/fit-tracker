'use client'
import { useState } from 'react'
import { calculateAge } from '@/lib/utils'
import { verifyPin } from '@/lib/pin'
import type { Profile } from '@/types'
import ProfileAvatar from './ProfileAvatar'
import PinPad from './PinPad'
import { Plus, Lock, LockOpen, X } from 'lucide-react'

interface ProfilePickerProps {
  profiles: Profile[]
  currentProfileId?: string
  onSelect: (profile: Profile) => void
  onCreateNew: () => void
}

export default function ProfilePicker({ profiles, currentProfileId, onSelect, onCreateNew }: ProfilePickerProps) {
  const [pinTarget, setPinTarget] = useState<Profile | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function handlePinChange(val: string) {
    setPin(val)
    setError('')
    if (val.length === 4 && pinTarget) {
      const ok = await verifyPin(val, pinTarget.pin_hash || '')
      if (ok) {
        setPinTarget(null)
        setPin('')
        onSelect(pinTarget)
      } else {
        setError('Code incorrect')
        setTimeout(() => setPin(''), 600)
      }
    }
  }

  function selectProfile(p: Profile) {
    if (p.pin_hash) {
      setPinTarget(p)
      setPin('')
      setError('')
    } else {
      onSelect(p)
    }
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-950 via-gray-800 to-gray-700 px-6 pt-16 pb-10 relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 60%)'}} />
        <div className="relative">
          <span className="text-4xl">💪</span>
          <h1 className="text-white text-3xl font-bold mt-3 leading-tight">Qui es-tu ?</h1>
          <p className="text-white/60 mt-1 text-sm">Sélectionne ton profil</p>
        </div>
      </div>

      {/* Cards */}
      <div className="bg-white rounded-b-3xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] px-4 py-5 space-y-3">
        {profiles.map((p) => {
          const isCurrent = p.id === currentProfileId
          return (
            <button
              key={p.id}
              onClick={() => selectProfile(p)}
              className="w-full flex items-center gap-4 bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 text-left active:scale-[0.98] transition-all border border-gray-100"
            >
              <ProfileAvatar name={p.first_name} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base">{p.first_name}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {calculateAge(p.birth_date)} ans · {p.height_cm} cm · {p.weight_kg} kg
                </p>
              </div>
              {isCurrent ? (
                <LockOpen size={18} className="text-emerald-500 shrink-0" />
              ) : (
                <Lock size={18} className="text-gray-300 shrink-0" />
              )}
            </button>
          )
        })}

        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-gray-500 font-semibold text-sm transition-all active:scale-[0.98] border-2 border-dashed border-gray-200 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus size={18} />
          Nouveau profil
        </button>
      </div>

      {/* PIN overlay */}
      {pinTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Code secret</p>
                <h2 className="text-xl font-bold text-gray-900 mt-0.5">{pinTarget.first_name}</h2>
              </div>
              <button onClick={() => { setPinTarget(null); setPin(''); setError('') }}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <PinPad value={pin} onChange={handlePinChange} error={error} />
          </div>
        </div>
      )}
    </div>
  )
}
