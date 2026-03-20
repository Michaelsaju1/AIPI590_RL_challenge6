<script lang="ts">
	interface Preference {
		id: number;
		timestamp: string;
		prompt: string;
		chosen: string;
		rejected: string;
		preference: string;
		is_tie: number;
		prompt_category: string | null;
		prompt_id: string | null;
		prompt_tags: string | null;
		chosen_metadata: string | null;
		rejected_metadata: string | null;
		created_at: string;
	}

	let rows: Preference[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let expandedId: number | null = $state(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/preferences');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			rows = await res.json();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to load';
		} finally {
			loading = false;
		}
	}

	load();

	function toggleRow(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	function truncate(text: string, len = 80): string {
		return text.length > len ? text.slice(0, len) + '...' : text;
	}

	let deleting = $state<number | null>(null);
	let deletingAll = $state(false);
	let confirmDeleteAll = $state(false);

	function parseMeta(raw: string | null): Record<string, unknown> | null {
		if (!raw) return null;
		try { return JSON.parse(raw); } catch { return null; }
	}

	async function deleteRow(id: number) {
		deleting = id;
		error = '';
		try {
			const res = await fetch(`/api/preferences?id=${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			rows = rows.filter((r) => r.id !== id);
			if (expandedId === id) expandedId = null;
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to delete';
		} finally {
			deleting = null;
		}
	}

	async function deleteAll() {
		deletingAll = true;
		error = '';
		try {
			const res = await fetch('/api/preferences', { method: 'DELETE' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			rows = [];
			expandedId = null;
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to delete all';
		} finally {
			deletingAll = false;
			confirmDeleteAll = false;
		}
	}
</script>

<svelte:head>
	<title>Saved Preferences</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Saved Preferences</h1>
		<p class="subtitle">{rows.length} record{rows.length === 1 ? '' : 's'} in database</p>
		<div class="header-actions">
			<a href="/" class="btn">Back to Collector</a>
			<button class="btn" onclick={load} disabled={loading}>Refresh</button>
			{#if rows.length > 0}
				{#if confirmDeleteAll}
					<span class="confirm-prompt">
						Are you sure?
						<button class="btn danger" onclick={deleteAll} disabled={deletingAll}>
							{deletingAll ? 'Deleting...' : 'Yes, delete all'}
						</button>
						<button class="btn" onclick={() => confirmDeleteAll = false}>Cancel</button>
					</span>
				{:else}
					<button class="btn danger" onclick={() => confirmDeleteAll = true}>Delete All</button>
				{/if}
			{/if}
		</div>
	</header>

	{#if loading}
		<p class="status">Loading...</p>
	{:else if error}
		<div class="error-box">{error}</div>
	{:else if rows.length === 0}
		<p class="status">No preferences saved yet.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Prompt</th>
					<th>Preference</th>
					<th>Category</th>
					<th>Timestamp</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row}
					<tr class="summary-row" onclick={() => toggleRow(row.id)}>
						<td>{row.id}</td>
						<td class="prompt-cell">{truncate(row.prompt)}</td>
						<td>
							<span class="pref-badge" class:tie={row.preference === 'tie'}>
								{row.preference}
							</span>
						</td>
						<td>{row.prompt_category ?? '-'}</td>
						<td class="ts">{new Date(row.timestamp).toLocaleString()}</td>
						<td>
							<button
								class="btn-delete"
								disabled={deleting === row.id}
								onclick={(e: MouseEvent) => { e.stopPropagation(); deleteRow(row.id); }}
							>
								{deleting === row.id ? '...' : 'X'}
							</button>
						</td>
					</tr>
					{#if expandedId === row.id}
						<tr class="detail-row">
							<td colspan="6">
								<div class="detail-grid">
									<div class="detail-section">
										<h4>Prompt</h4>
										<p>{row.prompt}</p>
									</div>
									<div class="detail-section chosen">
										<h4>Chosen</h4>
										<pre>{row.chosen}</pre>
										{#if parseMeta(row.chosen_metadata)}
											{@const meta = parseMeta(row.chosen_metadata)!}
											<div class="meta">
												temp: {meta.temperature} | tokens: {meta.input_tokens}/{meta.output_tokens} | latency: {Number(meta.latency_s).toFixed(2)}s
											</div>
										{/if}
									</div>
									<div class="detail-section rejected">
										<h4>Rejected</h4>
										<pre>{row.rejected}</pre>
										{#if parseMeta(row.rejected_metadata)}
											{@const meta = parseMeta(row.rejected_metadata)!}
											<div class="meta">
												temp: {meta.temperature} | tokens: {meta.input_tokens}/{meta.output_tokens} | latency: {Number(meta.latency_s).toFixed(2)}s
											</div>
										{/if}
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0f1117;
		color: #e0e0e0;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}
	h1 { margin: 0 0 0.25rem; font-size: 1.8rem; }
	.subtitle { color: #8888aa; margin: 0 0 1rem; font-size: 0.95rem; }

	.header-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn {
		padding: 0.5rem 1.2rem;
		border: 1px solid #3d4060;
		border-radius: 6px;
		background: #1a1d27;
		color: #e0e0e0;
		cursor: pointer;
		font-size: 0.85rem;
		text-decoration: none;
	}
	.btn:hover:not(:disabled) { background: #252838; }
	.btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.status { text-align: center; color: #8888aa; }

	.error-box {
		background: #401a1a;
		border: 1px solid #ff4444;
		border-radius: 6px;
		padding: 0.75rem;
		color: #ff8888;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		padding: 0.6rem 0.75rem;
		border-bottom: 2px solid #3d4060;
		color: #7aa3ff;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.summary-row {
		cursor: pointer;
		transition: background 0.1s;
	}
	.summary-row:hover { background: #1a1d27; }
	.summary-row td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #252838;
		font-size: 0.9rem;
	}

	.prompt-cell {
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pref-badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.8rem;
		background: #1a2540;
		color: #7aa3ff;
	}
	.pref-badge.tie { background: #2a2520; color: #ccaa55; }

	.ts { font-size: 0.8rem; color: #888; white-space: nowrap; }

	.detail-row td {
		padding: 1rem;
		background: #1a1d27;
		border-bottom: 2px solid #3d4060;
	}

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.detail-section h4 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: #7aa3ff;
	}
	.detail-section p {
		margin: 0;
		line-height: 1.6;
	}
	.detail-section pre {
		margin: 0;
		white-space: pre-wrap;
		font-size: 0.85rem;
		line-height: 1.5;
		max-height: 300px;
		overflow-y: auto;
		background: #12141c;
		padding: 0.75rem;
		border-radius: 6px;
	}
	.detail-section.chosen pre { border-left: 3px solid #44bb66; }
	.detail-section.rejected pre { border-left: 3px solid #bb4444; }

	.meta {
		margin-top: 0.4rem;
		font-size: 0.75rem;
		color: #888;
	}

	.btn.danger {
		border-color: #bb4444;
		color: #ff8888;
	}
	.btn.danger:hover:not(:disabled) {
		background: #401a1a;
	}

	.confirm-prompt {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #ff8888;
		font-size: 0.85rem;
	}

	.btn-delete {
		background: none;
		border: 1px solid transparent;
		color: #bb4444;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}
	.btn-delete:hover:not(:disabled) {
		background: #401a1a;
		border-color: #bb4444;
	}
	.btn-delete:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.prompt-cell { max-width: 200px; }
	}
</style>
