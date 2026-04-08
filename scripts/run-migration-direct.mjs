/**
 * Migration via direct postgres connection
 * The postgres password is the Supabase project's DB password
 * (found at: Supabase Dashboard > Settings > Database > Connection string)
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

// Try to connect to direct DB connection
// Password = DB password from Supabase dashboard (usually set during project creation)
// We'll try with the service role key JWT as password (works in some Supabase setups)

const connectionsToTry = [
  // Direct DB (service role key as password)
  {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: serviceRoleKey,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  },
  // Supavisor (transaction mode)
  {
    host: `${projectRef}.supabase.co`,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: serviceRoleKey,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  },
]

const sql = [
  'ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS image_url TEXT',
  'ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS source_id TEXT',
  'ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS instructions TEXT',
  'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = \'exercise_library\' AND indexname = \'exercise_library_source_id_key\') THEN CREATE UNIQUE INDEX exercise_library_source_id_key ON exercise_library(source_id); END IF; END $$',
]

let connected = false

for (const config of connectionsToTry) {
  console.log(`Trying ${config.host}:${config.port}...`)
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 8000 })
  
  try {
    await client.connect()
    console.log('✅ Connected to postgres!')
    
    for (const query of sql) {
      try {
        await client.query(query)
        console.log('✅', query.slice(0, 60) + '...')
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log('ℹ️ Already exists:', query.slice(0, 40))
        } else {
          throw e
        }
      }
    }
    
    await client.end()
    connected = true
    console.log('\n✅ Migration complete!')
    break
  } catch (err) {
    console.log(`  Failed: ${err.message}`)
    try { await client.end() } catch {}
  }
}

if (!connected) {
  console.error('\n❌ Could not run migration automatically.')
  console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
  console.log('\n---\n')
  console.log('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS image_url TEXT;')
  console.log('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS source_id TEXT;')
  console.log('ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS instructions TEXT;')
  console.log('CREATE UNIQUE INDEX IF NOT EXISTS exercise_library_source_id_key ON exercise_library(source_id);')
  console.log('\n---')
  process.exit(1)
}
