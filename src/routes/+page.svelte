<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { getRandomPrompt } from '$lib/prompts';
	import type { Prompt, ResponseMeta, PreferenceRecord } from '$lib/types';

	// ── Constants ────────────────────────────────────────────────────
	const MODEL = 'claude-haiku-4-5';
	const MAX_TOKENS = 512;
	const LOW_TEMPS = [0.1, 0.2, 0.3];
	const HIGH_TEMPS = [0.8, 0.9, 1.0];
	const GOAL_COUNT = 5;

	// Configure marked for safe rendering
	marked.setOptions({ breaks: true, gfm: true });

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
	let responsesReadyAt: number | null = $state(null);
	let streamingStartedAt: number | null = $state(null);
	let scrolledA = $state(false);
	let scrolledB = $state(false);
	let elA: HTMLDivElement | undefined = $state(undefined);
	let elB: HTMLDivElement | undefined = $state(undefined);
	let showInstructions = $state(true);

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

	function renderMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string;
	}

	// ── Init ─────────────────────────────────────────────────────────
	currentPrompt = getRandomPrompt();

	onMount(() => {
		generatePair();
	});

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
		scrolledA = false;
		scrolledB = false;
		streamingStartedAt = null;

		const [tA, tB] = assignTemperatures();
		tempA = tA;
		tempB = tB;

		try {
			const [a, b] = await Promise.all([
				fetchResponseStreaming(currentPrompt.prompt, tA, (text) => {
					if (!streamingStartedAt) streamingStartedAt = Date.now();
					streamingTextA = text;
				}),
				fetchResponseStreaming(currentPrompt.prompt, tB, (text) => {
					if (!streamingStartedAt) streamingStartedAt = Date.now();
					streamingTextB = text;
				})
			]);
			responseA = a;
			responseB = b;
			responsesReadyAt = Date.now();

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
		// Use streamingStartedAt for streamed responses (user reads as words come in)
		// Use responsesReadyAt for pre-generated responses (text appears all at once)
		const timerStart = streamingStartedAt ?? responsesReadyAt;
		const readingTime = timerStart ? (Date.now() - timerStart) / 1000 : 0;
		const hasOverflowA = !!elA && elA.scrollHeight > elA.clientHeight;
		const hasOverflowB = !!elB && elB.scrollHeight > elB.clientHeight;
		let chosen: string, rejected: string;
		let chosenMeta: ResponseMeta, rejectedMeta: ResponseMeta;

		if (pref === 'B' || (pref === 'tie' && Math.random() < 0.5)) {
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
			prompt_category: currentPrompt.id.split('-')[0],
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
			},
			reading_time_s: Math.round(readingTime * 100) / 100,
			temp_a: tempA,
			temp_b: tempB,
			scrolled_a: hasOverflowA ? scrolledA : null,
			scrolled_b: hasOverflowB ? scrolledB : null
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
		scrolledA = false;
		scrolledB = false;
		streamingStartedAt = null;

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
			responsesReadyAt = Date.now();

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

{#if showInstructions}
<div class="modal-overlay">
	<div class="modal">
		<h2>Welcome to the Human Preference Collector</h2>
		<p>You'll be shown a prompt and two AI-generated responses side by side. Your job is to <strong>read both responses carefully</strong> and pick the one you prefer, or mark them as a tie.</p>
		<ul>
			<li>Take your time reading each response fully before choosing.</li>
			<li>There are no right or wrong answers — go with your genuine preference.</li>
			<li>You only need to complete <strong>{GOAL_COUNT} evaluations</strong>. Quality matters more than quantity — 5 careful reads are worth more than 20 rushed ones.</li>
			<li>After {GOAL_COUNT}, you can keep going if you'd like, but there's no pressure.</li>
		</ul>
		<button class="btn primary modal-ok" onclick={() => showInstructions = false}>Got it, let's start</button>
	</div>
</div>
{/if}

<div class="container">
	<header>
		<div class="header-top">
			<div class="progress-counter">
				{#if sessionCount < GOAL_COUNT}
					{sessionCount} / {GOAL_COUNT}
				{:else}
					{sessionCount} done
				{/if}
			</div>
			<h1>Human Preference Collector</h1>
		</div>
		{#if sessionCount >= GOAL_COUNT}
			<div class="thank-you">Thank you! You can keep going if you'd like, but you've completed the goal.</div>
		{:else}
			<p class="subtitle">
				Read both responses carefully, then click the one you prefer.
			</p>
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

	<!-- New Prompt (generate button removed — auto-generates on load) -->
	<section class="actions">
		<button class="btn" disabled={generating || saving} onclick={newPrompt}>
			Skip Prompt
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
				<div class="response-text markdown-body">{@html renderMarkdown(streamingTextA)}<span class="cursor">|</span></div>
			</div>
			<div class="response-card streaming">
				<h3>Response B {streamingTextB ? '' : '(waiting...)'}</h3>
				<div class="response-text markdown-body">{@html renderMarkdown(streamingTextB)}<span class="cursor">|</span></div>
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
				<div class="response-text markdown-body" bind:this={elA} onscroll={() => { scrolledA = true; }}>{@html renderMarkdown(responseA.text)}</div>
			</button>

			<button
				class="response-card clickable"
				disabled={saving}
				onclick={() => selectPreference('B')}
			>
				<h3>Response B</h3>
				<div class="response-text markdown-body" bind:this={elB} onscroll={() => { scrolledB = true; }}>{@html renderMarkdown(responseB.text)}</div>
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

	/* ── Modal ─────────────────────────────────────────────────── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}
	.modal {
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 12px;
		padding: 2rem 2.5rem;
		max-width: 560px;
		width: 90%;
		color: #e0e0e0;
	}
	.modal h2 {
		margin: 0 0 1rem;
		font-size: 1.3rem;
	}
	.modal p {
		line-height: 1.6;
		margin: 0 0 1rem;
		font-size: 0.95rem;
	}
	.modal ul {
		margin: 0 0 1.5rem;
		padding-left: 1.25rem;
		line-height: 1.7;
		font-size: 0.9rem;
	}
	.modal-ok {
		display: block;
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
	}

	/* ── Layout ────────────────────────────────────────────────── */
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}
	.header-top {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		position: relative;
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
	.progress-counter {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		background: #1a2540;
		border: 1px solid #2a5cff44;
		border-radius: 20px;
		padding: 0.3rem 1rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: #7aa3ff;
	}
	.thank-you {
		margin: 0.5rem 0;
		padding: 0.5rem 1rem;
		background: #1a2a1a;
		border: 1px solid #44bb6644;
		border-radius: 8px;
		color: #88cc88;
		font-size: 0.9rem;
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
		line-height: 1.6;
		font-size: 0.9rem;
		max-height: 500px;
		overflow-y: auto;
	}

	/* ── Markdown body styles ──────────────────────────────── */
	.markdown-body :global(p) {
		margin: 0 0 0.75rem;
	}
	.markdown-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4) {
		margin: 1rem 0 0.5rem;
		color: #c0c8e0;
	}
	.markdown-body :global(h1) { font-size: 1.2rem; }
	.markdown-body :global(h2) { font-size: 1.1rem; }
	.markdown-body :global(h3) { font-size: 1rem; }
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}
	.markdown-body :global(li) {
		margin-bottom: 0.25rem;
	}
	.markdown-body :global(code) {
		background: #12141c;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.85rem;
		font-family: 'Consolas', 'Monaco', monospace;
	}
	.markdown-body :global(pre) {
		background: #12141c;
		padding: 0.75rem;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0.5rem 0;
	}
	.markdown-body :global(pre code) {
		background: none;
		padding: 0;
	}
	.markdown-body :global(blockquote) {
		border-left: 3px solid #3d4060;
		margin: 0.5rem 0;
		padding: 0.25rem 0.75rem;
		color: #aab;
	}
	.markdown-body :global(strong) {
		color: #e8e8f0;
	}
	.markdown-body :global(table) {
		border-collapse: collapse;
		margin: 0.5rem 0;
		width: 100%;
	}
	.markdown-body :global(th),
	.markdown-body :global(td) {
		border: 1px solid #3d4060;
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
		text-align: left;
	}
	.markdown-body :global(th) {
		background: #1a2540;
		color: #7aa3ff;
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
		.container {
			padding: 1rem 0.75rem;
		}
		.header-top {
			flex-direction: column;
			gap: 0.5rem;
		}
		.progress-counter {
			position: static;
			transform: none;
			align-self: center;
		}
		h1 {
			font-size: 1.3rem;
		}
		.responses {
			grid-template-columns: 1fr;
		}
		.response-card {
			padding: 1rem;
		}
		.response-text {
			max-height: 350px;
			font-size: 0.85rem;
		}
		.modal {
			padding: 1.5rem;
			margin: 0.5rem;
		}
		.prompt-text {
			font-size: 0.9rem;
		}
		.btn {
			padding: 0.75rem 1.25rem;
			font-size: 0.85rem;
		}
		.tie-btn {
			width: 100%;
			padding: 0.75rem;
		}
	}
</style>
