<script lang="ts">
	type LiveEvent = {
		type: string;
		createdAt?: string;
		sessionId?: string;
		// Prompt events
		prompt?: string;
		messageId?: string;
		// Tool events
		tool?: string;
		callId?: string;
		title?: string;
		success?: boolean;
		durationMs?: number;
		// File events
		filePath?: string;
		fileExtension?: string;
		operation?: string;
		linesAdded?: number;
		linesRemoved?: number;
		// Request events
		providerId?: string;
		modelId?: string;
		agent?: string;
		tokens?: {
			input: number;
			output: number;
			reasoning: number;
			cache: { read: number; write: number };
		};
		cost?: number;
		// Assistant text
		text?: string;
		[key: string]: unknown;
	};

	// Map session IDs to project names (extracted from events)
	let sessionProjects = $state<Map<string, string>>(new Map());
	let feed = $state<LiveEvent[]>([]);
	let status = $state<'connecting' | 'open' | 'closed'>('connecting');
	let filter = $state<string>('all');
	let autoScroll = $state(true);
	let feedContainer: HTMLDivElement;

	const EVENT_TYPES = {
		prompt: { label: 'Prompt', icon: '>', color: 'var(--color-accent)' },
		'tool.before': { label: 'Tool Start', icon: '+', color: 'var(--color-text-tertiary)' },
		'tool.after': { label: 'Tool Done', icon: '*', color: '#22c55e' },
		'file.edit': { label: 'File', icon: '#', color: '#f59e0b' },
		request: { label: 'LLM', icon: '@', color: '#a855f7' },
		'assistant.text': { label: 'Output', icon: '<', color: '#06b6d4' }
	} as const;

	function fmtTime(iso: unknown): string {
		if (typeof iso !== 'string') return '';
		const d = new Date(iso);
		if (Number.isNaN(d.valueOf())) return '';
		return d.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function fmtDuration(ms: number | undefined): string {
		if (ms === undefined || ms === null) return '';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function getProjectName(sessionId: string | undefined): string {
		if (!sessionId) return '';
		const project = sessionProjects.get(sessionId);
		if (project) {
			// Extract just the project folder name from path
			const parts = project.split('/');
			return parts[parts.length - 1] || project;
		}
		return sessionId.slice(0, 8);
	}

	function getEventMeta(e: LiveEvent): { label: string; icon: string; color: string } {
		return (
			EVENT_TYPES[e.type as keyof typeof EVENT_TYPES] || {
				label: e.type,
				icon: '?',
				color: 'var(--color-text-tertiary)'
			}
		);
	}

	function getFilename(path: string | undefined): string {
		if (!path) return '';
		const parts = path.split('/');
		return parts[parts.length - 1] || path;
	}

	function filteredFeed(): LiveEvent[] {
		if (filter === 'all') return feed;
		return feed.filter((e) => e.type === filter);
	}

	function handleScroll() {
		if (!feedContainer) return;
		const { scrollTop } = feedContainer;
		// If user scrolled up more than 100px from top, disable auto-scroll
		autoScroll = scrollTop < 100;
	}

	$effect(() => {
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
				feed = [parsed, ...feed].slice(0, 500);

				if (parsed.type === 'request' && parsed.sessionId) {
					const workingDir = (parsed as any).workingDir;
					if (workingDir && typeof workingDir === 'string') {
						sessionProjects.set(parsed.sessionId, workingDir);
						sessionProjects = new Map(sessionProjects);
					}
				}

				if (autoScroll && feedContainer) {
					feedContainer.scrollTop = 0;
				}
			} catch {
				// ignore
			}
		};

		return () => {
			es.close();
		};
	});
</script>

<div class="page-container live-page">
	<header class="header">
		<div class="header-left">
			<div class="header-breadcrumb">telemetry / live</div>
			<h1 class="header-title">Activity <span class="accent">Feed</span></h1>
			<div class="header-subtitle">Real-time stream of all OpenCode events</div>
		</div>
		<div class="header-right">
			<div class="status-indicator" class:connected={status === 'open'}>
				<span class="status-dot"></span>
				<span class="status-text">{status}</span>
			</div>
			<div class="event-count">
				<span class="count-value">{feed.length}</span>
				<span class="count-label">events</span>
			</div>
		</div>
	</header>

	<div class="filter-bar">
		<button class="filter-btn" class:active={filter === 'all'} onclick={() => (filter = 'all')}>
			All
		</button>
		{#each Object.entries(EVENT_TYPES) as [type, meta] (type)}
			<button
				class="filter-btn"
				class:active={filter === type}
				onclick={() => (filter = type)}
				style="--filter-color: {meta.color}"
			>
				<span class="filter-icon">{meta.icon}</span>
				{meta.label}
			</button>
		{/each}
		<div class="filter-spacer"></div>
		<label class="auto-scroll-toggle">
			<input type="checkbox" bind:checked={autoScroll} />
			<span>Auto-scroll</span>
		</label>
	</div>

	<div class="feed-container" bind:this={feedContainer} onscroll={handleScroll}>
		{#if filteredFeed().length === 0}
			<div class="empty-state">
				<div class="empty-icon">~</div>
				<div class="empty-text">Waiting for events...</div>
				<div class="empty-hint">Events will appear here as they happen</div>
			</div>
		{:else}
			{#each filteredFeed() as event, i (event.createdAt + '-' + i)}
				{@const meta = getEventMeta(event)}
				<div class="feed-item" class:new={i === 0}>
					<div class="feed-item-gutter">
						<span class="event-icon" style="color: {meta.color}">{meta.icon}</span>
						<span class="event-time">{fmtTime(event.createdAt)}</span>
					</div>

					<div class="feed-item-content">
						<div class="feed-item-header">
							<span class="event-type" style="color: {meta.color}">{meta.label}</span>
							{#if event.sessionId}
								<span class="event-project">{getProjectName(event.sessionId)}</span>
							{/if}
							{#if event.type === 'tool.after' && event.success !== undefined}
								<span
									class="event-status"
									class:success={event.success}
									class:failure={!event.success}
								>
									{event.success ? 'OK' : 'FAIL'}
								</span>
							{/if}
							{#if event.type === 'tool.after' && event.durationMs}
								<span class="event-duration">{fmtDuration(event.durationMs)}</span>
							{/if}
						</div>

						<div class="feed-item-body">
							{#if event.type === 'prompt'}
								<div class="prompt-content">{event.prompt}</div>
							{:else if event.type === 'tool.before'}
								<div class="tool-info">
									<span class="tool-name">{event.tool}</span>
								</div>
							{:else if event.type === 'tool.after'}
								<div class="tool-info">
									<span class="tool-name">{event.tool}</span>
									{#if event.title}
										<span class="tool-title">{event.title}</span>
									{/if}
								</div>
							{:else if event.type === 'file.edit'}
								<div class="file-info">
									<span
										class="file-op"
										class:read={event.operation === 'read'}
										class:write={event.operation === 'write'}
										class:edit={event.operation === 'edit'}
									>
										{event.operation}
									</span>
									<span class="file-path">{getFilename(event.filePath)}</span>
									{#if event.fileExtension}
										<span class="file-ext">.{event.fileExtension}</span>
									{/if}
									{#if event.operation !== 'read' && (event.linesAdded || event.linesRemoved)}
										<span class="file-changes">
											{#if event.linesAdded}<span class="lines-added">+{event.linesAdded}</span
												>{/if}
											{#if event.linesRemoved}<span class="lines-removed"
													>-{event.linesRemoved}</span
												>{/if}
										</span>
									{/if}
								</div>
							{:else if event.type === 'request'}
								<div class="request-info">
									<span class="model-name">{event.modelId}</span>
									{#if event.agent}
										<span class="agent-badge">{event.agent}</span>
									{/if}
									{#if event.tokens}
										<span class="token-info">
											{event.tokens.input.toLocaleString()} in / {event.tokens.output.toLocaleString()}
											out
										</span>
									{/if}
									{#if event.cost}
										<span class="cost-info">${event.cost.toFixed(4)}</span>
									{/if}
								</div>
							{:else if event.type === 'assistant.text'}
								<div class="assistant-content">
									{event.text?.slice(0, 300)}{(event.text?.length ?? 0) > 300 ? '...' : ''}
								</div>
							{:else}
								<div class="generic-content">{JSON.stringify(event).slice(0, 200)}</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.live-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		max-height: 100vh;
		overflow: hidden;
	}

	.header {
		flex-shrink: 0;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-grid-line-bright);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
	}

	.status-indicator.connected .status-dot {
		background: #22c55e;
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.status-text {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary);
	}

	.event-count {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.count-value {
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}

	.count-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary);
	}

	.filter-bar {
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-card);
		border: 1px solid var(--color-grid-line-bright);
		border-top: none;
		margin-bottom: 1rem;
	}

	.filter-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: transparent;
		border: 1px solid var(--color-grid-line-bright);
		color: var(--color-text-tertiary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-btn:hover {
		color: var(--color-text-secondary);
		border-color: var(--color-grid-line-bright);
		background: var(--color-bg-hover);
	}

	.filter-btn.active {
		color: var(--color-text-primary);
		border-color: var(--filter-color, var(--color-accent));
		background: rgba(59, 130, 246, 0.1);
	}

	.filter-icon {
		font-family: var(--font-mono);
		font-weight: bold;
	}

	.filter-spacer {
		flex: 1;
	}

	.auto-scroll-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}

	.auto-scroll-toggle input {
		accent-color: var(--color-accent);
	}

	.feed-container {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--color-bg-primary);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 400px;
		color: var(--color-text-tertiary);
	}

	.empty-icon {
		font-size: 3rem;
		font-family: var(--font-mono);
		opacity: 0.3;
		animation: pulse 2s ease-in-out infinite;
	}

	.empty-text {
		font-size: 1rem;
		margin-top: 1rem;
	}

	.empty-hint {
		font-size: 0.75rem;
		margin-top: 0.5rem;
		opacity: 0.6;
	}

	.feed-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-grid-line);
		transition: background-color 0.15s ease;
	}

	.feed-item:hover {
		background: var(--color-bg-hover);
	}

	.feed-item.new {
		animation: fade-in 0.3s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.feed-item-gutter {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 60px;
		gap: 0.25rem;
	}

	.event-icon {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: bold;
	}

	.event-time {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		color: var(--color-text-tertiary);
		font-variant-numeric: tabular-nums;
	}

	.feed-item-content {
		flex: 1;
		min-width: 0;
	}

	.feed-item-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.event-type {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.event-project {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		padding: 0.125rem 0.375rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-grid-line-bright);
		color: var(--color-text-secondary);
	}

	.event-status {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
	}

	.event-status.success {
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.event-status.failure {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.event-duration {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		color: var(--color-text-tertiary);
	}

	.feed-item-body {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.prompt-content {
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: 0.5rem;
		background: var(--color-bg-elevated);
		border-left: 2px solid var(--color-accent);
		max-height: 200px;
		overflow-y: auto;
	}

	.tool-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.tool-name {
		font-family: var(--font-mono);
		font-weight: 500;
		color: var(--color-text-primary);
	}

	.tool-title {
		color: var(--color-text-tertiary);
		font-size: 0.8rem;
	}

	.file-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.file-op {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.125rem 0.375rem;
		border: 1px solid;
	}

	.file-op.read {
		color: #06b6d4;
		border-color: rgba(6, 182, 212, 0.3);
		background: rgba(6, 182, 212, 0.1);
	}

	.file-op.write {
		color: #22c55e;
		border-color: rgba(34, 197, 94, 0.3);
		background: rgba(34, 197, 94, 0.1);
	}

	.file-op.edit {
		color: #f59e0b;
		border-color: rgba(245, 158, 11, 0.3);
		background: rgba(245, 158, 11, 0.1);
	}

	.file-path {
		font-family: var(--font-mono);
		color: var(--color-text-primary);
	}

	.file-ext {
		font-family: var(--font-mono);
		color: var(--color-text-tertiary);
	}

	.file-changes {
		display: flex;
		gap: 0.375rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.lines-added {
		color: #22c55e;
	}

	.lines-removed {
		color: #ef4444;
	}

	.request-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.model-name {
		font-family: var(--font-mono);
		color: var(--color-text-primary);
	}

	.agent-badge {
		font-size: 0.65rem;
		text-transform: uppercase;
		padding: 0.125rem 0.375rem;
		background: rgba(168, 85, 247, 0.15);
		color: #a855f7;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.token-info {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	.cost-info {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: #22c55e;
	}

	.assistant-content {
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		padding: 0.5rem;
		background: var(--color-bg-elevated);
		border-left: 2px solid #06b6d4;
		max-height: 150px;
		overflow-y: auto;
	}

	.generic-content {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Custom scrollbar */
	.feed-container::-webkit-scrollbar {
		width: 8px;
	}

	.feed-container::-webkit-scrollbar-track {
		background: var(--color-bg-primary);
	}

	.feed-container::-webkit-scrollbar-thumb {
		background: var(--color-grid-line-bright);
		border-radius: 4px;
	}

	.feed-container::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-tertiary);
	}
</style>
