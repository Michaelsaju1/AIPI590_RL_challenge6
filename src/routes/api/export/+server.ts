import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { preferences } from '$lib/schema';
import { asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const format = url.searchParams.get('format') ?? 'json';

	try {
		const rows = await db.select().from(preferences).orderBy(asc(preferences.id));

		if (rows.length === 0) {
			if (format === 'csv') {
				return new Response('', {
					headers: {
						'Content-Type': 'text/csv; charset=utf-8',
						'Content-Disposition': `attachment; filename="preferences_${new Date().toISOString().slice(0, 10)}.csv"`
					}
				});
			}
			return new Response('[]', {
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Disposition': `attachment; filename="preferences_${new Date().toISOString().slice(0, 10)}.json"`
				}
			});
		}

		if (format === 'csv') {
			const flatRows = rows.map((row) => {
				const chosenMeta = (row.chosen_metadata ?? {}) as Record<string, unknown>;
				const rejectedMeta = (row.rejected_metadata ?? {}) as Record<string, unknown>;
				const tags = (row.prompt_tags ?? []) as string[];

				return {
					id: row.id,
					timestamp: row.timestamp,
					prompt_id: row.prompt_id,
					prompt_category: row.prompt_category,
					prompt_tags: tags.join(';'),
					prompt: row.prompt,
					preference: row.preference,
					is_tie: row.is_tie,
					chosen: row.chosen,
					rejected: row.rejected,
					reading_time_s: row.reading_time_s,
					user_ip: row.user_ip,
					temp_a: row.temp_a,
					temp_b: row.temp_b,
					scrolled_a: row.scrolled_a,
					scrolled_b: row.scrolled_b,
					chosen_model: chosenMeta.model ?? '',
					chosen_temperature: chosenMeta.temperature ?? '',
					chosen_input_tokens: chosenMeta.input_tokens ?? '',
					chosen_output_tokens: chosenMeta.output_tokens ?? '',
					chosen_latency_s: chosenMeta.latency_s ?? '',
					chosen_stop_reason: chosenMeta.stop_reason ?? '',
					chosen_response_id: chosenMeta.response_id ?? '',
					rejected_model: rejectedMeta.model ?? '',
					rejected_temperature: rejectedMeta.temperature ?? '',
					rejected_input_tokens: rejectedMeta.input_tokens ?? '',
					rejected_output_tokens: rejectedMeta.output_tokens ?? '',
					rejected_latency_s: rejectedMeta.latency_s ?? '',
					rejected_stop_reason: rejectedMeta.stop_reason ?? '',
					rejected_response_id: rejectedMeta.response_id ?? '',
					created_at: row.created_at
				};
			});

			const headers = Object.keys(flatRows[0] ?? {});
			const csvLines = [headers.join(',')];

			for (const row of flatRows) {
				const values = headers.map((h) => {
					const val = String(row[h as keyof typeof row] ?? '');
					if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
						return '"' + val.replace(/"/g, '""') + '"';
					}
					return val;
				});
				csvLines.push(values.join(','));
			}

			return new Response(csvLines.join('\n'), {
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="preferences_${new Date().toISOString().slice(0, 10)}.csv"`
				}
			});
		}

		return new Response(JSON.stringify(rows, null, 2), {
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="preferences_${new Date().toISOString().slice(0, 10)}.json"`
			}
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown database error';
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
