import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '$lib/db/schema';
import { env } from '$env/dynamic/private';

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
