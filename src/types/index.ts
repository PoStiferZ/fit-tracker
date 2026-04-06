export interface Profile {
  id: string
  first_name: string
  birth_date: string
  height_cm: number
  weight_kg: number
  created_at: string
  pin_hash?: string
}

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'cardio'
export type ExerciseType = 'strength' | 'cardio'
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'rear_delts' | 'biceps' | 'triceps'
  | 'forearms' | 'traps' | 'core' | 'quads' | 'hamstrings' | 'glutes'
  | 'calves' | 'inner_thighs' | 'cardio'

export interface LibraryExercise {
  id: string
  name: string
  muscles_primary: MuscleGroup[]
  muscles_secondary: MuscleGroup[]
  equipment: Equipment
  exercise_type: ExerciseType
  created_at: string
}

export interface CustomExercise {
  id: string
  profile_id: string
  name: string
  muscles_primary: MuscleGroup[]
  muscles_secondary: MuscleGroup[]
  equipment: Equipment
  exercise_type: ExerciseType
  created_at: string
}

export type AnyExercise = (LibraryExercise | CustomExercise) & { source: 'library' | 'custom' }

export interface Program {
  id: string
  profile_id: string
  name: string
  recurrence_weeks: number | null
  recurrence_until: string | null
  created_at: string
}

export interface Workout {
  id: string
  profile_id: string
  program_id: string
  name: string
  order_index: number
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  library_exercise_id: string | null
  custom_exercise_id: string | null
  source: 'library' | 'custom'
  order_index: number
  superset_with: string | null
  work_sets: number
  work_reps_per_set: number[]
  work_loads: number[]
  work_rest_seconds: number[]
  warmup_sets: number
  warmup_reps_per_set: number[]
  warmup_loads: number[]
  warmup_rest_seconds: number[]
  cardio_sets: number
  cardio_durations: number[]
  cardio_inclines: number[]
  cardio_speeds: number[]
  cardio_rest_seconds: number[]
  created_at: string
  updated_at: string
}

export interface WeeklyPlan {
  id: number
  day_of_week: number
  program_id: string | null
  workout_id: string | null
  completed: boolean
  week_start: string
  is_override: boolean
}

export interface Supplement {
  id: string
  name: string
  dosage_type: 'gelule' | 'poudre'
  dosage_amount: number
  moments: string[]
  created_at: string
}

export interface SupplementLog {
  id: string
  supplement_id: string
  moment: string
  date: string
  completed: boolean
}

export interface BodyWeightEntry {
  id: string
  profile_id: string
  weight_kg: number
  date: string
  created_at: string
}

// ─── Legacy v1 types (kept for session page compat) ─────────────────────────
export interface Exercise {
  id: string
  name: string
  image_url: string | null
  muscles: string[]
  work_sets: number
  work_reps: number
  warmup_sets: number
  warmup_reps: number
  work_loads: number[]
  warmup_loads: number[]
  exercise_type: 'strength' | 'cardio'
  cardio_sets: number
  cardio_durations: number[]
  cardio_inclines: number[]
  cardio_speeds: number[]
  work_reps_per_set: number[]
  warmup_reps_per_set: number[]
  work_rest_seconds: number[]
  warmup_rest_seconds: number[]
  cardio_rest_seconds: number[]
  created_at: string
}

export interface WorkoutSession {
  id: string
  profile_id: string
  program_id: string
  date: string
  week_start: string
  day_of_week: number
  default_rest_seconds: number
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface WorkoutSet {
  id: string
  session_id: string
  exercise_id: string
  set_index: number
  set_type: 'warmup' | 'work'
  set_number: number
  weight_kg: number
  reps: number
  rest_seconds: number | null
  completed_at: string | null
  created_at: string
}
