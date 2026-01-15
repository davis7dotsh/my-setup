<script lang="ts">
	import { getConversations } from '$lib/remote/conversations.remote';

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

	let conversations = $state<Conversation[] | null>(null);
	let error = $state<string | null>(null);

	function fmt(iso: string | null): string {
		if (!iso) return '-';
		const d = new Date(iso);
		return Number.isNaN(d.valueOf())
			? '-'
			: d.toLocaleString(undefined, {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
	}

	$effect(() => {
		getConversations()
			.then((result) => {
				conversations = result;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : 'Failed to load';
			});
	});
</script>

<div class="page-container">
	<header class="header">
		<div class="header-left">
			<div class="header-breadcrumb">telemetry / conversations</div>
			<h1 class="header-title">Conversation <span class="accent">History</span></h1>
			<div class="header-subtitle">Sessions grouped by OpenCode conversation (session).</div>
		</div>
	</header>

	<section class="panel">
		<h2 class="section-title">conversations</h2>
		{#if error}
			<div class="text-tertiary text-sm py-8 text-center">{error}</div>
		{:else if !conversations}
			<div class="loading-skeleton">
				<div class="skeleton-line"></div>
				<div class="skeleton-line short"></div>
			</div>
		{:else if conversations.length === 0}
			<div class="text-tertiary text-sm py-8 text-center">No sessions yet</div>
		{:else}
			<div class="table-container scrollable">
				<table>
					<thead>
						<tr>
							<th>last</th>
							<th>title</th>
							<th>requests</th>
							<th>tokens</th>
							<th>cost</th>
						</tr>
					</thead>
					<tbody>
						{#each conversations as c (c.session_id)}
							<tr>
								<td class="text-tertiary text-sm">{fmt(c.last_request_at)}</td>
								<td>
									<a
										href={`/conversations/${encodeURIComponent(c.session_id)}`}
										style="color: var(--color-accent); text-decoration: none;"
									>
										<span class="font-mono text-sm">{c.session_id.slice(0, 12)}…</span>
										<span class="text-tertiary text-sm"> — {c.title ?? '(no title yet)'}</span>
									</a>
								</td>
								<td>{c.total_requests.toLocaleString()}</td>
								<td class="text-sm"
									>{c.total_tokens_input.toLocaleString()}/{c.total_tokens_output.toLocaleString()}</td
								>
								<td class="text-sm">${c.total_cost_usd.toFixed(4)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
