import type { MuscleGroup } from '@/types'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  rear_delts: 'Delts arr.',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  traps: 'Trapèzes',
  core: 'Abdos',
  quads: 'Quadriceps',
  hamstrings: 'Ischio',
  glutes: 'Fessiers',
  calves: 'Mollets',
  inner_thighs: 'Adducteurs',
  outer_thighs: 'Abducteurs',
  cardio: 'Cardio',
  neck: 'Cou',
}

export const MUSCLE_LABELS_EN: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  traps: 'Traps',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  inner_thighs: 'Inner Thighs',
  outer_thighs: 'Outer Thighs',
  cardio: 'Cardio',
  neck: 'Neck',
}

// Map muscle → image path in /public/muscles/
// lower_back and obliques images are mapped to back/core as aliases
export const MUSCLE_IMAGE: Record<MuscleGroup, string | null> = {
  chest: '/muscles/chest.png',
  back: '/muscles/back.png',
  shoulders: '/muscles/shoulders.png',
  rear_delts: '/muscles/rear_delts.png',
  biceps: '/muscles/biceps.png',
  triceps: '/muscles/triceps.png',
  forearms: '/muscles/forearms.png',
  traps: '/muscles/traps.png',
  core: '/muscles/core.png',
  quads: '/muscles/quads.png',
  hamstrings: '/muscles/hamstrings.png',
  glutes: '/muscles/glutes.png',
  calves: '/muscles/calves.png',
  inner_thighs: '/muscles/inner_thighs.png',
  outer_thighs: '/muscles/outer_thighs.png',
  cardio: null,
  neck: '/muscles/neck.png',
}

export const ALL_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'traps', 'core', 'quads', 'hamstrings', 'glutes',
  'calves', 'inner_thighs', 'outer_thighs', 'neck', 'cardio',
]

export function getMuscleLabel(muscle: MuscleGroup, lang: string): string {
  return lang === 'en'
    ? (MUSCLE_LABELS_EN[muscle] ?? muscle)
    : (MUSCLE_LABELS[muscle] ?? muscle)
}
