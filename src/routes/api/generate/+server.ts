import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import Anthropic from '@anthropic-ai/sdk';

export const POST: RequestHandler = async ({ request }) => {
	const { prompt, model, temperature, max_tokens } = await request.json();

	if (!prompt || !model) {
		return new Response(JSON.stringify({ error: 'prompt and model are required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const t0 = performance.now();
	const encoder = new TextEncoder();

	const anthropicStream = client.messages.stream({
		model,
		max_tokens: max_tokens ?? 512,
		temperature: temperature ?? 0.9,
		messages: [{ role: 'user', content: prompt }]
	});

	const readable = new ReadableStream({
		async start(controller) {
			try {
				anthropicStream.on('text', (text) => {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
					);
				});

				const finalMessage = await anthropicStream.finalMessage();
				const elapsed = (performance.now() - t0) / 1000;

				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: 'done',
							model: finalMessage.model,
							temperature,
							input_tokens: finalMessage.usage.input_tokens,
							output_tokens: finalMessage.usage.output_tokens,
							stop_reason: finalMessage.stop_reason,
							latency_s: Math.round(elapsed * 100) / 100,
							response_id: finalMessage.id
						})}\n\n`
					)
				);
				controller.close();
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : 'Unknown error';
				console.error('Anthropic API error:', message);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
				);
				controller.close();
			}
		}
	});

	return new Response(readable, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
