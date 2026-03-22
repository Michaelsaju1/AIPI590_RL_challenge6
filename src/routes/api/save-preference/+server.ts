import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { preferences } from '$lib/schema';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const record = await request.json();

	const forwarded = request.headers.get('x-forwarded-for');
	const realIp = request.headers.get('x-real-ip');
	const cfIp = request.headers.get('cf-connecting-ip');
	const clientIp =
		cfIp?.trim() ||
		(forwarded ? forwarded.split(',')[0].trim() : null) ||
		realIp?.trim() ||
		getClientAddress();

	try {
		const [inserted] = await db.insert(preferences).values({
			timestamp: record.timestamp,
			prompt: record.prompt,
			chosen: record.chosen,
			rejected: record.rejected,
			preference: record.preference,
			is_tie: record.is_tie ?? false,
			prompt_category: record.prompt_category ?? null,
			prompt_id: record.prompt_id ?? null,
			prompt_tags: record.prompt_tags ?? null,
			chosen_metadata: record.chosen_metadata ?? null,
			rejected_metadata: record.rejected_metadata ?? null,
			reading_time_s: record.reading_time_s ?? null,
			user_ip: clientIp,
			temp_a: record.temp_a ?? null,
			temp_b: record.temp_b ?? null,
			scrolled_a: record.scrolled_a ?? null,
			scrolled_b: record.scrolled_b ?? null,
		}).returning({ id: preferences.id });

		return json({ success: true, id: inserted.id });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		console.error('DB insert error:', message);
		return json({ error: message }, { status: 500 });
	}
};
