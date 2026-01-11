<script lang="ts">
	import { goto } from '$app/navigation';

	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (res.ok) {
				goto('/');
			} else {
				const data = await res.json();
				error = data.error || 'Invalid password';
			}
		} catch {
			error = 'Failed to connect';
		} finally {
			loading = false;
		}
	}
</script>

<div class="login-container">
	<div class="login-card panel">
		<div class="login-header">
			<span class="header-breadcrumb">Authentication</span>
			<h1 class="login-title">OpenCode <span class="accent">Dashboard</span></h1>
		</div>

		<form onsubmit={handleSubmit} class="login-form">
			<div class="form-group">
				<label for="password" class="form-label">Password</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					class="form-input"
					placeholder="Enter password"
					autocomplete="current-password"
					disabled={loading}
				/>
			</div>

			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<button type="submit" class="submit-btn" disabled={loading || !password}>
				{loading ? 'Authenticating...' : 'Enter'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.login-card {
		width: 100%;
		max-width: 400px;
	}

	.login-header {
		margin-bottom: 2rem;
	}

	.login-title {
		font-size: 1.5rem;
		font-weight: 400;
		margin-top: 0.5rem;
	}

	.login-title .accent {
		color: var(--color-accent);
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.65rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-text-tertiary);
	}

	.form-input {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-family: var(--font-mono);
		background-color: var(--color-bg-elevated);
		border: 1px solid var(--color-grid-line-bright);
		color: var(--color-text-primary);
		outline: none;
		transition: border-color 0.15s ease;
	}

	.form-input::placeholder {
		color: var(--color-text-tertiary);
	}

	.form-input:focus {
		border-color: var(--color-accent-dim);
	}

	.form-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		font-size: 0.75rem;
		color: #ef4444;
		padding: 0.5rem;
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.submit-btn {
		padding: 0.75rem 1rem;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-primary);
		background-color: var(--color-accent);
		border: 1px solid var(--color-accent);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.submit-btn:hover:not(:disabled) {
		background-color: var(--color-accent-bright);
		border-color: var(--color-accent-bright);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
