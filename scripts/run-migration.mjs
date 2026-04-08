/**
 * Runs the DDL migration via Supabase postgres pooler connection
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

const env = {}
readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

// Try Supabase pooler connection with service role key as JWT
// The Supabase Session Pooler uses the JWT as password
const poolerConnStrings = [
  // Transaction pooler (IPv4)
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
]

const sql = `
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS instructions TEXT;
`

let connected = false

for (const connStr of poolerConnStrings) {
  const region = connStr.match(/aws-0-[^.]+/)?.[0] || 'unknown'
  console.log(`Trying ${region}...`)
  
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })

  try {
    await client.connect()
    console.log('✅ Connected!')
    await client.query('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS image_url TEXT')
    await client.query('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS source_id TEXT')
    await client.query('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS instructions TEXT')
    console.log('✅ Migration complete!')
    
    // Add UNIQUE constraint on source_id
    try {
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS exercise_library_source_id_key ON exercise_library(source_id)')
      console.log('✅ Unique index on source_id created!')
    } catch (e) {
      console.log('Index may already exist:', e.message)
    }
    
    await client.end()
    connected = true
    break
  } catch (err) {
    console.log(`Failed: ${err.message}`)
    try { await client.end() } catch {}
  }
}

if (!connected) {
  console.error('\n❌ Could not connect to Supabase postgres.')
  console.log('\nPlease run this SQL manually in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  console.log('\n' + sql)
  process.exit(1)
}
