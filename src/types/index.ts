export interface Profile {
  id: string
  first_name: string
  birth_date: string
  height_cm: number
  weight_kg: number
  created_at: string
  pin_hash?: string
}

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

export interface Program {
  id: string
  name: string
  exercise_ids: string[]
  superset_pairs: Array<[string, string]>
  created_at: string
}

export interface WeeklyPlan {
  id: number
  day_of_week: number
  program_id: string | null
  completed: boolean
  week_start: string
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

export interface ExerciseLoadHistory {
  id: string
  exercise_id: string
  work_loads: number[]
  warmup_loads: number[]
  work_sets: number
  work_reps: number
  warmup_sets: number
  warmup_reps: number
  recorded_at: string
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

export interface BodyWeightEntry {
  id: string
  profile_id: string
  weight_kg: number
  date: string
  created_at: string
}
