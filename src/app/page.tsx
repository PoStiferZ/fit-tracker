'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProfileId, setProfileId } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import ProfilePicker from '@/components/ProfilePicker'
import { ArrowRight, Check } from 'lucide-react'

type Screen = 'loading' | 'picker' | 'onboarding'
type Step = 'name' | 'birth' | 'body'
const STEPS: Step[] = ['name', 'birth', 'body']

export default function EntryPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('loading')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [step, setStep] = useState<Step>('name')
  const [firstName, setFirstName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const profileId = getProfileId()
      if (profileId) {
        const { data } = await supabase.from('profiles').select('id').eq('id', profileId).single()
        if (data) { router.replace('/dashboard'); return }
      }
      const { data: allProfiles } = await supabase.from('profiles').select('*').order('first_name')
      if (!allProfiles || allProfiles.length === 0) setScreen('onboarding')
      else { setProfiles(allProfiles); setScreen('picker') }
    }
    init()
  }, [router])

  function selectProfile(p: Profile) {
    setProfileId(p.id)
    router.replace('/dashboard')
  }

  async function handleFinish() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase.from('profiles').insert({
      first_name: firstName.trim(),
      birth_date: birthDate,
      height_cm: parseInt(height),
      weight_kg: parseFloat(weight),
    }).select().single()

    if (err || !data) {
      setError(err?.message?.includes('unique') ? 'Ce prénom est déjà utilisé.' : 'Erreur lors de la création.')
      setSaving(false)
      return
    }
    setProfileId(data.id)
    router.replace('/dashboard')
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f8fb]">
        <div className="w-9 h-9 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (screen === 'picker') {
    return (
      <div className="min-h-screen flex items-end sm:items-center justify-center bg-[#f8f8fb] p-0 sm:p-6">
        <div className="w-full sm:max-w-sm">
          <ProfilePicker profiles={profiles} onSelect={selectProfile} onCreateNew={() => { setStep('name'); setScreen('onboarding') }} />
        </div>
      </div>
    )
  }

  // Onboarding
  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f8fb]">
      {/* Hero gradient top */}
      <div className="h-48 bg-gradient-to-br from-gray-950 via-gray-800 to-gray-700 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 70% 50%, #818cf8 0%, transparent 60%)'}} />
        <div className="absolute bottom-6 left-6">
          <p className="text-white/60 text-sm font-medium tracking-wide uppercase">Étape {stepIndex + 1} / 3</p>
          <h1 className="text-white text-2xl font-bold mt-1">
            {step === 'name' && 'Ton prénom'}
            {step === 'birth' && 'Ta date de naissance'}
            {step === 'body' && 'Tes mensurations'}
          </h1>
        </div>
        {/* Step dots */}
        <div className="absolute bottom-6 right-6 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i <= stepIndex ? 'bg-white w-5' : 'bg-white/30 w-1.5'
            )} />
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 px-4 -mt-6 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] p-6 space-y-4">

          {step === 'name' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prénom</label>
                <input
                  autoFocus type="text" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Ex: Thomas"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-semibold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                  onKeyDown={e => e.key === 'Enter' && firstName.trim() && setStep('birth')}
                />
              </div>
              <button disabled={!firstName.trim()} onClick={() => setStep('birth')} className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40">
                Continuer <ArrowRight size={18} />
              </button>
            </>
          )}

          {step === 'birth' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Date de naissance</label>
                <input
                  autoFocus type="date" value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-lg placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                />
              </div>
              <button disabled={!birthDate} onClick={() => setStep('body')} className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40">
                Continuer <ArrowRight size={18} />
              </button>
              <button onClick={() => setStep('name')} className="w-full text-center text-sm text-gray-400 py-1">← Retour</button>
            </>
          )}

          {step === 'body' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Taille (cm)</label>
                  <input
                    autoFocus type="number" value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="180" min={100} max={250}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-semibold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Poids (kg)</label>
                  <input
                    type="number" value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="75" min={30} max={300} step={0.5}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 text-xl font-semibold placeholder:text-gray-300 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                  />
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm font-medium">
                  {error}
                </div>
              )}
              <button disabled={!height || !weight || saving} onClick={handleFinish} className="w-full bg-gray-950 text-white rounded-2xl font-semibold min-h-[52px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(0,0,0,0.20)] disabled:opacity-40">
                {saving ? 'Création...' : <><Check size={18} /> C&apos;est parti !</>}
              </button>
              <button onClick={() => setStep('birth')} className="w-full text-center text-sm text-gray-400 py-1">← Retour</button>
            </>
          )}
        </div>

        {profiles.length > 0 && (
          <button onClick={() => setScreen('picker')} className="mt-4 w-full text-center text-sm text-gray-400 py-2">
            ← Retour aux profils existants
          </button>
        )}
      </div>
    </div>
  )
}
