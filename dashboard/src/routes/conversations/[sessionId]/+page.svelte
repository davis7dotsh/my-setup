<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getConversation } from '$lib/remote/conversations.remote';

	type ToolCall = {
		id: number;
		call_id: string;
		tool: string;
		args: unknown;
		title: string | null;
		output: string | null;
		metadata: unknown;
		started_at: string | null;
		completed_at: string | null;
	};

	type Turn = {
		id: number;
		session_id: string;
		user_message_id: string | null;
		assistant_message_id: string | null;
		prompt: string;
		assistant_text: string | null;
		agent: string | null;
		provider_id: string | null;
		model_id: string | null;
		tokens_input: number;
		tokens_output: number;
		tokens_reasoning: number;
		tokens_cache_read: number;
		tokens_cache_write: number;
		cost_usd: number;
		duration_ms: number | null;
		finish_reason: string | null;
		created_at: string | null;
		completed_at: string | null;
		tool_calls: ToolCall[];
	};

	type Conversation = {
		session_id: string;
		title: string | null;
		project_dir: string | null;
		first_request_at: string | null;
		last_request_at: string | null;
		total_requests: number;
		total_cost_usd: number;
		total_tokens_input: number;
		total_tokens_output: number;
	};

	let sessionId = $derived($page.params.sessionId ?? '');

	let data = $state<{ session: Conversation | null; turns: Turn[] } | null>(null);
	let error = $state<string | null>(null);

	function fmt(iso: string | null): string {
		if (!iso) return '-';
		const d = new Date(iso);
		return Number.isNaN(d.valueOf()) ? '-' : d.toLocaleString();
	}

	function fmtMs(ms: number | null): string {
		if (ms === null) return '-';
		if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
		return ms.toFixed(0) + 'ms';
	}

	onMount(async () => {
		try {
			data = await getConversation({ sessionId });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		}
	});
</script>

<div class="page-container">
	<header class="header">
		<div class="header-left">
			<div class="header-breadcrumb">telemetry / conversations / {sessionId}</div>
			<h1 class="header-title">Conversation <span class="accent">Details</span></h1>
			<div class="header-subtitle">Everything we’ve captured for this session.</div>
		</div>
	</header>

	{#if error}
		<section class="panel">
			<div class="text-tertiary text-sm py-8 text-center">{error}</div>
		</section>
	{:else if !data}
		<section class="panel">
			<div class="loading-skeleton">
				<div class="skeleton-line"></div>
				<div class="skeleton-line short"></div>
			</div>
		</section>
	{:else}
		<section class="stats-grid" aria-label="Conversation totals">
			<div class="panel">
				<div class="stat-value accent">${(data.session?.total_cost_usd ?? 0).toFixed(4)}</div>
				<div class="stat-label">total spent</div>
			</div>
			<div class="panel">
				<div class="stat-value accent">{(data.session?.total_requests ?? 0).toLocaleString()}</div>
				<div class="stat-label">requests</div>
			</div>
			<div class="panel">
				<div class="stat-value primary">
					{(data.session?.total_tokens_input ?? 0).toLocaleString()}
				</div>
				<div class="stat-label">input tokens</div>
			</div>
			<div class="panel">
				<div class="stat-value secondary">
					{(data.session?.total_tokens_output ?? 0).toLocaleString()}
				</div>
				<div class="stat-label">output tokens</div>
			</div>
		</section>

		<section class="panel" style="margin-bottom: 1.5rem;">
			<h2 class="section-title">session</h2>
			<div class="text-sm text-tertiary" style="font-family: var(--font-mono);">
				<div>session_id: {sessionId}</div>
				<div>title: {data.session?.title ?? '-'}</div>
				<div>project_dir: {data.session?.project_dir ?? '-'}</div>
				<div>first_seen: {fmt(data.session?.first_request_at ?? null)}</div>
				<div>last_seen: {fmt(data.session?.last_request_at ?? null)}</div>
			</div>
		</section>

		<section class="full-width-grid">
			<div class="panel">
				<h2 class="section-title">turns</h2>
				{#if data.turns.length === 0}
					<div class="text-tertiary text-sm py-8 text-center">No turns captured yet</div>
				{:else}
					{#each data.turns as t}
						<div class="panel" style="margin: 1rem 0; padding: 1rem;">
							<div class="text-tertiary text-sm" style="margin-bottom: 0.75rem;">
								<span class="font-mono">turn #{t.id}</span>
								<span class="text-accent-dim"> | </span>
								{fmt(t.created_at)}
								{#if t.completed_at}
									<span class="text-accent-dim"> → </span>
									{fmt(t.completed_at)}
								{/if}
							</div>

							<div class="text-sm" style="margin-bottom: 0.5rem;">
								<span class="text-tertiary">model:</span>
								<span class="font-mono">{t.provider_id ?? '-'} / {t.model_id ?? '-'}</span>
								<span class="text-accent-dim"> | </span>
								<span class="text-tertiary">agent:</span>
								<span class="font-mono">{t.agent ?? '-'}</span>
							</div>

							<div class="text-sm" style="margin-bottom: 0.75rem;">
								<span class="text-tertiary">tokens:</span>
								{t.tokens_input}/{t.tokens_output}
								<span class="text-accent-dim"> | </span>
								<span class="text-tertiary">cost:</span>
								${t.cost_usd.toFixed(4)}
								<span class="text-accent-dim"> | </span>
								<span class="text-tertiary">duration:</span>
								{fmtMs(t.duration_ms)}
							</div>

							<div class="text-tertiary text-sm" style="margin-bottom: 0.25rem;">prompt</div>
							<pre
								style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem; background: var(--color-bg-elevated); padding: 0.75rem; border: 1px solid var(--color-grid-line);">{t.prompt}</pre>

							<div class="text-tertiary text-sm" style="margin: 0.75rem 0 0.25rem;">
								tools ({t.tool_calls.length})
							</div>
							{#if t.tool_calls.length === 0}
								<div class="text-tertiary text-sm">-</div>
							{:else}
								<ul style="list-style: none; padding: 0; margin: 0;">
									{#each t.tool_calls as c}
										<li
											style="border: 1px solid var(--color-grid-line); background: var(--color-bg-elevated); padding: 0.5rem 0.75rem; margin-bottom: 0.5rem;"
										>
											<div class="font-mono text-sm">{c.tool} — {c.title ?? c.call_id}</div>
											{#if c.output}
												<div class="text-tertiary text-sm" style="margin-top: 0.25rem;">
													{c.output.slice(0, 300)}{c.output.length > 300 ? '…' : ''}
												</div>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}

							<div class="text-tertiary text-sm" style="margin: 0.75rem 0 0.25rem;">
								assistant output
							</div>
							{#if t.assistant_text}
								<pre
									style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem; background: var(--color-bg-elevated); padding: 0.75rem; border: 1px solid var(--color-grid-line);">{t.assistant_text}</pre>
							{:else}
								<div class="text-tertiary text-sm">(not captured yet)</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}
</div>
