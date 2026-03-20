import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { insertPreference } from '$lib/db';

export const POST: RequestHandler = async ({ request }) => {
	const record = await request.json();

	try {
		const result = insertPreference.run({
			timestamp: record.timestamp,
			prompt: record.prompt,
			chosen: record.chosen,
			rejected: record.rejected,
			preference: record.preference,
			is_tie: record.is_tie ? 1 : 0,
			prompt_category: record.prompt_category ?? null,
			prompt_id: record.prompt_id ?? null,
			prompt_tags: record.prompt_tags ? JSON.stringify(record.prompt_tags) : null,
			chosen_metadata: record.chosen_metadata ? JSON.stringify(record.chosen_metadata) : null,
			rejected_metadata: record.rejected_metadata ? JSON.stringify(record.rejected_metadata) : null
		});

		return json({ success: true, id: result.lastInsertRowid });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		console.error('SQLite insert error:', message);
		return json({ error: message }, { status: 500 });
	}
};
