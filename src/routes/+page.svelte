<script lang="ts">
	import { getRandomPrompt } from '$lib/prompts';
	import type { Prompt, ResponseMeta, PreferenceRecord } from '$lib/types';

	// ── Constants ────────────────────────────────────────────────────
	const MODEL = 'claude-haiku-4-5';
	const MAX_TOKENS = 512;
	const LOW_TEMPS = [0.3, 0.4, 0.5];
	const HIGH_TEMPS = [0.7, 0.8, 0.9];

	// ── State ────────────────────────────────────────────────────────
	let currentPrompt: Prompt | null = $state(null);
	let responseA: ResponseMeta | null = $state(null);
	let responseB: ResponseMeta | null = $state(null);
	let streamingTextA = $state('');
	let streamingTextB = $state('');
	let tempA = $state(0);
	let tempB = $state(0);
	let generating = $state(false);
	let saving = $state(false);
	let errorMessage = $state('');
	let sessionCount = $state(0);
	let usedPromptIds: string[] = $state([]);

	// ── Pre-generation state ────────────────────────────────────────
	let pregenPrompt: Prompt | null = null;
	let pregenA: ResponseMeta | null = null;
	let pregenB: ResponseMeta | null = null;
	let pregenTempA = 0;
	let pregenTempB = 0;
	let pregenPromise: Promise<void> | null = null;

	// ── Helpers ──────────────────────────────────────────────────────
	function pickRandom<T>(arr: T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function assignTemperatures(): [number, number] {
		const low = pickRandom(LOW_TEMPS);
		const high = pickRandom(HIGH_TEMPS);
		if (Math.random() < 0.5) return [low, high];
		return [high, low];
	}

	// ── Init ─────────────────────────────────────────────────────────
	currentPrompt = getRandomPrompt();

	// ── Streaming API call ───────────────────────────────────────────
	async function fetchResponseStreaming(
		prompt: string,
		temperature: number,
		onDelta: (fullText: string) => void
	): Promise<ResponseMeta> {
		const res = await fetch('/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt, model: MODEL, temperature, max_tokens: MAX_TOKENS })
		});

		if (!res.ok) {
			const text = await res.text();
			let errorMsg = `HTTP ${res.status}`;
			try {
				const data = JSON.parse(text);
				errorMsg = data.error || errorMsg;
			} catch {
				// not JSON, use status
			}
			throw new Error(errorMsg);
		}

		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let fullText = '';
		let metadata: Record<string, unknown> | null = null;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop()!;

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;
				const data = JSON.parse(line.slice(6));

				if (data.type === 'delta') {
					fullText += data.text;
					onDelta(fullText);
				} else if (data.type === 'done') {
					metadata = data;
				} else if (data.type === 'error') {
					throw new Error(data.error);
				}
			}
		}

		if (!metadata) throw new Error('Stream ended without metadata');

		return {
			text: fullText,
			model: metadata.model as string,
			temperature: metadata.temperature as number,
			input_tokens: metadata.input_tokens as number,
			output_tokens: metadata.output_tokens as number,
			stop_reason: metadata.stop_reason as string,
			latency_s: metadata.latency_s as number,
			response_id: metadata.response_id as string
		};
	}

	async function savePreference(record: PreferenceRecord): Promise<void> {
		const res = await fetch('/api/save-preference', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(record)
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || `Failed to save (HTTP ${res.status})`);
		}
	}

	// ── Pre-generation ──────────────────────────────────────────────
	function startPreGeneration() {
		const excludeIds = [...usedPromptIds, currentPrompt?.id ?? ''];
		let next = getRandomPrompt(excludeIds);
		if (!next) {
			// All prompts used, reset and pick any
			next = getRandomPrompt([currentPrompt?.id ?? '']);
		}
		if (!next) return;

		pregenPrompt = next;
		pregenA = null;
		pregenB = null;
		const [tA, tB] = assignTemperatures();
		pregenTempA = tA;
		pregenTempB = tB;

		pregenPromise = (async () => {
			try {
				const [a, b] = await Promise.all([
					fetchResponseStreaming(next!.prompt, tA, () => {}),
					fetchResponseStreaming(next!.prompt, tB, () => {})
				]);
				pregenA = a;
				pregenB = b;
			} catch {
				// Pre-generation failed silently; will generate normally
				pregenPrompt = null;
				pregenA = null;
				pregenB = null;
			}
		})();
	}

	// ── Actions ──────────────────────────────────────────────────────
	async function generatePair() {
		if (!currentPrompt) return;
		generating = true;
		errorMessage = '';
		responseA = null;
		responseB = null;
		streamingTextA = '';
		streamingTextB = '';

		const [tA, tB] = assignTemperatures();
		tempA = tA;
		tempB = tB;

		try {
			const [a, b] = await Promise.all([
				fetchResponseStreaming(currentPrompt.prompt, tA, (text) => {
					streamingTextA = text;
				}),
				fetchResponseStreaming(currentPrompt.prompt, tB, (text) => {
					streamingTextB = text;
				})
			]);
			responseA = a;
			responseB = b;

			// Start pre-generating the next pair while user reads
			startPreGeneration();
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			generating = false;
		}
	}

	async function selectPreference(pref: 'A' | 'B' | 'tie') {
		if (!responseA || !responseB || !currentPrompt) return;

		saving = true;
		errorMessage = '';

		const now = new Date().toISOString();
		let chosen: string, rejected: string;
		let chosenMeta: ResponseMeta, rejectedMeta: ResponseMeta;

		if (pref === 'B') {
			chosen = responseB.text;
			rejected = responseA.text;
			chosenMeta = responseB;
			rejectedMeta = responseA;
		} else {
			chosen = responseA.text;
			rejected = responseB.text;
			chosenMeta = responseA;
			rejectedMeta = responseB;
		}

		const record: PreferenceRecord = {
			timestamp: now,
			prompt: currentPrompt.prompt,
			chosen,
			rejected,
			preference: pref,
			is_tie: pref === 'tie',
			prompt_category: 'general',
			prompt_id: currentPrompt.id,
			prompt_tags: currentPrompt.tags,
			chosen_metadata: {
				model: chosenMeta.model,
				temperature: chosenMeta.temperature,
				input_tokens: chosenMeta.input_tokens,
				output_tokens: chosenMeta.output_tokens,
				latency_s: chosenMeta.latency_s,
				response_id: chosenMeta.response_id,
				stop_reason: chosenMeta.stop_reason
			},
			rejected_metadata: {
				model: rejectedMeta.model,
				temperature: rejectedMeta.temperature,
				input_tokens: rejectedMeta.input_tokens,
				output_tokens: rejectedMeta.output_tokens,
				latency_s: rejectedMeta.latency_s,
				response_id: rejectedMeta.response_id,
				stop_reason: rejectedMeta.stop_reason
			}
		};

		try {
			await savePreference(record);
			sessionCount++;
			if (!usedPromptIds.includes(currentPrompt.id)) {
				usedPromptIds = [...usedPromptIds, currentPrompt.id];
			}
			await advanceToNewPrompt();
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Failed to save preference';
		} finally {
			saving = false;
		}
	}

	async function advanceToNewPrompt() {
		responseA = null;
		responseB = null;
		streamingTextA = '';
		streamingTextB = '';
		errorMessage = '';

		// Check if pre-generated pair is ready
		if (pregenPromise) {
			await pregenPromise;
		}

		if (pregenPrompt && pregenA && pregenB) {
			// Use pre-generated results
			currentPrompt = pregenPrompt;
			responseA = pregenA;
			responseB = pregenB;
			tempA = pregenTempA;
			tempB = pregenTempB;
			streamingTextA = pregenA.text;
			streamingTextB = pregenB.text;

			// Clear pre-gen state
			pregenPrompt = null;
			pregenA = null;
			pregenB = null;
			pregenPromise = null;

			// Start pre-generating the next one
			startPreGeneration();
		} else {
			// No pre-gen available, pick new prompt
			const next = getRandomPrompt(usedPromptIds);
			if (next) {
				currentPrompt = next;
			} else {
				usedPromptIds = [];
				currentPrompt = getRandomPrompt();
			}
			pregenPromise = null;
		}
	}

	async function newPrompt() {
		// Cancel any pre-gen since we're skipping
		pregenPrompt = null;
		pregenA = null;
		pregenB = null;
		pregenPromise = null;

		const next = getRandomPrompt(usedPromptIds);
		if (next) {
			currentPrompt = next;
		} else {
			usedPromptIds = [];
			currentPrompt = getRandomPrompt();
		}
		responseA = null;
		responseB = null;
		streamingTextA = '';
		streamingTextB = '';
		errorMessage = '';
		await generatePair();
	}
</script>

<svelte:head>
	<title>Human Preference Collector</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Human Preference Collector</h1>
		<p class="subtitle">
			Read the prompt, generate two responses, then pick the one you prefer.
			Your choice is saved automatically.
		</p>
		{#if sessionCount > 0}
			<div class="counter">{sessionCount} preference{sessionCount === 1 ? '' : 's'} saved this session</div>
		{/if}
	</header>

	<!-- Prompt Display -->
	<section class="prompt-section">
		<div class="prompt-label">
			<span class="prompt-id">{currentPrompt?.id}</span>
			<span class="prompt-tags">
				{#each currentPrompt?.tags ?? [] as tag}
					<span class="tag">{tag}</span>
				{/each}
			</span>
		</div>
		<div class="prompt-text">{currentPrompt?.prompt}</div>
	</section>

	<!-- Generate / New Prompt -->
	<section class="actions">
		<button
			class="btn primary"
			disabled={generating || saving || !currentPrompt || (responseA !== null && responseB !== null)}
			onclick={generatePair}
		>
			{generating ? 'Streaming responses...' : 'Generate Response Pair'}
		</button>
		<button class="btn" disabled={generating || saving} onclick={newPrompt}>
			New Prompt
		</button>
	</section>

	{#if errorMessage}
		<div class="error-box">{errorMessage}</div>
	{/if}

	<!-- Streaming / Final Responses -->
	{#if generating}
		<section class="responses">
			<div class="response-card streaming">
				<h3>Response A {streamingTextA ? '' : '(waiting...)'}</h3>
				<div class="response-text">{streamingTextA}<span class="cursor">|</span></div>
			</div>
			<div class="response-card streaming">
				<h3>Response B {streamingTextB ? '' : '(waiting...)'}</h3>
				<div class="response-text">{streamingTextB}<span class="cursor">|</span></div>
			</div>
		</section>
	{/if}

	{#if !generating && responseA && responseB}
		<section class="responses">
			<button
				class="response-card clickable"
				disabled={saving}
				onclick={() => selectPreference('A')}
			>
				<h3>Response A</h3>
				<div class="response-text">{responseA.text}</div>
			</button>

			<button
				class="response-card clickable"
				disabled={saving}
				onclick={() => selectPreference('B')}
			>
				<h3>Response B</h3>
				<div class="response-text">{responseB.text}</div>
			</button>
		</section>

		<div class="tie-row">
			<button class="btn tie-btn" disabled={saving} onclick={() => selectPreference('tie')}>
				Both are equal (Tie)
			</button>
		</div>

		{#if saving}
			<div class="saving-indicator">Saving preference...</div>
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0f1117;
		color: #e0e0e0;
	}

	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}
	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.8rem;
	}
	.subtitle {
		color: #8888aa;
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
	}
	.counter {
		display: inline-block;
		background: #1a2540;
		border: 1px solid #2a5cff44;
		border-radius: 20px;
		padding: 0.3rem 1rem;
		font-size: 0.85rem;
		color: #7aa3ff;
	}

	/* Prompt */
	.prompt-section {
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 10px;
		padding: 1.25rem;
		margin-bottom: 1.25rem;
	}
	.prompt-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}
	.prompt-id {
		font-size: 0.8rem;
		font-weight: 600;
		color: #7aa3ff;
		background: #1a2540;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}
	.tag {
		font-size: 0.7rem;
		color: #888;
		background: #252838;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
	}
	.prompt-text {
		font-size: 1rem;
		line-height: 1.6;
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.btn {
		padding: 0.6rem 1.5rem;
		border: 1px solid #3d4060;
		border-radius: 6px;
		background: #1a1d27;
		color: #e0e0e0;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn:hover:not(:disabled) {
		background: #252838;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn.primary {
		background: #2a5cff;
		border-color: #2a5cff;
		color: white;
	}
	.btn.primary:hover:not(:disabled) {
		background: #1e4bdb;
	}

	/* Responses */
	.responses {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.response-card {
		background: #1a1d27;
		border: 2px solid #3d4060;
		border-radius: 10px;
		padding: 1.25rem;
		text-align: left;
		color: #e0e0e0;
		font-family: inherit;
		font-size: inherit;
		width: 100%;
	}
	.response-card.clickable {
		cursor: pointer;
		transition: border-color 0.15s, transform 0.1s;
	}
	.response-card.clickable:hover:not(:disabled) {
		border-color: #2a5cff;
		transform: translateY(-2px);
	}
	.response-card.clickable:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}
	.response-card.streaming {
		border-color: #2a5cff44;
	}
	.response-card h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		color: #7aa3ff;
	}
	.response-text {
		white-space: pre-wrap;
		line-height: 1.6;
		font-size: 0.9rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.cursor {
		animation: blink 0.8s step-end infinite;
		color: #2a5cff;
		font-weight: bold;
	}
	@keyframes blink {
		50% { opacity: 0; }
	}

	/* Tie */
	.tie-row {
		text-align: center;
		margin-bottom: 1rem;
	}
	.tie-btn {
		color: #aab;
		font-size: 0.85rem;
	}

	/* Saving */
	.saving-indicator {
		text-align: center;
		color: #7aa3ff;
		font-size: 0.85rem;
		padding: 0.5rem;
	}

	/* Error */
	.error-box {
		background: #401a1a;
		border: 1px solid #ff4444;
		border-radius: 6px;
		padding: 0.75rem;
		margin-bottom: 1rem;
		color: #ff8888;
	}

	@media (max-width: 768px) {
		.responses {
			grid-template-columns: 1fr;
		}
	}
</style>
