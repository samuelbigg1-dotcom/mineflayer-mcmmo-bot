require('dotenv').config();

const mineflayer = require('mineflayer');

const DEFAULT_PASSWORD = '12345!';
const COMMAND_DELAY_MS = 1600;

const config = {
  host: process.env.BOT_HOST || 'mc.cosmicmc.com',
  port: intFromEnv('BOT_PORT', 25565),
  version: process.env.BOT_VERSION || '1.9.4',
  auth: process.env.BOT_AUTH || 'offline',
  username: process.env.BOT_USERNAME || makeUniqueUsername(process.env.BOT_USERNAME_PREFIX || 'MCMmoBot'),
  password: process.env.BOT_PASSWORD || DEFAULT_PASSWORD,
  autoMcmmo: boolFromEnv('AUTO_MCMMO', boolFromEnv('AUTO_MCMO', true)),
  authFallbackSeconds: intFromEnv('AUTH_FALLBACK_SECONDS', 10),
  reconnect: boolFromEnv('RECONNECT', true),
  reconnectDelaySeconds: intFromEnv('RECONNECT_DELAY_SECONDS', 60)
};

let bot;
let commandReadyAt = 0;
let authFallbackTimer;
let reconnectTimer;
let lastKickReason = '';

const state = {
  registered: false,
  loginSent: false,
  registerSent: false,
  authenticated: false,
  mcmmoSent: false
};

function main() {
  connect();
}

function connect() {
  clearTimeout(reconnectTimer);
  resetState();

  console.log(`[bot] Connecting ${config.username} to ${config.host}:${config.port} on ${config.version}`);

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth
  });

  bot.once('spawn', () => {
    console.log('[bot] Spawned. Waiting for register/login chat prompt.');
    scheduleAuthFallback();
  });

  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    if (!text.trim()) return;

    console.log(`[chat] ${text}`);
    handleChat(text);
  });

  bot.on('kicked', (reason) => {
    lastKickReason = stringifyReason(reason);
    console.log(`[bot] Kicked: ${lastKickReason}`);
  });

  bot.on('error', (err) => {
    console.error(`[bot] Error: ${err.message}`);
  });

  bot.on('end', () => {
    clearTimeout(authFallbackTimer);
    console.log('[bot] Disconnected.');

    if (config.reconnect) {
      const delaySeconds = getReconnectDelaySeconds();
      reconnectTimer = setTimeout(connect, delaySeconds * 1000);
      console.log(`[bot] Reconnect scheduled in ${delaySeconds} seconds.`);
    }
  });
}

function getReconnectDelaySeconds() {
  if (/vpn|proxy/i.test(lastKickReason)) {
    return Math.max(config.reconnectDelaySeconds, 300);
  }

  return config.reconnectDelaySeconds;
}

function handleChat(rawText) {
  const text = normalize(rawText);

  if (isRegisterPrompt(text)) {
    sendRegister('server requested registration');
    return;
  }

  if (isRegisteredNotice(text)) {
    state.registered = true;
    sendLogin('registration completed');
    return;
  }

  if (isLoginPrompt(text)) {
    sendLogin('server requested login');
    return;
  }

  if (isAuthSuccess(text)) {
    markAuthenticated('server confirmed login');
    return;
  }

  if (isAuthFailure(text)) {
    console.log('[auth] Server reported an authentication failure. Check BOT_PASSWORD or use a fresh username.');
  }
}

function sendRegister(reason) {
  if (state.registerSent || state.authenticated) return;

  state.registerSent = true;
  queueCommand(`/register ${config.password} ${config.password}`, '/register <password> <password>', reason);
}

function sendLogin(reason) {
  if (state.loginSent || state.authenticated) return;

  state.loginSent = true;
  queueCommand(`/login ${config.password}`, '/login <password>', reason);
}

function markAuthenticated(reason) {
  if (state.authenticated) return;

  clearTimeout(authFallbackTimer);
  state.authenticated = true;
  console.log(`[auth] Authenticated: ${reason}`);

  if (config.autoMcmmo && !state.mcmmoSent) {
    state.mcmmoSent = true;
    queueCommand('/mcmmo', '/mcmmo', 'entering mcMMO lobby');
  }
}

function queueCommand(command, redactedCommand, reason) {
  const delay = Math.max(0, commandReadyAt - Date.now());
  commandReadyAt = Date.now() + delay + COMMAND_DELAY_MS;

  console.log(`[cmd] ${redactedCommand} queued: ${reason}`);

  setTimeout(() => {
    if (!bot || !bot.player) {
      console.log(`[cmd] ${redactedCommand} skipped: bot is not in game`);
      return;
    }

    bot.chat(command);
    console.log(`[cmd] ${redactedCommand} sent`);
  }, delay);
}

function scheduleAuthFallback() {
  clearTimeout(authFallbackTimer);

  if (config.authFallbackSeconds <= 0) return;

  authFallbackTimer = setTimeout(() => {
    if (state.authenticated || state.loginSent || state.registerSent) return;

    console.log('[auth] No prompt detected; trying login fallback once.');
    sendLogin('fallback after no prompt');
  }, config.authFallbackSeconds * 1000);
}

function resetState() {
  commandReadyAt = 0;
  lastKickReason = '';
  state.registered = false;
  state.loginSent = false;
  state.registerSent = false;
  state.authenticated = false;
  state.mcmmoSent = false;
}

function isRegisterPrompt(text) {
  return (
    /\/register/.test(text) ||
    /please register/.test(text) ||
    /not registered/.test(text) ||
    /register with/.test(text)
  );
}

function isRegisteredNotice(text) {
  return (
    /successfully registered/.test(text) ||
    /registered successfully/.test(text) ||
    /registration complete/.test(text) ||
    /you are now registered/.test(text)
  );
}

function isLoginPrompt(text) {
  return (
    /\/login/.test(text) ||
    /please login/.test(text) ||
    /please log in/.test(text) ||
    /already registered/.test(text) ||
    /login with/.test(text)
  );
}

function isAuthSuccess(text) {
  return (
    /successfully logged in/.test(text) ||
    /logged in successfully/.test(text) ||
    /login successful/.test(text) ||
    /you are now logged in/.test(text) ||
    /authenticated/.test(text)
  );
}

function isAuthFailure(text) {
  return (
    /wrong password/.test(text) ||
    /incorrect password/.test(text) ||
    /invalid password/.test(text) ||
    /login failed/.test(text)
  );
}

function normalize(value) {
  return value
    .replace(/\u00a7[0-9a-fk-or]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function makeUniqueUsername(prefix) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 8) || 'MCMmoBot';
  const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  return `${cleanPrefix}${suffix}`.slice(0, 16);
}

function boolFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

function stringifyReason(reason) {
  if (typeof reason === 'string') return reason;

  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

main();
