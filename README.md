# Mineflayer mcMMO Bot

Mineflayer bot scaffold for Minecraft 1.9-family servers. It starts a configurable fleet of bots with unique offline-mode usernames, watches chat for register/login prompts, sends the configured password, and enters `/mcmmo` after login succeeds.

Only run automation on servers where you have permission to do so.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm start
```

The default target is `mc.cosmicmc.com:25565` with protocol version `1.9.4`, which is the supported Mineflayer protocol for the Minecraft 1.9 family.

## Railway

Railway runs this as a worker process with `npm start`. Set the same configuration keys in the Railway service variables.

## Configuration

Set these in `.env`:

```dotenv
BOT_HOST=mc.cosmicmc.com
BOT_PORT=25565
BOT_VERSION=1.9.4
BOT_AUTH=offline
BOT_USERNAME_PREFIX=
BOT_PASSWORD=12345!
BOT_COUNT=100
BOT_LAUNCH_INTERVAL_MS=5000
AUTO_MCMMO=true
AUTH_FALLBACK_SECONDS=10
RECONNECT=true
RECONNECT_DELAY_SECONDS=15
VERBOSE_LOGS=false
```

`BOT_USERNAME` can be set to force a specific username when `BOT_COUNT=1`. With multiple bots, it is used as the base prefix. If `BOT_USERNAME` and `BOT_USERNAME_PREFIX` are omitted, each bot gets a human-style name with numbers.

## Flow

1. Start `BOT_COUNT` bots through one staggered connection queue.
2. Wait for chat prompts.
3. Send `/register <password> <password>` if registration is requested.
4. Send `/login <password>` when registration completes or login is requested.
5. After a login success message, send `/mcmmo`.

The command queue spaces chat commands out to avoid sending multiple auth commands in the same tick.
