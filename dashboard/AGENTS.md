# Dashboard Project Rules

## Package Manager

Always use **bun** as the package manager and command runner.

## Available Scripts

- `bun run check` - Type check the project
- `bun run format` - Format code

## Bun APIs

Prefer Bun APIs over Node.js equivalents when available (file I/O, hashing, etc.).

## Data Fetching & Mutation

Use **remote functions** from `$lib/remote/*.remote.ts` to fetch and mutate data. These use SvelteKit's `query` API for server-side data loading.

## Styling

Use **Tailwind CSS** for all styling. Do not use inline styles or separate CSS files for component styles.

## Svelte 5 Features

Use modern Svelte 5 features:

- `$state` for reactive state
- `$derived` for computed values
- `$effect` for side effects
- `$props` for component props
- `$bindable` for two-way binding props
- Snippets over slots when appropriate
