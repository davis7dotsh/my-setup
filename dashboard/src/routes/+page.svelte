<script lang="ts">
	import AreaChart from '$lib/components/AreaChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import TokensChart from '$lib/components/TokensChart.svelte';
	import TokensZoomChart from '$lib/components/TokensZoomChart.svelte';
	import {
		getTotals,
		getCostByModel,
		getCostOverTime,
		getTokensData,
		getAgentBreakdown,
		getModelPerformance,
		getRecentRequests
	} from '$lib/remote/stats.remote';

	let currentTime = $state(new Date().toLocaleTimeString());

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);
		return () => clearInterval(interval);
	});

	function refreshAll() {
		getTotals().refresh();
		getCostByModel().refresh();
		getCostOverTime().refresh();
		getTokensData().refresh();
		getAgentBreakdown().refresh();
		getModelPerformance().refresh();
		getRecentRequests().refresh();
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
		const parts = model.split('/');
		const name = parts[parts.length - 1];
		if (name.length > 20) return name.slice(0, 20) + '...';
		return name;
	}

	function formatDuration(ms: number): string {
		if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
		return ms.toFixed(0) + 'ms';
	}
</script>

{#snippet loadingState()}
	<div class="loading-skeleton">
		<div class="skeleton-bar"></div>
		<div class="skeleton-bar short"></div>
	</div>
{/snippet}

{#snippet errorState(error: unknown, retry: () => void)}
	<div class="error-inline">
		<span class="error-text">Failed to load</span>
		<button onclick={retry} class="retry-btn-small">Retry</button>
	</div>
{/snippet}

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
			<button onclick={refreshAll} class="refresh-btn">
				<span class="refresh-icon">↻</span> REFRESH
			</button>
		</div>
	</header>

	<!-- Main Stats Row -->
	<section class="stats-grid">
		<svelte:boundary>
			{#snippet pending()}
				<div class="stat-card primary">
					<div class="stat-value loading-pulse">--</div>
					<div class="stat-label">TOTAL SPENT</div>
				</div>
				<div class="stat-card">
					<div class="stat-value cyan loading-pulse">--</div>
					<div class="stat-label">TOTAL REQUESTS</div>
				</div>
				<div class="stat-card">
					<div class="stat-value magenta loading-pulse">--</div>
					<div class="stat-label">INPUT TOKENS</div>
				</div>
				<div class="stat-card">
					<div class="stat-value amber loading-pulse">--</div>
					<div class="stat-label">OUTPUT TOKENS</div>
				</div>
			{/snippet}
			{#snippet failed(error, retry)}
				<div class="stat-card primary error-card">
					{@render errorState(error, retry)}
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			<div class="stat-card primary">
				<div class="stat-value">{formatCost(totals.total_cost)}</div>
				<div class="stat-label">TOTAL SPENT</div>
				<div class="stat-decoration"></div>
			</div>
			<div class="stat-card">
				<div class="stat-value cyan">{formatNumber(totals.total_requests)}</div>
				<div class="stat-label">TOTAL REQUESTS</div>
			</div>
			<div class="stat-card">
				<div class="stat-value magenta">{formatNumber(totals.total_input)}</div>
				<div class="stat-label">INPUT TOKENS</div>
			</div>
			<div class="stat-card">
				<div class="stat-value amber">{formatNumber(totals.total_output)}</div>
				<div class="stat-label">OUTPUT TOKENS</div>
			</div>
		</svelte:boundary>
	</section>

	<!-- Charts Row 1 -->
	<section class="charts-row">
		<div class="chart-card wide">
			<h2>COST OVER TIME</h2>
			<svelte:boundary>
				{#snippet pending()}
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					{@render errorState(error, retry)}
				{/snippet}
				{@const costOverTime = await getCostOverTime()}
				{@const costTimeData = costOverTime.map((d) => ({ date: d.date, value: d.cost_usd }))}
				<AreaChart data={costTimeData} height={220} color="#3b82f6" gradientId="costGrad" />
			</svelte:boundary>
		</div>
		<div class="chart-card">
			<h2>COST BY MODEL</h2>
			<svelte:boundary>
				{#snippet pending()}
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					{@render errorState(error, retry)}
				{/snippet}
				{@const costByModel = await getCostByModel()}
				{@const modelCostData = costByModel
					.slice(0, 8)
					.map((d) => ({ label: getModelShortName(d.model_id), value: d.cost_usd }))}
				<DonutChart data={modelCostData} height={280} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Charts Row 2 -->
	<section class="charts-row">
		<div class="chart-card wide">
			<h2>TOKEN FLOW</h2>
			<svelte:boundary>
				{#snippet pending()}
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					{@render errorState(error, retry)}
				{/snippet}
				{@const costOverTime = await getCostOverTime()}
				{@const tokensTimeData = costOverTime.map((d) => ({
					date: d.date,
					tokens_input: d.tokens_input,
					tokens_output: d.tokens_output
				}))}
				<TokensChart data={tokensTimeData} height={220} />
			</svelte:boundary>
		</div>
		<div class="chart-card">
			<h2>COST BY AGENT</h2>
			<svelte:boundary>
				{#snippet pending()}
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					{@render errorState(error, retry)}
				{/snippet}
				{@const agentBreakdown = await getAgentBreakdown()}
				{@const agentCostData = agentBreakdown.map((d) => ({
					label: d.agent || 'unknown',
					value: d.cost_usd
				}))}
				<BarChart data={agentCostData} height={220} color="#3b82f6" horizontal={true} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Tokens explorer -->
	<section class="charts-row single">
		<div class="chart-card full">
			<svelte:boundary>
				{#snippet pending()}
					<h2>TOKENS EXPLORER</h2>
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					<h2>TOKENS EXPLORER</h2>
					{@render errorState(error, retry)}
				{/snippet}
				{@const tokensData = await getTokensData()}
				<TokensZoomChart hourly={tokensData.hourly} daily={tokensData.daily} height={220} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Model Performance Table -->
	<section class="table-section">
		<h2>MODEL PERFORMANCE</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const costByModel = await getCostByModel()}
			{@const modelPerformance = await getModelPerformance()}
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
						{#each costByModel as model}
							{@const avgDuration = modelPerformance.find((d) => d.model_id === model.model_id)}
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
		</svelte:boundary>
	</section>

	<!-- Recent Activity -->
	<section class="table-section">
		<h2>RECENT ACTIVITY</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const recentRequests = await getRecentRequests()}
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
						{#each recentRequests.slice(0, 15) as req}
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
		</svelte:boundary>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<svelte:boundary>
			{#snippet pending()}
				<div class="footer-stats">
					<span>Cache Read: --</span>
					<span class="separator">|</span>
					<span>Cache Write: --</span>
					<span class="separator">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{#snippet failed()}
				<div class="footer-stats">
					<span>Cache Read: --</span>
					<span class="separator">|</span>
					<span>Cache Write: --</span>
					<span class="separator">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			<div class="footer-stats">
				<span>Cache Read: {formatNumber(totals.total_cache_read)}</span>
				<span class="separator">|</span>
				<span>Cache Write: {formatNumber(totals.total_cache_write)}</span>
				<span class="separator">|</span>
				<span>Reasoning: {formatNumber(totals.total_reasoning)}</span>
			</div>
		</svelte:boundary>
		<div class="footer-brand">OPENCODE STATS v1.0</div>
	</footer>
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

	/* Loading states */
	.loading-skeleton {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 0;
	}

	.skeleton-bar {
		height: 1.5rem;
		background: linear-gradient(
			90deg,
			var(--bg-card) 0%,
			var(--grid-line-bright) 50%,
			var(--bg-card) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}

	.skeleton-bar.short {
		width: 60%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.loading-pulse {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.error-inline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		color: var(--accent);
	}

	.error-text {
		font-size: 0.85rem;
	}

	.retry-btn-small {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid var(--accent-dim);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.retry-btn-small:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.error-card {
		display: flex;
		align-items: center;
		justify-content: center;
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
