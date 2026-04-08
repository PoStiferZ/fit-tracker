import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

// Parse .env.local manually
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=')
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    env[key] = val
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// Check if already exists
const { data: existing } = await supabase
  .from('exercise_library')
  .select('id')
  .eq('name', 'Marche sur tapis')
  .maybeSingle()

if (existing) {
  console.log('ℹ️  "Marche sur tapis" existe déjà dans exercise_library (id:', existing.id, ')')
  process.exit(0)
}

const { data, error } = await supabase
  .from('exercise_library')
  .insert({
    name: 'Marche sur tapis',
    exercise_type: 'cardio',
    equipment: 'machine',
    muscles_primary: ['cardio'],
    muscles_secondary: [],
  })

if (error) {
  console.error('Error:', error)
  process.exit(1)
} else {
  console.log('✅ "Marche sur tapis" ajouté avec succès dans exercise_library')
}
