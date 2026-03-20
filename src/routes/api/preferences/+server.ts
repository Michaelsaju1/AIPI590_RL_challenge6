import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

export const GET: RequestHandler = async () => {
	try {
		const rows = db.prepare('SELECT * FROM preferences ORDER BY id DESC').all();
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
			const result = db.prepare('DELETE FROM preferences WHERE id = ?').run(Number(id));
			if (result.changes === 0) {
				return json({ error: 'Record not found' }, { status: 404 });
			}
			return json({ success: true, deleted: 1 });
		} else {
			const result = db.prepare('DELETE FROM preferences').run();
			return json({ success: true, deleted: result.changes });
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		return json({ error: message }, { status: 500 });
	}
};
