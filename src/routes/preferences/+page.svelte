<script lang="ts">
	interface Preference {
		id: number;
		timestamp: string;
		prompt: string;
		chosen: string;
		rejected: string;
		preference: string;
		is_tie: boolean;
		prompt_category: string | null;
		prompt_id: string | null;
		prompt_tags: string[] | null;
		chosen_metadata: Record<string, unknown> | null;
		rejected_metadata: Record<string, unknown> | null;
		reading_time_s: number | null;
		user_ip: string | null;
		temp_a: number | null;
		temp_b: number | null;
		scrolled_a: boolean | null;
		scrolled_b: boolean | null;
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
	let deleteConfirmText = $state('');

	function parseMeta(raw: Record<string, unknown> | null): Record<string, unknown> | null {
		if (!raw) return null;
		if (typeof raw === 'string') {
			try { return JSON.parse(raw); } catch { return null; }
		}
		return raw;
	}

	function scrollBadge(row: Preference): { text: string; warn: boolean } {
		const a = row.scrolled_a;
		const b = row.scrolled_b;
		if (a == null && b == null) return { text: '-', warn: false };
		const scrolled: string[] = [];
		const missed: string[] = [];
		if (a === true) scrolled.push('A');
		if (a === false) missed.push('A');
		if (b === true) scrolled.push('B');
		if (b === false) missed.push('B');
		if (missed.length > 0) {
			return { text: missed.length === 2 ? 'none' : '!' + missed[0], warn: true };
		}
		return { text: scrolled.join('+') || '-', warn: false };
	}

	function wordCount(text: string): number {
		return text.trim().split(/\s+/).length;
	}

	/** Expected minimum reading time based on total words at 200 wpm */
	function expectedReadTime(row: Preference): number {
		const totalWords = wordCount(row.chosen) + wordCount(row.rejected);
		return (totalWords / 200) * 60; // seconds
	}

	/** Returns true if reading time looks suspiciously fast for the response length */
	function isSuspectTime(row: Preference): boolean {
		if (row.reading_time_s == null) return false;
		// Flag if they read faster than 600 wpm (3x average reading speed)
		const minReasonable = expectedReadTime(row) / 3;
		return row.reading_time_s < minReasonable;
	}

	// ── Computed stats ──────────────────────────────────────────────
	let stats = $derived(() => {
		if (rows.length === 0) return null;
		const aWins = rows.filter(r => r.preference === 'A').length;
		const bWins = rows.filter(r => r.preference === 'B').length;
		const ties = rows.filter(r => r.preference === 'tie').length;
		const total = rows.length;
		const aRate = (aWins / total * 100).toFixed(1);
		const bRate = (bWins / total * 100).toFixed(1);
		const tieRate = (ties / total * 100).toFixed(1);

		const timesWithData = rows.filter(r => r.reading_time_s != null);
		const avgTime = timesWithData.length > 0
			? timesWithData.reduce((sum, r) => sum + r.reading_time_s!, 0) / timesWithData.length
			: null;
		const suspectCount = rows.filter(r => isSuspectTime(r)).length;

		// Per-IP position bias
		const ipMap = new Map<string, { a: number; b: number; total: number }>();
		for (const r of rows) {
			const ip = r.user_ip ?? 'unknown';
			if (!ipMap.has(ip)) ipMap.set(ip, { a: 0, b: 0, total: 0 });
			const entry = ipMap.get(ip)!;
			if (r.preference === 'A') entry.a++;
			else if (r.preference === 'B') entry.b++;
			entry.total++;
		}

		const biasedUsers: { ip: string; aRate: number; count: number }[] = [];
		for (const [ip, data] of ipMap) {
			if (data.total >= 5) {
				const rate = data.a / data.total;
				if (rate >= 0.75 || rate <= 0.25) {
					biasedUsers.push({ ip, aRate: rate * 100, count: data.total });
				}
			}
		}

		// Category distribution
		const catMap = new Map<string, number>();
		for (const r of rows) {
			const cat = (r.prompt_category && r.prompt_category !== 'general') ? r.prompt_category : r.prompt_id?.split('-')[0] ?? 'unknown';
			catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
		}
		const categories = [...catMap.entries()]
			.map(([name, count]) => ({ name, count, pct: (count / total * 100).toFixed(1) }))
			.sort((a, b) => b.count - a.count);
		const idealPerCat = total / categories.length;
		const imbalancedCats = categories.filter(c =>
			c.count > idealPerCat * 2 || c.count < idealPerCat * 0.5
		);

		// Temperature randomization audit
		const tempRows = rows.filter(r => r.temp_a != null && r.temp_b != null);
		let lowOnA = 0;
		let lowOnB = 0;
		for (const r of tempRows) {
			if (r.temp_a! < r.temp_b!) lowOnA++;
			else if (r.temp_b! < r.temp_a!) lowOnB++;
		}
		const tempTotal = lowOnA + lowOnB;
		const lowOnARate = tempTotal > 0 ? (lowOnA / tempTotal * 100).toFixed(1) : null;
		const lowOnBRate = tempTotal > 0 ? (lowOnB / tempTotal * 100).toFixed(1) : null;
		const tempBiased = tempTotal >= 10 && (lowOnA / tempTotal > 0.7 || lowOnA / tempTotal < 0.3);

		// Scroll tracking — null means no overflow (short content), 0 = overflow not scrolled, 1 = overflow scrolled
		const scrollRows = rows.filter(r => r.scrolled_a != null || r.scrolled_b != null);
		const unreadOverflow = scrollRows.filter(r => r.scrolled_a === false || r.scrolled_b === false).length;
		const fullyRead = scrollRows.length - unreadOverflow;
		const noScrollData = rows.length - scrollRows.length;

		return {
			aWins, bWins, ties, total, aRate, bRate, tieRate,
			avgTime, suspectCount, biasedUsers,
			categories, imbalancedCats,
			lowOnA, lowOnB, tempTotal, lowOnARate, lowOnBRate, tempBiased,
			scrollRows: scrollRows.length, unreadOverflow, fullyRead, noScrollData
		};
	});

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

	function exportData(format: 'json' | 'csv') {
		const a = document.createElement('a');
		a.href = `/api/export?format=${format}`;
		a.download = '';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
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
				<button class="btn export-btn" onclick={() => exportData('json')}>Export JSON</button>
				<button class="btn export-btn" onclick={() => exportData('csv')}>Export CSV</button>
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
		{@const s = stats()}
		{#if s}
			<div class="stats-panel">
				<div class="stat-group">
					<h3>Position Bias</h3>
					<div class="stat-row">
						<span>A chosen: <strong class:bias-warning={Number(s.aRate) >= 70}>{s.aRate}%</strong> ({s.aWins})</span>
						<span>B chosen: <strong class:bias-warning={Number(s.bRate) >= 70}>{s.bRate}%</strong> ({s.bWins})</span>
						<span>Ties: <strong>{s.tieRate}%</strong> ({s.ties})</span>
					</div>
					{#if s.biasedUsers.length > 0}
						<div class="bias-alert">
							Users with strong position bias (75%+ one side, 5+ responses):
							{#each s.biasedUsers as u}
								<span class="bias-user">{u.ip} — A rate: {u.aRate.toFixed(0)}% ({u.count} responses)</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="stat-group">
					<h3>Reading Quality</h3>
					<div class="stat-row">
						{#if s.avgTime != null}
							<span>Avg reading time: <strong>{s.avgTime.toFixed(1)}s</strong></span>
						{/if}
						<span>Suspect (3x+ reading speed): <strong class:bias-warning={s.suspectCount > 0}>{s.suspectCount}</strong> of {s.total}</span>
					</div>
				</div>
				<div class="stat-group">
					<h3>Scroll Engagement</h3>
					{#if s.scrollRows > 0}
						<div class="stat-row">
							<span>Had overflow: <strong>{s.scrollRows}</strong></span>
							<span>All overflow scrolled: <strong>{s.fullyRead}</strong></span>
							<span>Unread overflow: <strong class:bias-warning={s.unreadOverflow > 0}>{s.unreadOverflow}</strong></span>
						</div>
						{#if s.unreadOverflow > 0}
							<div class="bias-alert">
								{s.unreadOverflow} of {s.scrollRows} responses had content that overflowed the visible area but wasn't scrolled — these annotators may not have read the full text.
							</div>
						{/if}
					{:else}
						<div class="stat-row"><span>No overflow detected yet (responses fit within visible area).</span></div>
					{/if}
					{#if s.noScrollData > 0}
						<div class="stat-row" style="margin-top: 0.25rem;"><span style="font-size: 0.75rem; color: #666;">{s.noScrollData} records without overflow data (short responses or older records)</span></div>
					{/if}
				</div>
				<div class="stat-group">
					<h3>Category Distribution</h3>
					<div class="cat-grid">
						{#each s.categories as cat}
							<span class="cat-item" class:cat-imbalanced={s.imbalancedCats.some(c => c.name === cat.name)}>
								{cat.name}: {cat.count} ({cat.pct}%)
							</span>
						{/each}
					</div>
					{#if s.imbalancedCats.length > 0}
						<div class="bias-alert">
							Imbalanced categories detected (2x above or 0.5x below average). Consider collecting more data from underrepresented categories.
						</div>
					{/if}
				</div>
				<div class="stat-group">
					<h3>Temperature Randomization Audit</h3>
					{#if s.tempTotal > 0}
						<div class="stat-row">
							<span>Low temp on A: <strong class:bias-warning={s.tempBiased}>{s.lowOnARate}%</strong> ({s.lowOnA})</span>
							<span>Low temp on B: <strong class:bias-warning={s.tempBiased}>{s.lowOnBRate}%</strong> ({s.lowOnB})</span>
							<span>Total pairs: {s.tempTotal}</span>
						</div>
						{#if s.tempBiased}
							<div class="bias-alert">
								Temperature assignment is not balanced. The low-temperature response is consistently landing on one side, which could confound position bias with temperature preference.
							</div>
						{/if}
					{:else}
						<div class="stat-row"><span>No temperature data recorded yet.</span></div>
					{/if}
				</div>
			</div>
		{/if}

		<details class="summary-section">
			<summary style="cursor: pointer; font-weight: 600; font-size: 1rem; color: #7aa3ff;">Data Collection Methodology</summary>

			<h4>Overview</h4>
			<p>
				This tool collects human preference data for training a reward model via RLHF (Reinforcement Learning from Human Feedback).
				Two AI-generated responses are shown side-by-side for the same prompt, and a human annotator selects which response they prefer or marks a tie.
			</p>

			<h4>Response Generation</h4>
			<ul>
				<li>Responses are generated by <strong>Claude Haiku 4.5</strong> with a 512-token max output.</li>
				<li>Each pair uses <strong>two different temperatures</strong> — one low (0.1-0.3) and one high (0.8-1.0) — to create meaningful variation in style and creativity.</li>
				<li>The side assignment (A vs B) is <strong>randomized with a coin flip</strong>, so the low-temperature response appears on side A roughly 50% of the time. The temperature audit panel above verifies this is actually happening.</li>
				<li>Next-pair <strong>pre-generation</strong> runs in the background so annotators spend time reading, not waiting.</li>
			</ul>

			<h4>Prompt Library</h4>
			<ul>
				<li>51 curated prompts across 9 categories: advice, science, creative writing, technical, ethics, history, math/logic, persuasion, and how-to.</li>
				<li>Prompts are drawn randomly without replacement within a session to maximize coverage.</li>
				<li>The category distribution panel flags if any category is over- or under-represented in collected data.</li>
			</ul>

			<h4>Data Quality Signals Tracked</h4>
			<ul>
				<li><strong>Reading time</strong> — measured from when responses finish loading until the annotator clicks a preference. Flagged as suspect if the annotator read faster than 3x the average human reading speed (600 wpm) based on the combined word count of both responses.</li>
				<li><strong>Position bias</strong> — tracks whether Response A or B is chosen overall and per-user. If one side wins 70%+ of the time, it suggests annotators aren't reading carefully or have a systematic first-response preference.</li>
				<li><strong>Scroll engagement</strong> — tracks whether the annotator scrolled each response container. If responses overflow the visible area and the annotator never scrolled, they likely didn't read the full text. Displayed per-row and aggregated in the Scroll Engagement stats panel.</li>
				<li><strong>Per-user tracking via IP</strong> — enables detecting individual annotators who always pick the same side, rush through responses, or exhibit other patterns that would degrade data quality. Uses X-Forwarded-For header when behind a proxy, falling back to direct client address.</li>
				<li><strong>Temperature randomization audit</strong> — verifies the low-temperature response isn't consistently landing on one side. If randomization breaks, position bias becomes confounded with temperature preference, and the reward model learns the wrong signal.</li>
				<li><strong>Category distribution</strong> — monitors balance across prompt categories. Lopsided coverage means the reward model learns preferences for some domains much better than others.</li>
				<li><strong>Response length bias</strong> — token counts for both chosen and rejected responses are stored in metadata. During analysis, you can check whether longer responses are systematically preferred (a common bias in human evaluation).</li>
			</ul>

			<h4>Database Schema</h4>
			<ul>
				<li>Each record stores: prompt text, chosen/rejected responses, preference (A/B/tie), full generation metadata (model, temperature, tokens, latency, response ID) for both responses, reading time, scroll engagement per side (null if no overflow, true/false if overflow existed), annotator IP, and the temperature assigned to each side (A/B).</li>
				<li>PostgreSQL hosted on Supabase for persistent, reliable storage.</li>
			</ul>
		</details>

		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>Prompt</th>
					<th>Preference</th>
					<th>Reading Time</th>
					<th>Scrolled</th>
					<th>User IP</th>
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
						<td>
							{#if row.reading_time_s != null}
								<span class="reading-time" class:suspect={isSuspectTime(row)}>
									{row.reading_time_s.toFixed(1)}s
								</span>
							{:else}
								-
							{/if}
						</td>
						<td>
							{#if row.scrolled_a != null || row.scrolled_b != null}
								{@const badge = scrollBadge(row)}
								<span class="scroll-badge" class:no-scroll={badge.warn}>
									{badge.text}
								</span>
							{:else}
								-
							{/if}
						</td>
						<td class="ip-cell">{row.user_ip ?? '-'}</td>
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
							<td colspan="9">
								<div class="detail-grid">
									<div class="detail-section">
										<h4>Prompt</h4>
										<p>{row.prompt}</p>
										<div class="meta">
											reading time: {row.reading_time_s != null ? row.reading_time_s.toFixed(1) + 's' : 'n/a'}
											{#if row.reading_time_s != null}
												({isSuspectTime(row) ? 'suspect' : 'ok'} — expected {expectedReadTime(row).toFixed(0)}s at 200wpm)
											{/if}
											| temp A: {row.temp_a ?? 'n/a'} | temp B: {row.temp_b ?? 'n/a'}
											| scrolled A: {row.scrolled_a != null ? (row.scrolled_a ? 'yes' : 'no') : 'n/a'} | scrolled B: {row.scrolled_b != null ? (row.scrolled_b ? 'yes' : 'no') : 'n/a'}
											| ip: {row.user_ip ?? 'n/a'}
										</div>
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

	{#if rows.length > 0}
		<section class="danger-zone">
			<h3>Danger Zone</h3>
			{#if confirmDeleteAll}
				<p class="danger-text">This will permanently delete all {rows.length} records. Type <strong>DELETE</strong> to confirm:</p>
				<div class="danger-actions">
					<input
						class="danger-input"
						type="text"
						placeholder="Type DELETE to confirm"
						bind:value={deleteConfirmText}
					/>
					<button
						class="btn danger"
						disabled={deleteConfirmText !== 'DELETE' || deletingAll}
						onclick={deleteAll}
					>
						{deletingAll ? 'Deleting...' : 'Permanently Delete All'}
					</button>
					<button class="btn" onclick={() => { confirmDeleteAll = false; deleteConfirmText = ''; }}>Cancel</button>
				</div>
			{:else}
				<button class="btn danger" onclick={() => confirmDeleteAll = true}>Delete All Records</button>
			{/if}
		</section>
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
	.export-btn {
		border-color: #44bb6644;
		color: #88cc88;
	}
	.export-btn:hover:not(:disabled) {
		background: #1a2a1a;
	}

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

	.reading-time {
		font-size: 0.8rem;
		color: #88cc88;
	}
	.reading-time.suspect {
		color: #ff6666;
		font-weight: 600;
	}

	.scroll-badge {
		font-size: 0.75rem;
		color: #88cc88;
		font-weight: 600;
	}
	.scroll-badge.no-scroll {
		color: #ff6666;
	}

	.ip-cell {
		font-size: 0.8rem;
		color: #888;
		font-family: monospace;
	}

	.stats-panel {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}
	.stat-group {
		flex: 1;
		min-width: 280px;
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 8px;
		padding: 1rem 1.25rem;
	}
	.stat-group h3 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: #7aa3ff;
	}
	.stat-row {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.bias-warning {
		color: #ff6666;
	}
	.bias-alert {
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #2a2020;
		border: 1px solid #ff444444;
		border-radius: 6px;
		font-size: 0.8rem;
		color: #ff8888;
	}
	.bias-user {
		display: block;
		margin-top: 0.25rem;
		font-family: monospace;
		font-size: 0.75rem;
	}
	.cat-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.cat-item {
		font-size: 0.8rem;
		background: #252838;
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
	}
	.cat-imbalanced {
		border: 1px solid #ff666644;
		color: #ffaa66;
	}
	.summary-section {
		background: #1a1d27;
		border: 1px solid #3d4060;
		border-radius: 8px;
		padding: 1.25rem 1.5rem;
		margin-bottom: 1.5rem;
		line-height: 1.7;
		font-size: 0.85rem;
	}
	.summary-section h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
		color: #7aa3ff;
	}
	.summary-section h4 {
		margin: 1rem 0 0.3rem;
		font-size: 0.9rem;
		color: #aaccff;
	}
	.summary-section ul {
		margin: 0.25rem 0;
		padding-left: 1.25rem;
	}
	.summary-section li {
		margin-bottom: 0.25rem;
	}

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

	/* ── Danger Zone ──────────────────────────────────────────── */
	.danger-zone {
		margin-top: 3rem;
		padding: 1.25rem 1.5rem;
		border: 1px solid #bb4444;
		border-radius: 8px;
		background: #1a1117;
	}
	.danger-zone h3 {
		margin: 0 0 0.75rem;
		color: #ff6666;
		font-size: 1rem;
	}
	.danger-text {
		font-size: 0.85rem;
		color: #ff8888;
		margin: 0 0 0.75rem;
	}
	.danger-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.danger-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #bb4444;
		border-radius: 6px;
		background: #12141c;
		color: #e0e0e0;
		font-size: 0.85rem;
		width: 200px;
	}
	.danger-input::placeholder {
		color: #666;
	}

	@media (max-width: 768px) {
		.prompt-cell { max-width: 200px; }
	}
</style>
