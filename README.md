# my-setup

OpenCode configuration and token tracking dashboard.

## Components

- **opencode/**: OpenCode config (commands, themes, plugins)
- **dashboard/**: SvelteKit app for viewing token usage stats (PostgreSQL backend)
- **setup/**: Setup script for symlinking config and configuring the token tracker

## Setup

```bash
cd setup && bun run setup
```

This will:
1. Symlink `opencode/` to `~/.config/opencode` (prompts before overwriting)
2. Ask for API URL and key for the token tracker

## Dashboard

Requires `DATABASE_URL` and `API_KEY` env vars.

```bash
cd dashboard && bun install && bun run db:push && bun run dev
```
