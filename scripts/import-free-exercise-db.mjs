import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Read env
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return match ? match[1].trim() : null
}
const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MUSCLE_MAP = {
  abdominals: 'core',
  abductors: 'outer_thighs',
  adductors: 'inner_thighs',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'back',
  'lower back': 'back',
  'middle back': 'back',
  neck: 'neck',
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
}

const EQUIPMENT_MAP = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'bodyweight',
  bands: 'bodyweight',
  kettlebells: 'dumbbell',
  'e-z curl bar': 'barbell',
  'exercise ball': 'machine',
  'foam roll': 'bodyweight',
  'medicine ball': 'dumbbell',
  other: 'bodyweight',
}

function mapMuscles(arr) {
  const mapped = arr.map(m => MUSCLE_MAP[m]).filter(Boolean)
  return [...new Set(mapped)]
}

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

console.log('Fetching free-exercise-db...')
const res = await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')
const exercises = await res.json()
console.log(`Fetched ${exercises.length} exercises`)

const rows = exercises.map(e => ({
  source_id: e.id,
  name: e.name,
  muscles_primary: mapMuscles(e.primaryMuscles || []),
  muscles_secondary: mapMuscles(e.secondaryMuscles || []),
  equipment: EQUIPMENT_MAP[e.equipment] || 'bodyweight',
  exercise_type: e.category === 'cardio' ? 'cardio' : 'strength',
  image_url: e.images?.[0] ? `${IMAGE_BASE}/${e.images[0]}` : null,
  instructions: e.instructions?.join('\n') || null,
}))

// Upsert in batches of 50
const BATCH = 50
let imported = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const { error } = await supabase
    .from('exercise_library')
    .upsert(batch, { onConflict: 'source_id', ignoreDuplicates: false })
  if (error) {
    console.error(`Batch ${i}-${i + BATCH} error:`, error.message)
  } else {
    imported += batch.length
    console.log(`Imported ${imported}/${rows.length}`)
  }
}
console.log('Done!')
