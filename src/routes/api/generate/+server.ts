import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, model, temperature, max_tokens } = await request.json();

	if (!prompt || !model) {
		return json({ error: 'prompt and model are required' }, { status: 400 });
	}

	const t0 = performance.now();

	try {
		const response = await client.messages.create({
			model,
			max_tokens: max_tokens ?? 1024,
			temperature: temperature ?? 0.9,
			messages: [{ role: 'user', content: prompt }]
		});

		const elapsed = (performance.now() - t0) / 1000;
		const textBlock = response.content.find((b) => b.type === 'text');

		return json({
			text: textBlock ? textBlock.text : '',
			model: response.model,
			temperature,
			input_tokens: response.usage.input_tokens,
			output_tokens: response.usage.output_tokens,
			stop_reason: response.stop_reason,
			latency_s: Math.round(elapsed * 100) / 100,
			response_id: response.id
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('Anthropic API error:', message);
		return json({ error: message }, { status: 502 });
	}
};
