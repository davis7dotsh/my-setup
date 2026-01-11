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

<div class="w-full flex items-center justify-center">
{@render children()}
</div>
