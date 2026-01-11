<script lang="ts">
	import { onMount } from 'svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import TokensChart from '$lib/components/TokensChart.svelte';
	import TokensZoomChart from '$lib/components/TokensZoomChart.svelte';

	interface Stats {
		totals: {
			total_requests: number;
			total_input: number;
			total_output: number;
			total_reasoning: number;
			total_cache_read: number;
			total_cache_write: number;
			total_cost: number;
		};
		costByModel: {
			model_id: string;
			provider_id: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];
		usageByHour: { hour: number; request_count: number; cost_usd: number }[];
		tokensByHourToday: { hour: number; tokens_input: number; tokens_output: number }[];
		tokensByDay: { date: string; tokens_input: number; tokens_output: number }[];
		usageByDayOfWeek: { day_of_week: number; request_count: number; cost_usd: number }[];
		costOverTime: {
			date: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];
		agentBreakdown: {
			agent: string;
			request_count: number;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
		}[];
		avgDurationByModel: { model_id: string; avg_duration_ms: number; request_count: number }[];
		recentRequests: {
			id: number;
			model_id: string;
			tokens_input: number;
			tokens_output: number;
			cost_usd: number;
			created_at: string;
		}[];
	}

	let stats: Stats | null = $state(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let currentTime = $state(new Date().toLocaleTimeString());

	onMount(() => {
		fetchStats();
		// Update time every second
		const interval = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);
		return () => clearInterval(interval);
	});

	async function fetchStats() {
		try {
			const res = await fetch('/api/stats');
			if (!res.ok) throw new Error('Failed to fetch stats');
			stats = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toLocaleString();
	}

	function formatCost(n: number): string {
		if (n >= 100) return '$' + n.toFixed(0);
		if (n >= 1) return '$' + n.toFixed(2);
		return '$' + n.toFixed(4);
	}

	function getModelShortName(model: string): string {
		// Extract meaningful part of model name
		const parts = model.split('/');
		const name = parts[parts.length - 1];
		if (name.length > 20) return name.slice(0, 20) + '...';
		return name;
	}

	function formatDuration(ms: number): string {
		if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
		return ms.toFixed(0) + 'ms';
	}

	// Derived data for charts
	let costTimeData = $derived.by(() => {
		if (!stats) return [];
		return stats.costOverTime.map((d) => ({ date: d.date, value: d.cost_usd }));
	});

	let modelCostData = $derived.by(() => {
		if (!stats) return [];
		return stats.costByModel
			.slice(0, 8)
			.map((d) => ({ label: getModelShortName(d.model_id), value: d.cost_usd }));
	});

	let agentCostData = $derived.by(() => {
		if (!stats) return [];
		return stats.agentBreakdown.map((d) => ({ label: d.agent || 'unknown', value: d.cost_usd }));
	});

	let tokensTimeData = $derived.by(() => {
		if (!stats) return [];
		return stats.costOverTime.map((d) => ({
			date: d.date,
			tokens_input: d.tokens_input,
			tokens_output: d.tokens_output
		}));
	});
</script>

<div class="dashboard">
	<!-- Header -->
	<header class="header">
		<div class="header-left">
			<h1 class="logo">
				<span class="logo-bracket">[</span>
				<span class="logo-text">OPENCODE</span>
				<span class="logo-bracket">]</span>
				<span class="logo-suffix">stats</span>
			</h1>
		</div>
		<div class="header-right">
			<div class="clock">{currentTime}</div>
			<button onclick={fetchStats} class="refresh-btn">
				<span class="refresh-icon">↻</span> REFRESH
			</button>
		</div>
	</header>

	{#if loading}
		<div class="loading">LOADING DATA</div>
	{:else if error}
		<div class="error-state">
			<div class="error-icon">!</div>
			<p>ERROR: {error}</p>
			<button onclick={fetchStats}>RETRY</button>
		</div>
	{:else if stats}
		<!-- Main Stats Row -->
		<section class="stats-grid">
			<div class="stat-card primary">
				<div class="stat-value">{formatCost(stats.totals.total_cost)}</div>
				<div class="stat-label">TOTAL SPENT</div>
				<div class="stat-decoration"></div>
			</div>
			<div class="stat-card">
				<div class="stat-value cyan">{formatNumber(stats.totals.total_requests)}</div>
				<div class="stat-label">TOTAL REQUESTS</div>
			</div>
			<div class="stat-card">
				<div class="stat-value magenta">{formatNumber(stats.totals.total_input)}</div>
				<div class="stat-label">INPUT TOKENS</div>
			</div>
			<div class="stat-card">
				<div class="stat-value amber">{formatNumber(stats.totals.total_output)}</div>
				<div class="stat-label">OUTPUT TOKENS</div>
			</div>
		</section>

		<!-- Charts Row 1 -->
		<section class="charts-row">
			<div class="chart-card wide">
				<h2>COST OVER TIME</h2>
				<AreaChart data={costTimeData} height={220} color="#3b82f6" gradientId="costGrad" />
			</div>
			<div class="chart-card">
				<h2>COST BY MODEL</h2>
				<DonutChart data={modelCostData} height={280} />
			</div>
		</section>

		<!-- Charts Row 2 -->
		<section class="charts-row">
			<div class="chart-card wide">
				<h2>TOKEN FLOW</h2>
				<TokensChart data={tokensTimeData} height={220} />
			</div>
			<div class="chart-card">
				<h2>COST BY AGENT</h2>
				<BarChart data={agentCostData} height={220} color="#3b82f6" horizontal={true} />
			</div>
		</section>

		<!-- Tokens explorer (replaces heatmap) -->
		<section class="charts-row single">
			<div class="chart-card full">
				<TokensZoomChart hourly={stats.tokensByHourToday} daily={stats.tokensByDay} height={220} />
			</div>
		</section>

		<!-- Model Performance Table -->
		<section class="table-section">
			<h2>MODEL PERFORMANCE</h2>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>MODEL</th>
							<th>REQUESTS</th>
							<th>INPUT</th>
							<th>OUTPUT</th>
							<th>AVG DURATION</th>
							<th>COST</th>
						</tr>
					</thead>
					<tbody>
						{#each stats.costByModel as model}
							{@const avgDuration = stats.avgDurationByModel.find(
								(d) => d.model_id === model.model_id
							)}
							<tr>
								<td class="model-name">
									<span class="provider-tag">{model.provider_id}</span>
									{getModelShortName(model.model_id)}
								</td>
								<td>{model.request_count.toLocaleString()}</td>
								<td class="cyan-text">{formatNumber(model.tokens_input)}</td>
								<td class="magenta-text">{formatNumber(model.tokens_output)}</td>
								<td>{avgDuration ? formatDuration(avgDuration.avg_duration_ms) : '-'}</td>
								<td class="cost-cell">{formatCost(model.cost_usd)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Recent Activity -->
		<section class="table-section">
			<h2>RECENT ACTIVITY</h2>
			<div class="table-wrapper recent">
				<table>
					<thead>
						<tr>
							<th>TIME</th>
							<th>MODEL</th>
							<th>INPUT</th>
							<th>OUTPUT</th>
							<th>COST</th>
						</tr>
					</thead>
					<tbody>
						{#each stats.recentRequests.slice(0, 15) as req}
							<tr>
								<td class="time-cell">
									{new Date(req.created_at).toLocaleString(undefined, {
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</td>
								<td class="model-name">{getModelShortName(req.model_id)}</td>
								<td class="cyan-text">{formatNumber(req.tokens_input)}</td>
								<td class="magenta-text">{formatNumber(req.tokens_output)}</td>
								<td class="cost-cell">{formatCost(req.cost_usd)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<!-- Footer -->
		<footer class="footer">
			<div class="footer-stats">
				<span>Cache Read: {formatNumber(stats.totals.total_cache_read)}</span>
				<span class="separator">|</span>
				<span>Cache Write: {formatNumber(stats.totals.total_cache_write)}</span>
				<span class="separator">|</span>
				<span>Reasoning: {formatNumber(stats.totals.total_reasoning)}</span>
			</div>
			<div class="footer-brand">
				OPENCODE STATS v1.0
			</div>
		</footer>
	{/if}
</div>

<style>
	.dashboard {
		min-height: 100vh;
		padding: 1.5rem;
		max-width: 1600px;
		margin: 0 auto;
	}

	/* Header */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--grid-line-bright);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.logo {
		font-size: 1.5rem;
		font-weight: 700;
		display: flex;
		align-items: baseline;
		gap: 0.1rem;
	}

	.logo-bracket {
		color: var(--green-dim);
	}

	.logo-text {
		color: var(--green-glow);
	}

	.logo-suffix {
		color: var(--text-tertiary);
		font-weight: 400;
		font-size: 1rem;
		margin-left: 0.25rem;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		background: var(--accent);
		border: 1px solid rgba(255, 255, 255, 0.18);
	}

	.status-text {
		font-size: 0.7rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.clock {
		font-size: 1.25rem;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.refresh-icon {
		font-size: 1rem;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--grid-line-bright);
		border-radius: var(--radius-md);
		padding: 1.5rem;
		position: relative;
		overflow: hidden;
	}

	.stat-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--green-dim), transparent);
	}

	.stat-card.primary {
		border-color: var(--accent-dim);
	}

	.stat-card.primary::before {
		background: linear-gradient(90deg, transparent, var(--green-glow), transparent);
		height: 3px;
	}

	.stat-decoration {
		position: absolute;
		bottom: -20px;
		right: -20px;
		width: 100px;
		height: 100px;
		background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
		pointer-events: none;
	}

	/* Charts */
	.charts-row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.charts-row.single {
		grid-template-columns: 1fr;
	}

	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--grid-line-bright);
		border-radius: var(--radius-md);
		padding: 1.5rem;
	}

	.chart-card h2 {
		margin-bottom: 1rem;
		font-size: 0.75rem;
	}

	.chart-card.full {
		width: 100%;
	}

	/* Tables */
	.table-section {
		background: var(--bg-card);
		border: 1px solid var(--grid-line-bright);
		border-radius: var(--radius-md);
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.table-section h2 {
		margin-bottom: 1rem;
		font-size: 0.75rem;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	.table-wrapper.recent {
		max-height: 400px;
		overflow-y: auto;
	}

	.model-name {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.85rem;
	}

	.provider-tag {
		display: inline-block;
		background: transparent;
		border: 1px solid var(--accent-dim);
		color: var(--text-secondary);
		padding: 0.1rem 0.4rem;
		border-radius: 0;
		font-size: 0.65rem;
		margin-right: 0.5rem;
		text-transform: uppercase;
	}

	.cyan-text {
		color: var(--cyan-glow);
	}

	.magenta-text {
		color: var(--magenta-glow);
	}

	.cost-cell {
		color: var(--green-glow);
		font-weight: 500;
	}

	.time-cell {
		color: var(--text-tertiary);
		font-size: 0.8rem;
	}

	/* Footer */
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 0;
		border-top: 1px solid var(--grid-line-bright);
		color: var(--text-tertiary);
		font-size: 0.75rem;
	}

	.footer-stats {
		display: flex;
		gap: 0.5rem;
	}

	.separator {
		color: var(--green-dim);
	}

	.footer-brand {
		letter-spacing: 0.15em;
	}

	/* Error state */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		gap: 1rem;
	}

	.error-icon {
		width: 60px;
		height: 60px;
		border: 1px solid var(--accent);
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: var(--accent);
	}

	/* Responsive */
	@media (max-width: 1200px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.charts-row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: 1fr;
		}

		.header {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}

		.header-right {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
