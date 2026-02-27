import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb } from './index.js'

const db = createDb(process.env.DATABASE_URL || 'postgresql://bout:bout@localhost:5432/bout')

async function runMigrations() {
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('Migrations complete!')
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
