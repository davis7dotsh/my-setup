# OpenCode Config

My personal OpenCode configuration, custom plugins, and stats dashboard. This repo is designed to be cloned and symlinked into `~/.config/opencode` for easy setup across machines.

## Structure

```
opencode-config/
├── config/                      # OpenCode configuration files
│   ├── opencode.json           # Main config (models, keybinds, agents)
│   ├── AGENTS.md               # Custom agent instructions
│   └── themes/                 # Custom themes
├── commands/                    # Custom slash commands
│   ├── ghostty.md
│   ├── cursor.md
│   ├── submit-change.md
│   ├── tmux.md
│   └── quick-change.md
├── plugin/                      # OpenCode plugins
│   ├── token-tracker.ts        # Tracks token usage to local SQLite DB
│   ├── db/                     # Database schema
│   ├── drizzle/                # Migrations
│   └── package.json
├── dashboard/                   # Stats dashboard (Svelte)
│   └── ...                     # View token usage over time
├── scripts/
│   ├── install.sh              # Symlink this repo to ~/.config/opencode
│   └── uninstall.sh            # Remove symlinks
└── README.md
```

## Quick Start

### First Time Setup

1. **Clone this repo:**
   ```bash
   git clone <your-repo-url> ~/opencode-config
   cd ~/opencode-config
   ```

2. **Run the installer:**
   ```bash
   ./scripts/install.sh
   ```
   
   This creates symlinks from `~/.config/opencode` to this repo, so OpenCode reads your config while keeping everything version controlled.

3. **Install plugin dependencies:**
   ```bash
   cd plugin
   bun install
   ```

4. **Restart OpenCode**

### On a New Machine

```bash
# Clone the repo
git clone <your-repo-url> ~/opencode-config

# Run install script
cd ~/opencode-config
./scripts/install.sh

# Install dependencies
cd plugin && bun install

# Done!
```

## Components

### Token Tracker Plugin

Logs every OpenCode request to a local SQLite database (`token-usage.db`). Tracks:
- Model used
- Input/output tokens
- Timestamps
- Cost estimates (if available)

The plugin runs automatically when OpenCode starts.

### Stats Dashboard

A Svelte app that visualizes your token usage over time.

**Run locally:**
```bash
cd dashboard
bun install
bun run dev
```

**Build for production:**
```bash
cd dashboard
bun run build
```

The dashboard can be hosted anywhere (Vercel, Cloudflare Pages, etc).

### Custom Commands

Slash commands for quick workflows:
- `/ghostty` - Ghostty terminal tips
- `/cursor` - Cursor integration
- `/submit-change` - Submit changes workflow
- `/tmux` - Tmux helpers
- `/quick-change` - Fast edit mode

## Future: Cloud Event Tracking

The plan is to extend the token tracker to send events to a cloud server, allowing you to:
- View stats from anywhere
- Track usage across multiple machines
- Trigger background agents remotely

### Planned Architecture

```
OpenCode Plugin → Cloud API → Database
                       ↓
                  Dashboard (hosted)
```

The `server/` directory will contain:
- Express/Bun API for event ingestion
- Authentication
- Event storage (Postgres/Turso)

The dashboard will be updated to fetch from the cloud API instead of local SQLite.

## Git Workflow

Since this repo is symlinked to `~/.config/opencode`, any changes you make in OpenCode are immediately reflected here.

```bash
# See what changed
git status

# Commit your changes
git add .
git commit -m "Update agent config"

# Push to remote
git push
```

## Uninstall

To remove the symlinks:

```bash
./scripts/uninstall.sh
```

This removes symlinks and restores any backed-up files.

## Notes

- The `.gitignore` excludes `node_modules/`, build artifacts, and database files
- The install script backs up existing files before creating symlinks
- Database files (`token-usage.db*`) are gitignored but can be backed up separately

## License

Personal use only.
