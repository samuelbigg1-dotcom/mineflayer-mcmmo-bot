# Mineflayer mcMMO Bot

Mineflayer bot scaffold for Minecraft 1.8.9 through 1.9.4-family servers. It starts a configurable fleet of bots with unique offline-mode usernames, rotates protocol versions, runs a fixed register/login/mcMMO command sequence after spawn, and can reconnect disconnected bots.

Only run automation on servers where you have permission to do so.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm start
```

The default target is `mc.cosmicmc.com:25565`. By default each bot rotates through `1.8.9`, `1.9`, `1.9.1`, `1.9.2`, `1.9.3`, and `1.9.4` with Mineflayer's supported protocol mapping.

## Railway

Railway runs this as a worker process with `npm start`. Set the same configuration keys in the Railway service variables. For the current batching behavior, make sure Railway uses `BOT_BATCH_SIZE=25`, `BOT_LAUNCH_INTERVAL_MS=3000`, `JOIN_REGISTER_DELAY_MS=5000`, `AUTH_STEP_DELAY_MS=3000`, and `BOT_VERSIONS=1.8.9,1.9,1.9.1,1.9.2,1.9.3,1.9.4`.

## Configuration

Set these in `.env` or Railway service variables:

```dotenv
BOT_HOST=mc.cosmicmc.com
BOT_PORT=25565
BOT_VERSIONS=1.8.9,1.9,1.9.1,1.9.2,1.9.3,1.9.4
BOT_AUTH=offline
BOT_USERNAME_PREFIX=
BOT_PASSWORD=12345!
BOT_COUNT=100
BOT_BATCH_SIZE=25
BOT_LAUNCH_INTERVAL_MS=3000
JOIN_REGISTER_DELAY_MS=5000
AUTH_STEP_DELAY_MS=3000
AUTO_MCMMO=true
AUTH_FALLBACK_SECONDS=10
RECONNECT=true
RECONNECT_DELAY_SECONDS=15
VERBOSE_LOGS=false
```

`BOT_USERNAME` can be set to force a specific username when `BOT_COUNT=1`. With multiple bots, it is used as the base prefix. If `BOT_USERNAME` and `BOT_USERNAME_PREFIX` are omitted, each bot gets a human-style name with a slot and random suffix.

`BOT_VERSIONS` is a comma-separated rotation list. `BOT_BATCH_SIZE` controls how many bots are scheduled at the same time, and `BOT_LAUNCH_INTERVAL_MS` controls the delay between each batch.

## Flow

1. Start `BOT_COUNT` bots through a batched connection queue.
2. Join `BOT_BATCH_SIZE` bots every `BOT_LAUNCH_INTERVAL_MS` milliseconds.
3. After each bot spawns, wait `JOIN_REGISTER_DELAY_MS`, then send `/register <password> <password>`.
4. Wait `AUTH_STEP_DELAY_MS`, then send `/login <password>`.
5. Wait another `AUTH_STEP_DELAY_MS`, then send `/mcmmo` when `AUTO_MCMMO=true`.

The command queue spaces chat commands out to avoid sending multiple auth commands in the same tick.
