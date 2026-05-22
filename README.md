# Mineflayer mcMMO Bot

Mineflayer bot scaffold for Minecraft 1.9-family servers. It joins with a unique offline-mode username, watches chat for register/login prompts, sends the configured password, and enters `/mcmmo` after login succeeds.

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
BOT_USERNAME_PREFIX=MCMmoBot
BOT_PASSWORD=12345!
AUTO_MCMMO=true
AUTH_FALLBACK_SECONDS=10
RECONNECT=true
```

`BOT_USERNAME` can be set to force a specific username. If omitted, the bot creates a unique username from `BOT_USERNAME_PREFIX` on every run.

## Flow

1. Connect to the server as a unique offline-mode bot.
2. Wait for chat prompts.
3. Send `/register <password> <password>` if registration is requested.
4. Send `/login <password>` when registration completes or login is requested.
5. After a login success message, send `/mcmmo`.

The command queue spaces chat commands out to avoid sending multiple auth commands in the same tick.
