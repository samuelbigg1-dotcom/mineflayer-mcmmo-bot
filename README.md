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

Railway runs this as a worker process with `npm start`. Set the same keys from `.env.example` in Railway service variables.

For stress testing, the most important Railway variables are:

- `BOT_COUNT`, `BOT_BATCH_SIZE`, `BOT_LAUNCH_INTERVAL_MS`, `BOT_LAUNCH_JITTER_MS`
- `STRESS_PROFILE` (`steady`, `burst`, `wave`)
- `RECONNECT_*` controls for reconnect pressure/backoff
- `MAX_ACTIVE_BOTS`, `TEST_DURATION_SECONDS`, `STOP_ON_DURATION`
- `METRICS_INTERVAL_SECONDS` for runtime reporting cadence

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
BOT_LAUNCH_JITTER_MS=250
STRESS_PROFILE=steady
BURST_BATCH_SIZE=75
BURST_INTERVAL_MS=1000
BURST_DURATION_SECONDS=45
WAVE_MIN_BATCH_SIZE=10
WAVE_MAX_BATCH_SIZE=60
WAVE_MIN_INTERVAL_MS=800
WAVE_MAX_INTERVAL_MS=4000
WAVE_CYCLE_SECONDS=60
WAVE_PHASE_OFFSET_SECONDS=0
JOIN_REGISTER_DELAY_MS=5000
AUTH_STEP_DELAY_MS=3000
AUTO_MCMMO=true
AUTH_FALLBACK_SECONDS=10
RECONNECT=true
RECONNECT_DELAY_SECONDS=15
RECONNECT_MAX_ATTEMPTS=0
RECONNECT_BACKOFF_MULTIPLIER=1.5
RECONNECT_MAX_DELAY_SECONDS=120
MAX_ACTIVE_BOTS=0
TEST_DURATION_SECONDS=0
STOP_ON_DURATION=true
METRICS_INTERVAL_SECONDS=15
VERBOSE_LOGS=false
```

## Stress Profiles

- `steady`: constant launch pattern from `BOT_BATCH_SIZE` + `BOT_LAUNCH_INTERVAL_MS`
- `burst`: fast initial ramp using `BURST_*`, then falls back to steady values
- `wave`: sinusoidal wave that varies both batch size and interval over `WAVE_CYCLE_SECONDS`

## Flow

1. Start `BOT_COUNT` bots through a paced connection queue.
2. Use selected `STRESS_PROFILE` to compute batch size + interval at schedule time.
3. After each bot spawns, wait `JOIN_REGISTER_DELAY_MS`, then send `/register <password> <password>`.
4. Wait `AUTH_STEP_DELAY_MS`, then send `/login <password>`.
5. Wait another `AUTH_STEP_DELAY_MS`, then send `/mcmmo` when `AUTO_MCMMO=true`.
6. Apply reconnect backoff when bots disconnect and `RECONNECT=true`.
7. Emit periodic metrics snapshots including active bots, peak active, kicks, errors, and auth outcomes.

The command queue spaces chat commands out to avoid sending multiple auth commands in the same tick.
