export const MUSCLES = [
  'Pectoraux haut', 'Pectoraux bas', 'Pectoraux milieu',
  'Épaules antérieures', 'Épaules latérales', 'Épaules postérieures',
  'Dos - Grand dorsal', 'Dos - Trapèzes', 'Dos - Rhomboïdes', 'Dos - Érecteurs',
  'Biceps', 'Triceps', 'Avant-bras',
  'Abdominaux', 'Obliques', 'Transverse',
  'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets',
  'Adducteurs', 'Abducteurs', 'Cou', 'Lombaires',
]

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const MOMENTS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅' },
  { key: 'collation_matin', label: 'Collation matin', emoji: '🍎' },
  { key: 'dejeuner', label: 'Déjeuner', emoji: '☀️' },
  { key: 'collation', label: 'Collation', emoji: '🥜' },
  { key: 'pre_workout', label: 'Avant sport', emoji: '💪' },
  { key: 'post_workout', label: 'Après sport', emoji: '🏋️' },
  { key: 'diner', label: 'Dîner', emoji: '🌆' },
  { key: 'avant_dormir', label: 'Avant de dormir', emoji: '🌙' },
]

// Avatar background colors for profile initials
export const AVATAR_COLORS = [
  'bg-rose-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-sky-400',
  'bg-indigo-400',
  'bg-violet-400',
  'bg-fuchsia-400',
  'bg-pink-400',
]

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
