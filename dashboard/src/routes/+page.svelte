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
	<div class="flex flex-col gap-2 py-4">
		<div class="h-6 rounded animate-shimmer"></div>
		<div class="h-6 w-3/5 rounded animate-shimmer"></div>
	</div>
{/snippet}

{#snippet errorState(error: unknown, retry: () => void)}
	<div class="flex items-center gap-3 p-2 text-accent">
		<span class="text-sm">Failed to load</span>
		<button
			onclick={retry}
			class="text-xs px-2 py-1 bg-transparent border border-accent-dim text-text-secondary hover:border-accent hover:text-accent cursor-pointer"
			>Retry</button
		>
	</div>
{/snippet}

<div class="min-h-screen p-4 max-w-[1600px] mx-auto sm:p-6">
	<!-- Header -->
	<header
		class="flex flex-col gap-4 mb-8 pb-4 border-b border-grid-line-bright sm:flex-row sm:justify-between sm:items-center"
	>
		<div class="flex items-center gap-6">
			<h1 class="text-xl font-bold flex items-baseline gap-0.5 sm:text-2xl">
				<span class="text-accent-dim">[</span>
				<span class="text-accent">OPENCODE</span>
				<span class="text-accent-dim">]</span>
				<span class="text-text-tertiary font-normal text-sm ml-1 sm:text-base">stats</span>
			</h1>
		</div>
		<div class="flex items-center justify-between gap-4 sm:gap-6">
			<div class="text-lg text-text-secondary tabular-nums sm:text-xl">{currentTime}</div>
			<button
				onclick={refreshAll}
				class="flex items-center gap-2 px-3 py-2 bg-bg-elevated border border-accent-dim text-accent-bright hover:bg-accent-dim hover:border-accent-bright cursor-pointer text-sm sm:px-4 sm:text-base"
			>
				<span class="text-base">↻</span> <span class="hidden xs:inline">REFRESH</span>
			</button>
		</div>
	</header>

	<!-- Main Stats Row -->
	<section class="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
		<svelte:boundary>
			{#snippet pending()}
				<div
					class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
				>
					<div class="text-2xl sm:text-4xl font-bold text-accent leading-none animate-pulse-custom">
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">TOTAL SPENT</div>
				</div>
				<div
					class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
				>
					<div class="text-2xl sm:text-4xl font-bold text-accent leading-none animate-pulse-custom">
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">
						TOTAL REQUESTS
					</div>
				</div>
				<div
					class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
				>
					<div
						class="text-2xl sm:text-4xl font-bold text-white/92 leading-none animate-pulse-custom"
					>
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">INPUT TOKENS</div>
				</div>
				<div
					class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
				>
					<div
						class="text-2xl sm:text-4xl font-bold text-white/[0.78] leading-none animate-pulse-custom"
					>
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">OUTPUT TOKENS</div>
				</div>
			{/snippet}
			{#snippet failed(error, retry)}
				<div
					class="bg-bg-card border border-accent-dim p-4 sm:p-6 flex items-center justify-center"
				>
					{@render errorState(error, retry)}
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			<div
				class="bg-bg-card border border-accent-dim p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-transparent before:via-accent before:to-transparent"
			>
				<div class="text-2xl sm:text-4xl font-bold text-accent leading-none">
					{formatCost(totals.total_cost)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">TOTAL SPENT</div>
				<div
					class="absolute -bottom-5 -right-5 w-[100px] h-[100px] bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none"
				></div>
			</div>
			<div
				class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
			>
				<div class="text-2xl sm:text-4xl font-bold text-accent leading-none">
					{formatNumber(totals.total_requests)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">TOTAL REQUESTS</div>
			</div>
			<div
				class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
			>
				<div class="text-2xl sm:text-4xl font-bold text-white/[0.92] leading-none">
					{formatNumber(totals.total_input)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">INPUT TOKENS</div>
			</div>
			<div
				class="bg-bg-card border border-grid-line-bright p-4 sm:p-6 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent-dim before:to-transparent"
			>
				<div class="text-2xl sm:text-4xl font-bold text-white/[0.78] leading-none">
					{formatNumber(totals.total_output)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">OUTPUT TOKENS</div>
			</div>
		</svelte:boundary>
	</section>

	<!-- Charts Row 1 -->
	<section class="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-[2fr_1fr]">
		<div class="bg-bg-card border border-grid-line-bright p-4 sm:p-6">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				COST OVER TIME
			</h2>
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
		<div class="bg-bg-card border border-grid-line-bright p-4 sm:p-6">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				COST BY MODEL
			</h2>
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
	<section class="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-[2fr_1fr]">
		<div class="bg-bg-card border border-grid-line-bright p-4 sm:p-6">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				TOKEN FLOW
			</h2>
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
		<div class="bg-bg-card border border-grid-line-bright p-4 sm:p-6">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				COST BY AGENT
			</h2>
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
	<section class="grid grid-cols-1 gap-4 mb-6">
		<div class="bg-bg-card border border-grid-line-bright p-4 w-full sm:p-6">
			<svelte:boundary>
				{#snippet pending()}
					<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
						TOKENS EXPLORER
					</h2>
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
						TOKENS EXPLORER
					</h2>
					{@render errorState(error, retry)}
				{/snippet}
				{@const tokensData = await getTokensData()}
				<TokensZoomChart hourly={tokensData.hourly} daily={tokensData.daily} height={220} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Model Performance Table -->
	<section class="bg-bg-card border border-grid-line-bright p-4 mb-6 sm:p-6">
		<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
			MODEL PERFORMANCE
		</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const costByModel = await getCostByModel()}
			{@const modelPerformance = await getModelPerformance()}
			<div class="overflow-x-auto">
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
								<td class="font-mono text-sm">
									<span
										class="inline-block bg-transparent border border-accent-dim text-text-secondary px-1.5 py-0.5 text-[0.65rem] mr-2 uppercase"
										>{model.provider_id}</span
									>
									{getModelShortName(model.model_id)}
								</td>
								<td>{model.request_count.toLocaleString()}</td>
								<td class="text-accent">{formatNumber(model.tokens_input)}</td>
								<td class="text-white/[0.92]">{formatNumber(model.tokens_output)}</td>
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
	<section class="bg-bg-card border border-grid-line-bright p-4 mb-6 sm:p-6">
		<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
			RECENT ACTIVITY
		</h2>
		<svelte:boundary>
			{#snippet pending()}
				{@render loadingState()}
			{/snippet}
			{#snippet failed(error, retry)}
				{@render errorState(error, retry)}
			{/snippet}
			{@const recentRequests = await getRecentRequests()}
			<div class="overflow-x-auto max-h-[400px] overflow-y-auto">
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
								<td class="text-text-tertiary text-sm">
									{new Date(req.created_at).toLocaleString(undefined, {
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</td>
								<td class="font-mono text-sm">{getModelShortName(req.model_id)}</td>
								<td class="text-accent">{formatNumber(req.tokens_input)}</td>
								<td class="text-white/[0.92]">{formatNumber(req.tokens_output)}</td>
								<td class="text-accent font-medium">{formatCost(req.cost_usd)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</svelte:boundary>
	</section>

	<!-- Footer -->
	<footer
		class="flex flex-col gap-3 py-6 border-t border-grid-line-bright text-text-tertiary text-xs sm:flex-row sm:justify-between sm:items-center"
	>
		<svelte:boundary>
			{#snippet pending()}
				<div class="flex flex-wrap gap-x-2 gap-y-1">
					<span>Cache Read: --</span>
					<span class="text-accent-dim">|</span>
					<span>Cache Write: --</span>
					<span class="text-accent-dim">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{#snippet failed()}
				<div class="flex flex-wrap gap-x-2 gap-y-1">
					<span>Cache Read: --</span>
					<span class="text-accent-dim">|</span>
					<span>Cache Write: --</span>
					<span class="text-accent-dim">|</span>
					<span>Reasoning: --</span>
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			<div class="flex flex-wrap gap-x-2 gap-y-1">
				<span>Cache Read: {formatNumber(totals.total_cache_read)}</span>
				<span class="text-accent-dim">|</span>
				<span>Cache Write: {formatNumber(totals.total_cache_write)}</span>
				<span class="text-accent-dim">|</span>
				<span>Reasoning: {formatNumber(totals.total_reasoning)}</span>
			</div>
		</svelte:boundary>
		<div class="tracking-[0.15em]">OPENCODE STATS v1.0</div>
	</footer>
</div>
