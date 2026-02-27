import { createDb } from '@bout/db'

export const db = createDb(
  process.env.DATABASE_URL || 'postgresql://bout:bout@localhost:5432/bout',
)
