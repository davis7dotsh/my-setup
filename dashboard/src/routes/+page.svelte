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
			class="text-xs px-2 py-1 bg-transparent border border-accent-dim text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
			>Retry</button
		>
	</div>
{/snippet}

<div class="min-h-screen p-4 max-w-[1600px] mx-auto sm:p-6">
	<!-- Header -->
	<header
		class="panel panel-accent reveal flex flex-col gap-4 mb-8 p-4 overflow-hidden sm:flex-row sm:justify-between sm:items-center sm:p-6"
		style="animation-delay: 40ms;"
	>
		<div class="flex flex-col gap-2">
			<div class="text-[0.65rem] tracking-[0.32em] uppercase text-text-tertiary">
				telemetry / tokens / cost
			</div>
			<h1 class="text-3xl leading-[0.95] sm:text-4xl">
				OpenCode <span class="text-accent">Observatory</span>
			</h1>
			<div class="text-xs text-text-secondary max-w-[72ch]">
				A tiny instrument panel for OpenCode’s LLM usage.
			</div>
		</div>

		<div class="flex items-center justify-between gap-4 sm:gap-6">
			<div class="flex flex-col items-end">
				<div class="text-[0.65rem] tracking-[0.32em] uppercase text-text-tertiary">local time</div>
				<div class="text-lg text-text-secondary tabular-nums sm:text-2xl">{currentTime}</div>
			</div>
			<button onclick={refreshAll} class="btn">
				<span class="text-base">↻</span> <span class="hidden xs:inline">refresh</span>
			</button>
		</div>
	</header>

	<!-- Main Stats Row -->
	<section
		class="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4"
		aria-label="Top-level totals"
	>
		<svelte:boundary>
			{#snippet pending()}
				<div class="panel reveal p-4 sm:p-6" style="animation-delay: 80ms;">
					<div class="text-2xl sm:text-4xl font-bold text-accent leading-none animate-pulse-custom">
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">total spent</div>
				</div>
				<div class="panel reveal p-4 sm:p-6" style="animation-delay: 110ms;">
					<div class="text-2xl sm:text-4xl font-bold text-accent leading-none animate-pulse-custom">
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">
						total requests
					</div>
				</div>
				<div class="panel reveal p-4 sm:p-6" style="animation-delay: 140ms;">
					<div
						class="text-2xl sm:text-4xl font-bold text-text-primary leading-none animate-pulse-custom"
					>
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">input tokens</div>
					<div class="mt-2 text-[0.65rem] text-text-tertiary uppercase tracking-[0.18em]">
						cached --
					</div>
				</div>
				<div class="panel reveal p-4 sm:p-6" style="animation-delay: 170ms;">
					<div
						class="text-2xl sm:text-4xl font-bold text-text-secondary leading-none animate-pulse-custom"
					>
						--
					</div>
					<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">output tokens</div>
				</div>
			{/snippet}
			{#snippet failed(error, retry)}
				<div class="panel p-4 sm:p-6 flex items-center justify-center">
					{@render errorState(error, retry)}
				</div>
			{/snippet}
			{@const totals = await getTotals()}
			{@const totalPrompt = totals.total_input + totals.total_cache_read}
			<div class="panel panel-accent reveal p-4 sm:p-6" style="animation-delay: 80ms;">
				<div class="text-2xl sm:text-4xl font-bold text-accent leading-none">
					{formatCost(totals.total_cost)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">total spent</div>
				<div
					class="absolute -bottom-7 -right-8 w-[140px] h-[140px] bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_65%)] pointer-events-none"
				></div>
			</div>
			<div class="panel reveal p-4 sm:p-6" style="animation-delay: 110ms;">
				<div class="text-2xl sm:text-4xl font-bold text-accent leading-none">
					{formatNumber(totals.total_requests)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">total requests</div>
			</div>
			<div class="panel reveal p-4 sm:p-6" style="animation-delay: 140ms;">
				<div class="text-2xl sm:text-4xl font-bold text-text-primary leading-none">
					{formatNumber(totals.total_input)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">input tokens</div>
				<div class="mt-2 text-[0.65rem] text-text-tertiary uppercase tracking-[0.18em]">
					cached <span class="text-accent">{formatNumber(totals.total_cache_read)}</span>
					<span class="text-text-tertiary">
						({formatPercent(totals.total_cache_read, totalPrompt)})</span
					>
				</div>
			</div>
			<div class="panel reveal p-4 sm:p-6" style="animation-delay: 170ms;">
				<div class="text-2xl sm:text-4xl font-bold text-text-secondary leading-none">
					{formatNumber(totals.total_output)}
				</div>
				<div class="text-xs text-text-tertiary uppercase tracking-widest mt-2">output tokens</div>
			</div>
		</svelte:boundary>
	</section>

	<!-- Charts Row 1 -->
	<section class="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-[2fr_1fr]">
		<div class="panel reveal p-4 sm:p-6" style="animation-delay: 210ms;">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				cost over time
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
				<AreaChart
					data={costTimeData}
					height={220}
					color="var(--color-accent)"
					gradientId="costGrad"
				/>
			</svelte:boundary>
		</div>
		<div class="panel reveal p-4 sm:p-6" style="animation-delay: 240ms;">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				cost by model
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
		<div class="panel reveal p-4 sm:p-6" style="animation-delay: 270ms;">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				token flow
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
		<div class="panel reveal p-4 sm:p-6" style="animation-delay: 300ms;">
			<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
				cost by agent
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
				<BarChart data={agentCostData} height={220} color="var(--color-accent)" horizontal={true} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Tokens explorer -->
	<section class="grid grid-cols-1 gap-4 mb-6">
		<div class="panel reveal p-4 w-full sm:p-6" style="animation-delay: 330ms;">
			<svelte:boundary>
				{#snippet pending()}
					<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
						tokens explorer
					</h2>
					{@render loadingState()}
				{/snippet}
				{#snippet failed(error, retry)}
					<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
						tokens explorer
					</h2>
					{@render errorState(error, retry)}
				{/snippet}
				{@const tokensData = await getTokensData()}
				<TokensZoomChart hourly={tokensData.hourly} daily={tokensData.daily} height={220} />
			</svelte:boundary>
		</div>
	</section>

	<!-- Model Performance Table -->
	<section class="panel reveal p-4 mb-6 sm:p-6" style="animation-delay: 360ms;">
		<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
			model performance
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
									<span
										class="inline-block bg-transparent border border-accent-dim text-text-secondary px-1.5 py-0.5 text-[0.65rem] mr-2 uppercase"
										>{model.provider_id}</span
									>
									{getModelShortName(model.model_id)}
								</td>
								<td>{model.request_count.toLocaleString()}</td>
								<td class="text-accent">{formatNumber(model.tokens_input)}</td>
								<td class="text-text-primary">{formatNumber(model.tokens_output)}</td>
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
	<section class="panel reveal p-4 mb-6 sm:p-6" style="animation-delay: 390ms;">
		<h2 class="mb-4 text-xs font-medium text-text-secondary uppercase tracking-[0.15em]">
			recent activity
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
								<td class="text-text-primary">{formatNumber(req.tokens_output)}</td>
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
		class="reveal flex flex-col gap-3 py-6 border-t border-grid-line-bright text-text-tertiary text-xs sm:flex-row sm:justify-between sm:items-center"
		style="animation-delay: 420ms;"
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
		<div class="tracking-[0.18em] uppercase">OpenCode Stats v1.0</div>
	</footer>
</div>
