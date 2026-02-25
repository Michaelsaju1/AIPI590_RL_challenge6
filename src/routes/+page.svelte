<script lang="ts">
	import { PROMPTS, PROMPT_CATEGORY, getPromptById, getRandomPrompt } from '$lib/prompts';
	import type { Prompt, ResponseMeta, PreferenceRecord } from '$lib/types';

	// --- State ---
	let preferences: PreferenceRecord[] = $state([]);
	let responseA: ResponseMeta | null = $state(null);
	let responseB: ResponseMeta | null = $state(null);
	let currentPrompt = $state('');
	let currentPromptMeta: Prompt | null = $state(null);
	let generationDone = $state(false);
	let generating = $state(false);
	let generatingLabel = $state('');
	let usedPromptIds: string[] = $state([]);
	let errorMessage = $state('');

	// Sidebar settings
	let model = $state('claude-haiku-4-5');
	let temperature = $state(0.9);
	let maxTokens = $state(1024);

	// Prompt source
	let promptSource: 'curated' | 'random' | 'custom' = $state('curated');
	let selectedPromptId = $state(PROMPTS[0].id);
	let customPromptText = $state('');

	// UI toggles
	let showMetaA = $state(false);
	let showMetaB = $state(false);
	let showHistory = $state(false);
	let showPromptDetails = $state(false);
	let sidebarOpen = $state(true);

	// --- Derived ---
	let activePromptText = $derived.by(() => {
		if (promptSource === 'curated') {
			const p = getPromptById(selectedPromptId);
			return p?.prompt ?? '';
		}
		if (promptSource === 'random') {
			return currentPrompt;
		}
		return customPromptText;
	});

	let activePromptMeta = $derived.by(() => {
		if (promptSource === 'curated') {
			return getPromptById(selectedPromptId) ?? null;
		}
		if (promptSource === 'random') {
			return currentPromptMeta;
		}
		return null;
	});

	let sessionTies = $derived(preferences.filter((r) => r.is_tie).length);
	let promptsRemaining = $derived(PROMPTS.length - usedPromptIds.length);

	// --- Actions ---
	async function fetchResponse(prompt: string): Promise<ResponseMeta> {
		const res = await fetch('/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt, model, temperature, max_tokens: maxTokens })
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || `HTTP ${res.status}`);
		}
		return res.json();
	}

	async function generatePair() {
		if (!activePromptText) return;
		generating = true;
		errorMessage = '';
		try {
			generatingLabel = 'Generating Response A...';
			responseA = await fetchResponse(activePromptText);
			generatingLabel = 'Generating Response B...';
			responseB = await fetchResponse(activePromptText);
			currentPrompt = activePromptText;
			currentPromptMeta = activePromptMeta;
			generationDone = true;
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			generating = false;
			generatingLabel = '';
		}
	}

	function selectPreference(pref: 'A' | 'B' | 'tie') {
		if (!responseA || !responseB) return;

		const now = new Date().toISOString();
		let chosen: string, rejected: string;
		let chosenMeta: ResponseMeta, rejectedMeta: ResponseMeta;

		if (pref === 'A') {
			chosen = responseA.text;
			rejected = responseB.text;
			chosenMeta = responseA;
			rejectedMeta = responseB;
		} else if (pref === 'B') {
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
			prompt: currentPrompt,
			chosen,
			rejected,
			preference: pref,
			is_tie: pref === 'tie',
			prompt_category: PROMPT_CATEGORY,
			prompt_id: currentPromptMeta?.id ?? null,
			prompt_tags: currentPromptMeta?.tags ?? null,
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

		preferences = [...preferences, record];

		if (currentPromptMeta && !usedPromptIds.includes(currentPromptMeta.id)) {
			usedPromptIds = [...usedPromptIds, currentPromptMeta.id];
		}

		clearState();
	}

	function clearState() {
		responseA = null;
		responseB = null;
		generationDone = false;
		currentPrompt = '';
		currentPromptMeta = null;
		errorMessage = '';
	}

	function pickRandomPrompt() {
		const rp = getRandomPrompt(usedPromptIds);
		if (rp) {
			currentPrompt = rp.prompt;
			currentPromptMeta = rp;
		} else {
			errorMessage = 'All dataset prompts have been used!';
		}
	}

	function downloadJsonl(records: object[], filename: string) {
		const lines = records.map((r) => JSON.stringify(r));
		const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportFull() {
		const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		downloadJsonl(preferences, `preferences_full_${ts}.jsonl`);
	}

	function exportDpo() {
		const dpo = preferences.map((r) => ({
			prompt: r.prompt,
			chosen: r.chosen,
			rejected: r.rejected
		}));
		const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		downloadJsonl(dpo, `preferences_dpo_${ts}.jsonl`);
	}
</script>

<svelte:head>
	<title>Human Preference Collector</title>
</svelte:head>

<div class="app-layout">
	<!-- Sidebar -->
	<aside class="sidebar" class:collapsed={!sidebarOpen}>
		<button class="sidebar-toggle" onclick={() => (sidebarOpen = !sidebarOpen)}>
			{sidebarOpen ? '\u2190' : '\u2192'}
		</button>

		{#if sidebarOpen}
			<h2>Model</h2>
			<select bind:value={model}>
				<option value="claude-haiku-4-5">claude-haiku-4-5</option>
				<option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
				<option value="claude-opus-4-6">claude-opus-4-6</option>
			</select>

			<h2>Generation Settings</h2>
			<label>
				Temperature: {temperature.toFixed(2)}
				<input type="range" min="0" max="2" step="0.05" bind:value={temperature} />
			</label>
			<label>
				Max tokens: {maxTokens}
				<input type="range" min="128" max="4096" step="128" bind:value={maxTokens} />
			</label>

			<hr />
			<h2>Session Stats</h2>
			<div class="stat">Comparisons: <strong>{preferences.length}</strong></div>
			<div class="stat">Ties: <strong>{sessionTies}</strong></div>
			<div class="stat">Prompts remaining: <strong>{promptsRemaining}</strong></div>
		{/if}
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		<h1>Human Preference Collector</h1>
		<p class="subtitle">
			Generate paired responses from the same LLM, then select your preference. Data is exported
			as &#123;prompt, chosen, rejected&#125; pairs for alignment training.
		</p>

		<!-- Step 1: Prompt Selection -->
		<section class="step">
			<h2>1. Select or enter a prompt</h2>
			<div class="prompt-source-tabs">
				<button
					class:active={promptSource === 'curated'}
					onclick={() => (promptSource = 'curated')}
				>
					From curated dataset
				</button>
				<button
					class:active={promptSource === 'random'}
					onclick={() => (promptSource = 'random')}
				>
					Random from dataset
				</button>
				<button
					class:active={promptSource === 'custom'}
					onclick={() => (promptSource = 'custom')}
				>
					Custom prompt
				</button>
			</div>

			{#if promptSource === 'curated'}
				<select class="prompt-select" bind:value={selectedPromptId}>
					{#each PROMPTS as p}
						<option value={p.id}>[{p.id}] {p.prompt.slice(0, 90)}...</option>
					{/each}
				</select>
				<button class="link-btn" onclick={() => (showPromptDetails = !showPromptDetails)}>
					{showPromptDetails ? 'Hide' : 'Show'} prompt details
				</button>
				{#if showPromptDetails && activePromptMeta}
					<div class="details-box">
						<p><strong>Tags:</strong> {activePromptMeta.tags.join(', ')}</p>
						<p><strong>Core tension:</strong> {activePromptMeta.tension}</p>
						<p>{activePromptMeta.prompt}</p>
					</div>
				{/if}
			{:else if promptSource === 'random'}
				<button class="btn" onclick={pickRandomPrompt}>Pick random prompt</button>
				{#if currentPromptMeta}
					<div class="info-box">
						<strong>[{currentPromptMeta.id}]</strong>
						{currentPrompt}
					</div>
				{/if}
			{:else}
				<textarea
					class="custom-prompt"
					placeholder="Type a prompt to compare model responses..."
					bind:value={customPromptText}
					rows="4"
				></textarea>
			{/if}
		</section>

		<!-- Step 2: Generate -->
		<section class="step">
			<h2>2. Generate responses</h2>
			<div class="btn-row">
				<button
					class="btn primary"
					disabled={!activePromptText || generationDone || generating}
					onclick={generatePair}
				>
					{generating ? generatingLabel : 'Generate Response Pair'}
				</button>
				<button class="btn" onclick={clearState} disabled={generating}>Clear / New Prompt</button>
			</div>
			{#if errorMessage}
				<div class="error-box">{errorMessage}</div>
			{/if}
		</section>

		<!-- Step 3: Compare -->
		{#if generationDone && responseA && responseB}
			<section class="step">
				<h2>3. Compare responses</h2>
				<div class="response-grid">
					<div class="response-card">
						<h3>Response A</h3>
						<div class="response-text">{responseA.text}</div>
						<button class="link-btn" onclick={() => (showMetaA = !showMetaA)}>
							{showMetaA ? 'Hide' : 'Show'} metadata
						</button>
						{#if showMetaA}
							<pre class="meta">{JSON.stringify(
									{
										model: responseA.model,
										temperature: responseA.temperature,
										input_tokens: responseA.input_tokens,
										output_tokens: responseA.output_tokens,
										latency_s: responseA.latency_s,
										stop_reason: responseA.stop_reason
									},
									null,
									2
								)}</pre>
						{/if}
					</div>
					<div class="response-card">
						<h3>Response B</h3>
						<div class="response-text">{responseB.text}</div>
						<button class="link-btn" onclick={() => (showMetaB = !showMetaB)}>
							{showMetaB ? 'Hide' : 'Show'} metadata
						</button>
						{#if showMetaB}
							<pre class="meta">{JSON.stringify(
									{
										model: responseB.model,
										temperature: responseB.temperature,
										input_tokens: responseB.input_tokens,
										output_tokens: responseB.output_tokens,
										latency_s: responseB.latency_s,
										stop_reason: responseB.stop_reason
									},
									null,
									2
								)}</pre>
						{/if}
					</div>
				</div>
			</section>

			<!-- Step 4: Preference -->
			<section class="step">
				<h2>4. Select your preference</h2>
				<div class="pref-row">
					<button class="btn primary" onclick={() => selectPreference('A')}>
						A is better
					</button>
					<button class="btn" onclick={() => selectPreference('tie')}>Tie</button>
					<button class="btn primary" onclick={() => selectPreference('B')}>
						B is better
					</button>
				</div>
			</section>
		{/if}

		<!-- Export -->
		<hr />
		<section class="step">
			<h2>Export Data</h2>
			{#if preferences.length === 0}
				<p class="muted">No preferences recorded yet. Complete some comparisons above.</p>
			{:else}
				<div class="btn-row">
					<button class="btn" onclick={exportFull}>
						Download full records ({preferences.length} entries)
					</button>
					<button class="btn" onclick={exportDpo}>
						Download DPO pairs ({preferences.length} entries)
					</button>
				</div>
			{/if}
		</section>

		<!-- History -->
		{#if preferences.length > 0}
			<hr />
			<section class="step">
				<button class="link-btn" onclick={() => (showHistory = !showHistory)}>
					{showHistory ? 'Hide' : 'Show'} session history ({preferences.length} comparisons)
				</button>
				{#if showHistory}
					<div class="history">
						{#each [...preferences].reverse() as rec, i}
							{@const idx = preferences.length - i}
							{@const label =
								rec.preference === 'A'
									? 'Chose A'
									: rec.preference === 'B'
										? 'Chose B'
										: 'Tie'}
							<div class="history-item">
								<strong>#{idx}</strong> | {label} |
								<code>{rec.prompt_id ?? 'custom'}</code> |
								{rec.prompt.slice(0, 80)}...
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0f1117;
		color: #e0e0e0;
	}

	.app-layout {
		display: flex;
		min-height: 100vh;
	}

	/* Sidebar */
	.sidebar {
		width: 280px;
		background: #1a1d27;
		padding: 1rem;
		border-right: 1px solid #2d3040;
		flex-shrink: 0;
		position: relative;
		transition: width 0.2s;
	}
	.sidebar.collapsed {
		width: 40px;
		padding: 0.5rem;
	}
	.sidebar-toggle {
		background: none;
		border: 1px solid #3d4060;
		color: #e0e0e0;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}
	.sidebar h2 {
		font-size: 0.85rem;
		text-transform: uppercase;
		color: #8888aa;
		margin: 1rem 0 0.5rem;
	}
	.sidebar select {
		width: 100%;
		padding: 0.4rem;
		background: #0f1117;
		color: #e0e0e0;
		border: 1px solid #3d4060;
		border-radius: 4px;
	}
	.sidebar label {
		display: block;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
		color: #aab;
	}
	.sidebar input[type='range'] {
		width: 100%;
		margin-top: 0.25rem;
	}
	.sidebar hr {
		border: none;
		border-top: 1px solid #2d3040;
		margin: 1rem 0;
	}
	.stat {
		font-size: 0.85rem;
		margin-bottom: 0.3rem;
	}

	/* Main */
	.main-content {
		flex: 1;
		padding: 2rem;
		max-width: 1200px;
	}
	h1 {
		margin: 0 0 0.25rem;
	}
	.subtitle {
		color: #8888aa;
		margin: 0 0 1.5rem;
	}
	.step {
		margin-bottom: 1.5rem;
	}
	.step h2 {
		font-size: 1.1rem;
		margin-bottom: 0.75rem;
	}
	hr {
		border: none;
		border-top: 1px solid #2d3040;
		margin: 1.5rem 0;
	}

	/* Prompt source tabs */
	.prompt-source-tabs {
		display: flex;
		gap: 0;
		margin-bottom: 0.75rem;
	}
	.prompt-source-tabs button {
		padding: 0.5rem 1rem;
		background: #1a1d27;
		border: 1px solid #3d4060;
		color: #aab;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.prompt-source-tabs button:first-child {
		border-radius: 6px 0 0 6px;
	}
	.prompt-source-tabs button:last-child {
		border-radius: 0 6px 6px 0;
	}
	.prompt-source-tabs button.active {
		background: #2a5cff;
		color: white;
		border-color: #2a5cff;
	}

	.prompt-select {
		width: 100%;
		padding: 0.5rem;
		background: #1a1d27;
		color: #e0e0e0;
		border: 1px solid #3d4060;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	.custom-prompt {
		width: 100%;
		padding: 0.75rem;
		background: #1a1d27;
		color: #e0e0e0;
		border: 1px solid #3d4060;
		border-radius: 4px;
		resize: vertical;
		font-family: inherit;
		box-sizing: border-box;
	}

	/* Buttons */
	.btn {
		padding: 0.5rem 1.25rem;
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
	.btn-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.link-btn {
		background: none;
		border: none;
		color: #5588ff;
		cursor: pointer;
		padding: 0.25rem 0;
		font-size: 0.85rem;
		text-decoration: underline;
	}

	/* Info / Error boxes */
	.info-box {
		background: #1a2540;
		border: 1px solid #2a5cff44;
		border-radius: 6px;
		padding: 0.75rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		line-height: 1.5;
	}
	.error-box {
		background: #401a1a;
		border: 1px solid #ff4444;
		border-radius: 6px;
		padding: 0.75rem;
		margin-top: 0.5rem;
		color: #ff8888;
	}
	.details-box {
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 6px;
		padding: 0.75rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	/* Response grid */
	.response-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.response-card {
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 8px;
		padding: 1rem;
	}
	.response-card h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}
	.response-text {
		white-space: pre-wrap;
		line-height: 1.6;
		font-size: 0.9rem;
		max-height: 500px;
		overflow-y: auto;
	}
	.meta {
		background: #0f1117;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
		overflow-x: auto;
	}

	/* Preference row */
	.pref-row {
		display: flex;
		gap: 0.75rem;
	}
	.pref-row .btn {
		flex: 1;
		text-align: center;
	}

	/* History */
	.history {
		margin-top: 0.5rem;
	}
	.history-item {
		padding: 0.4rem 0;
		font-size: 0.85rem;
		border-bottom: 1px solid #1a1d27;
	}
	.history-item code {
		background: #252838;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.8rem;
	}

	.muted {
		color: #666;
	}

	@media (max-width: 768px) {
		.response-grid {
			grid-template-columns: 1fr;
		}
		.sidebar {
			width: 100%;
			border-right: none;
			border-bottom: 1px solid #2d3040;
		}
		.app-layout {
			flex-direction: column;
		}
	}
</style>
