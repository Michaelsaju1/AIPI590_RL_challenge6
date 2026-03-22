import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { preferences } from '$lib/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		const rows = await db.select().from(preferences).orderBy(desc(preferences.id));
		return json(rows);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		return json({ error: message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');
		if (id) {
			const deleted = await db.delete(preferences).where(eq(preferences.id, Number(id))).returning();
			if (deleted.length === 0) {
				return json({ error: 'Record not found' }, { status: 404 });
			}
			return json({ success: true, deleted: 1 });
		} else {
			const deleted = await db.delete(preferences).returning();
			return json({ success: true, deleted: deleted.length });
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		return json({ error: message }, { status: 500 });
	}
};
