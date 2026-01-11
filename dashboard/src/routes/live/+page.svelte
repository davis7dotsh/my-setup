<script lang="ts">
	import { onMount } from 'svelte';
	import { getRecentTurns } from '$lib/remote/conversations.remote';

	type RecentTurn = {
		id: number;
		session_id: string;
		prompt: string;
		assistant_text: string | null;
		agent: string | null;
		provider_id: string | null;
		model_id: string | null;
		tokens_input: number;
		tokens_output: number;
		cost_usd: number;
		created_at: string | null;
		completed_at: string | null;
	};

	type LiveEvent = {
		type: string;
		createdAt?: string;
		[key: string]: unknown;
	};

	let recentTurns = $state<RecentTurn[] | null>(null);
	let recentTurnsError = $state<string | null>(null);
	let feed = $state<LiveEvent[]>([]);
	let status = $state<'connecting' | 'open' | 'closed'>('connecting');

	function fmtTime(iso: unknown): string {
		if (typeof iso !== 'string') return '';
		const d = new Date(iso);
		return Number.isNaN(d.valueOf()) ? '' : d.toLocaleTimeString();
	}

	function clip(text: string, max = 220): string {
		if (text.length <= max) return text;
		return text.slice(0, max) + '…';
	}

	onMount(() => {
		(async () => {
			try {
				recentTurns = await getRecentTurns();
			} catch (e) {
				recentTurnsError = e instanceof Error ? e.message : 'Failed to load';
			}
		})();

		const es = new EventSource('/api/live');
		es.onopen = () => {
			status = 'open';
		};
		es.onerror = () => {
			status = 'closed';
		};
		es.onmessage = (m) => {
			try {
				const parsed = JSON.parse(m.data) as LiveEvent;
				feed = [parsed, ...feed].slice(0, 250);
			} catch {
				// ignore
			}
		};

		return () => {
			es.close();
		};
	});
</script>

<div class="page-container">
	<header class="header">
		<div class="header-left">
			<div class="header-breadcrumb">telemetry / live</div>
			<h1 class="header-title">Live <span class="accent">Feed</span></h1>
			<div class="header-subtitle">Streaming prompt/tool/output events as they arrive.</div>
		</div>
		<div class="header-right">
			<div class="time-display">
				<div class="time-label">status</div>
				<div class="time-value">{status}</div>
			</div>
		</div>
	</header>

	<section class="charts-grid">
		<div class="panel">
			<h2 class="section-title">recent turns</h2>
			{#if recentTurnsError}
				<div class="text-tertiary text-sm py-8 text-center">{recentTurnsError}</div>
			{:else if !recentTurns}
				<div class="loading-skeleton">
					<div class="skeleton-line"></div>
					<div class="skeleton-line short"></div>
				</div>
			{:else if recentTurns.length === 0}
				<div class="text-tertiary text-sm py-8 text-center">No turns yet</div>
			{:else}
				<div class="table-container scrollable">
					<table>
						<thead>
							<tr>
								<th>time</th>
								<th>session</th>
								<th>prompt</th>
								<th>output</th>
								<th>tokens</th>
								<th>cost</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTurns as t}
								<tr>
									<td class="text-tertiary text-sm">{fmtTime(t.created_at)}</td>
									<td class="font-mono text-sm">
										<a
											href={`/conversations/${encodeURIComponent(t.session_id)}`}
											style="color: var(--color-accent); text-decoration: none;"
										>
											{t.session_id.slice(0, 10)}…
										</a>
									</td>
									<td class="text-sm">{clip(t.prompt)}</td>
									<td class="text-sm text-tertiary"
										>{t.assistant_text ? clip(t.assistant_text) : '-'}</td
									>
									<td class="text-sm">{t.tokens_input}/{t.tokens_output}</td>
									<td class="text-sm">${t.cost_usd.toFixed(4)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="panel">
			<h2 class="section-title">live events</h2>
			{#if feed.length === 0}
				<div class="text-tertiary text-sm py-8 text-center">Waiting for events…</div>
			{:else}
				<div class="table-container scrollable">
					<table>
						<thead>
							<tr>
								<th>time</th>
								<th>type</th>
								<th>details</th>
							</tr>
						</thead>
						<tbody>
							{#each feed as e}
								<tr>
									<td class="text-tertiary text-sm">{fmtTime(e.createdAt)}</td>
									<td class="font-mono text-sm">{e.type}</td>
									<td class="text-sm text-tertiary">
										{#if e.type === 'prompt' && typeof e.prompt === 'string'}
											{clip(e.prompt)}
										{:else if e.type === 'assistant.text' && typeof e.text === 'string'}
											{clip(e.text)}
										{:else if e.type === 'tool.after' && typeof e.title === 'string'}
											{e.title}
										{:else if e.type === 'tool.before' && typeof e.tool === 'string'}
											{e.tool}
										{:else}
											-
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>
</div>
