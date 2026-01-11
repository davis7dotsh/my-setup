<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>OpenCode Stats</title>
	<meta name="description" content="Token usage statistics for OpenCode" />
</svelte:head>

<div>
	<nav class="top-nav">
		<a href="/" class="top-nav-link">dashboard</a>
		<a href="/live" class="top-nav-link">live</a>
		<a href="/conversations" class="top-nav-link">conversations</a>
	</nav>

	{@render children()}
</div>
