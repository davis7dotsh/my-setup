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

	function formatPercent(part: number, total: number): string {
		if (total <= 0) return '0%';
		return ((part / total) * 100).toFixed(1) + '%';
	}
</script>

{#snippet loadingState()}
	<div class="loading-skeleton">
		<div class="skeleton-line"></div>
		<div class="skeleton-line short"></div>
	</div>
{/snippet}

{#snippet errorState(error: unknown, retry: () => void)}
	<div class="error-state">
		<span class="text-sm">Failed to load</span>
		<button onclick={retry} class="retry-btn">Retry</button>
	</div>
{/snippet}

<div class="page-container">
	<!-- Header -->
	<header class="header reveal" style="animation-delay: 40ms;">
		<div class="header-left">
			<div class="header-breadcrumb">telemetry / tokens / cost</div>
			<h1 class="header-title">
				OpenCode <span class="accent">Observatory</span>
			</h1>
			<div class="header-subtitle">
				A tiny instrument panel for OpenCode's LLM usage.
			</div>
		</div>

		<div class="header-right">
			<div class="time-display">
				<div class="time-label">local time</div>
				<div class="time-value">{currentTime}</div>
			</div>
			<button onclick={refreshAll} class="btn">
				<span>↻</span> <span class="hidden xs:inline">refresh</span>
			</button>
		</div>
	</header>

	<!-- Main Stats Row -->
	<section class="stats-grid" aria-label="Top-level totals">
		<svelte:boundary>
			{#snippet pending()}
				<div class="panel reveal" style="animation-delay: 80ms;">
					<div class="stat-value accent pulse">--</div>
					<div class="stat-label">total spent</div>
				</div>
				<div class="panel reveal" style="animation-delay: 110ms;">
					<div class="stat-value accent pulse">--</div>
					<div class="stat-label">total requests</div>
				</div>
				<div class="panel reveal" style="animation-delay: 140ms;">
					<div class="stat-value primary pulse">--</div>
					<div class="stat-label">input tokens</div>
					<div class="stat-sublabel">cached --</div>
				</div>
				<div class="panel reveal" style="animation-delay: 170ms;">
					<div class="stat-value secondary pulse">--</div>
					<div class="stat-label">output tokens</div>
				</div>
			{/snippet}
			{#snippet failed(error, retry)}
				<div class="panel flex items-center justify-center">
					{@render errorState(error, retry)}
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			{@const totalPrompt = totals.total_input + totals.total_cache_read}
			<div class="panel reveal" style="animation-delay: 80ms;">
				<div class="stat-value accent">{formatCost(totals.total_cost)}</div>
				<div class="stat-label">total spent</div>
				<div class="panel-glow"></div>
			</div>
			<div class="panel reveal" style="animation-delay: 110ms;">
				<div class="stat-value accent">{formatNumber(totals.total_requests)}</div>
				<div class="stat-label">total requests</div>
			</div>
			<div class="panel reveal" style="animation-delay: 140ms;">
				<div class="stat-value primary">{formatNumber(totals.total_input)}</div>
				<div class="stat-label">input tokens</div>
				<div class="stat-sublabel">
					cached <span class="accent">{formatNumber(totals.total_cache_read)}</span>
					<span class="text-tertiary">({formatPercent(totals.total_cache_read, totalPrompt)})</span>
				</div>
			</div>
			<div class="panel reveal" style="animation-delay: 170ms;">
				<div class="stat-value secondary">{formatNumber(totals.total_output)}</div>
				<div class="stat-label">output tokens</div>
			</div>
		</svelte:boundary>
	</section>

	<!-- Charts Row 1 -->
	<section class="charts-grid">
		<div class="panel reveal" style="animation-delay: 210ms;">
			<h2 class="section-title">cost over time</h2>
			<svelte:boundary>
				{#snippet pending()}
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					{@render errorState(error, retry)}
				{/snippet}
				{@const costOverTime = await getCostOverTime()}
				{@const costTimeData = costOverTime.map((d) => ({ date: d.date, value: d.cost_usd }))}
				<AreaChart
					data={costTimeData}
					height={220}
					color="var(--color-accent)"
					gradientId="costGrad"
				/>
			</svelte:boundary>
		</div>
		<div class="panel reveal" style="animation-delay: 240ms;">
			<h2 class="section-title">cost by model</h2>
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
	<section class="charts-grid">
		<div class="panel reveal" style="animation-delay: 270ms;">
			<h2 class="section-title">token flow</h2>
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
		<div class="panel reveal" style="animation-delay: 300ms;">
			<h2 class="section-title">cost by agent</h2>
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
				<BarChart data={agentCostData} height={220} color="var(--color-accent)" horizontal={true} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Tokens explorer -->
	<section class="full-width-grid">
		<div class="panel reveal" style="animation-delay: 330ms;">
			<svelte:boundary>
				{#snippet pending()}
					<h2 class="section-title">tokens explorer</h2>
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					<h2 class="section-title">tokens explorer</h2>
					{@render errorState(error, retry)}
				{/snippet}
				{@const tokensData = await getTokensData()}
				<TokensZoomChart hourly={tokensData.hourly} daily={tokensData.daily} height={220} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Model Performance Table -->
	<section class="panel reveal" style="animation-delay: 360ms; margin-bottom: 1.5rem;">
		<h2 class="section-title">model performance</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const costByModel = await getCostByModel()}
			{@const modelPerformance = await getModelPerformance()}
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>model</th>
							<th>requests</th>
							<th>input</th>
							<th>output</th>
							<th>avg duration</th>
							<th>cost</th>
						</tr>
					</thead>
					<tbody>
						{#each costByModel as model}
							{@const avgDuration = modelPerformance.find((d) => d.model_id === model.model_id)}
							<tr>
								<td class="font-mono text-sm">
									<span class="provider-badge">{model.provider_id}</span>
									{getModelShortName(model.model_id)}
								</td>
								<td>{model.request_count.toLocaleString()}</td>
								<td class="text-accent">{formatNumber(model.tokens_input)}</td>
								<td class="text-primary">{formatNumber(model.tokens_output)}</td>
								<td>{avgDuration ? formatDuration(avgDuration.avg_duration_ms) : '-'}</td>
								<td class="text-accent font-medium">{formatCost(model.cost_usd)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</svelte:boundary>
	</section>

	<!-- Recent Activity -->
	<section class="panel reveal" style="animation-delay: 390ms; margin-bottom: 1.5rem;">
		<h2 class="section-title">recent activity</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const recentRequests = await getRecentRequests()}
			<div class="table-container scrollable">
				<table>
					<thead>
						<tr>
							<th>time</th>
							<th>model</th>
							<th>input</th>
							<th>output</th>
							<th>cost</th>
						</tr>
					</thead>
					<tbody>
						{#each recentRequests.slice(0, 15) as req}
							<tr>
								<td class="text-tertiary text-sm">
									{new Date(req.created_at).toLocaleString(undefined, {
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</td>
								<td class="font-mono text-sm">{getModelShortName(req.model_id)}</td>
								<td class="text-accent">{formatNumber(req.tokens_input)}</td>
								<td class="text-primary">{formatNumber(req.tokens_output)}</td>
								<td class="text-accent font-medium">{formatCost(req.cost_usd)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</svelte:boundary>
	</section>

	<!-- Footer -->
	<footer class="footer reveal" style="animation-delay: 420ms;">
		<svelte:boundary>
			{#snippet pending()}
				<div class="footer-stats">
					<span>Cache Read: --</span>
					<span class="text-accent-dim">|</span>
					<span>Cache Write: --</span>
					<span class="text-accent-dim">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{#snippet failed()}
				<div class="footer-stats">
					<span>Cache Read: --</span>
					<span class="text-accent-dim">|</span>
					<span>Cache Write: --</span>
					<span class="text-accent-dim">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			<div class="footer-stats">
				<span>Cache Read: {formatNumber(totals.total_cache_read)}</span>
				<span class="text-accent-dim">|</span>
				<span>Cache Write: {formatNumber(totals.total_cache_write)}</span>
				<span class="text-accent-dim">|</span>
				<span>Reasoning: {formatNumber(totals.total_reasoning)}</span>
			</div>
		</svelte:boundary>
		<div class="footer-version">OpenCode Stats v1.0</div>
	</footer>
</div>
