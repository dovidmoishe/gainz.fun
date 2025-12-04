import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({
  path: '.env',
});

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

export default db;