import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({
  path: '.env',
});

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  throw new Error('DATABASE_URL is required');
}

console.log('✅ DATABASE_URL found, connecting to database...');
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

export default db;