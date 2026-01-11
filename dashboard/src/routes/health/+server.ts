import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export async function GET() {
	try {
		await db.execute(sql`SELECT 1`);
		return json({ status: 'ok', db: 'connected' });
	} catch (e) {
		return json({ status: 'error', db: 'disconnected' }, { status: 503 });
	}
}
