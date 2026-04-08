/**
 * Migration script: adds image_url, source_id, instructions columns to exercise_library
 * Uses Supabase service role key via direct fetch to the SQL-capable endpoint
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

// Parse .env.local manually
const env = {}
readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// We'll use a workaround: create a temporary RPC function, call it, drop it
// via the supabase REST API's rpc endpoint if exec_sql exists,
// otherwise we'll do it by reading the schema and using raw fetch to the pg endpoint

async function runMigration() {
  console.log('Checking current schema...')

  // Check if columns already exist
  const { data: sample } = await supabase.from('exercise_library').select('*').limit(1)
  const existing = sample?.[0] ? Object.keys(sample[0]) : []

  const columnsToAdd = [
    { name: 'image_url', type: 'TEXT' },
    { name: 'source_id', type: 'TEXT' },
    { name: 'instructions', type: 'TEXT' },
  ]

  const missing = columnsToAdd.filter(c => !existing.includes(c.name))

  if (missing.length === 0) {
    console.log('✅ All columns already exist!')
    return true
  }

  console.log('Missing columns:', missing.map(c => c.name).join(', '))
  console.log('Attempting migration via SQL REST endpoint...')

  // Try using the Supabase Management REST API endpoint for SQL
  // The standard /rest/v1/rpc approach won't work without exec_sql function
  // So we'll try to add columns by inserting a row with those fields (which will fail)
  // Alternative: use the newer Supabase SQL API
  
  const sqlStatements = missing.map(c => `ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS ${c.name} ${c.type};`).join('\n')
  
  // Try via direct HTTP to the internal postgres REST API
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql: sqlStatements }),
  })

  if (response.ok) {
    console.log('✅ Migration executed successfully!')
    return true
  }

  console.log('exec_sql RPC not available, trying alternative...')

  // Last resort: try the Supabase pg API
  const pgResp = await fetch(`${supabaseUrl.replace('.supabase.co', '')}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sqlStatements }),
  })

  if (pgResp.ok) {
    console.log('✅ Migration executed via pg endpoint!')
    return true
  }

  console.error('❌ Could not run migration automatically.')
  console.log('')
  console.log('Please run the following SQL manually in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/ycnhfxuwqtwnjgzniamw/sql')
  console.log('')
  console.log(sqlStatements)
  console.log('')
  console.log('After running the SQL, re-run: node scripts/import-free-exercise-db.mjs')
  return false
}

const ok = await runMigration()
if (!ok) process.exit(1)
