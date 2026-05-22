require('dotenv').config();

const mineflayer = require('mineflayer');

const DEFAULT_PASSWORD = '12345!';
const COMMAND_DELAY_MS = 1600;
const DEFAULT_VERSIONS = ['1.8.9', '1.9', '1.9.1', '1.9.2', '1.9.3', '1.9.4'];
const DEFAULT_STRESS_PROFILE = 'steady';
const HUMAN_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Cameron',
  'Drew', 'Logan', 'Parker', 'Avery', 'Quinn', 'Reese', 'Skyler', 'Hayden',
  'Mason', 'Blake', 'Noah', 'Evan', 'Liam', 'Owen', 'Eli', 'Nolan',
  'Wyatt', 'Caleb', 'Lucas', 'Miles', 'Rowan', 'Finn', 'Arden', 'Emery',
  'Harper', 'Sawyer', 'Dakota', 'Kendall', 'Sage', 'River', 'Phoenix', 'Kai',
  'Remy', 'Tatum', 'Ari', 'Jules', 'Ellis', 'Shawn', 'Micah', 'Devon',
  'Kieran', 'Lane', 'Robin', 'Sidney', 'Terry', 'Marley', 'Kody', 'Toby',
  'Bryce', 'Cole', 'Grant', 'Jesse', 'Reid', 'Tanner', 'Weston', 'Zane',
  'Ashton', 'Brett', 'Corey', 'Dylan', 'Gavin', 'Hudson', 'Jonah', 'Keaton',
  'Luca', 'Maddox', 'Orion', 'Porter', 'Ryder', 'Silas', 'Tristan', 'Wade',
  'Briar', 'Cedar', 'Flint', 'Hollis', 'Indigo', 'Jaden', 'Lennox', 'Marlow',
  'Oakley', 'Peyton', 'Rory', 'Sterling', 'Vaughn', 'Wren', 'Yarden', 'Zephyr'
];

const config = {
  host: process.env.BOT_HOST || 'mc.cosmicmc.com',
  port: intFromEnv('BOT_PORT', 25565),
  versions: versionsFromEnv(),
  auth: process.env.BOT_AUTH || 'offline',
  username: process.env.BOT_USERNAME || '',
  usernamePrefix: process.env.BOT_USERNAME_PREFIX || '',
  password: process.env.BOT_PASSWORD || DEFAULT_PASSWORD,
  botCount: Math.max(1, intFromEnv('BOT_COUNT', 10800)),
  botBatchSize: Math.max(1, intFromEnv('BOT_BATCH_SIZE', 25)),
  launchIntervalMs: Math.max(0, intFromEnv('BOT_LAUNCH_INTERVAL_MS', 3000)),
  botLaunchJitterMs: Math.max(0, intFromEnv('BOT_LAUNCH_JITTER_MS', 0)),
  joinRegisterDelayMs: Math.max(0, intFromEnv('JOIN_REGISTER_DELAY_MS', 5000)),
  authStepDelayMs: Math.max(0, intFromEnv('AUTH_STEP_DELAY_MS', 3000)),
  autoMcmmo: boolFromEnv('AUTO_MCMMO', boolFromEnv('AUTO_MCMO', true)),
  authFallbackSeconds: Math.max(0, intFromEnv('AUTH_FALLBACK_SECONDS', 10)),
  reconnect: boolFromEnv('RECONNECT', true),
  reconnectDelaySeconds: Math.max(1, intFromEnv('RECONNECT_DELAY_SECONDS', 15)),
  reconnectMaxAttempts: Math.max(0, intFromEnv('RECONNECT_MAX_ATTEMPTS', 0)),
  reconnectBackoffMultiplier: Math.max(1, floatFromEnv('RECONNECT_BACKOFF_MULTIPLIER', 1.5)),
  reconnectMaxDelaySeconds: Math.max(1, intFromEnv('RECONNECT_MAX_DELAY_SECONDS', 120)),
  stressProfile: stressProfileFromEnv(),
  burstBatchSize: Math.max(1, intFromEnv('BURST_BATCH_SIZE', Math.max(1, intFromEnv('BOT_BATCH_SIZE', 25) * 2))),
  burstIntervalMs: Math.max(100, intFromEnv('BURST_INTERVAL_MS', Math.max(250, Math.floor(intFromEnv('BOT_LAUNCH_INTERVAL_MS', 3000) / 2)))),
  burstDurationSeconds: Math.max(1, intFromEnv('BURST_DURATION_SECONDS', 45)),
  waveMinBatchSize: Math.max(1, intFromEnv('WAVE_MIN_BATCH_SIZE', Math.max(1, Math.floor(intFromEnv('BOT_BATCH_SIZE', 25) / 2)))),
  waveMaxBatchSize: Math.max(1, intFromEnv('WAVE_MAX_BATCH_SIZE', Math.max(2, intFromEnv('BOT_BATCH_SIZE', 25) * 2))),
  waveMinIntervalMs: Math.max(100, intFromEnv('WAVE_MIN_INTERVAL_MS', Math.max(250, Math.floor(intFromEnv('BOT_LAUNCH_INTERVAL_MS', 3000) / 2)))),
  waveMaxIntervalMs: Math.max(100, intFromEnv('WAVE_MAX_INTERVAL_MS', Math.max(500, intFromEnv('BOT_LAUNCH_INTERVAL_MS', 3000) * 2))),
  waveCycleSeconds: Math.max(5, intFromEnv('WAVE_CYCLE_SECONDS', 60)),
  wavePhaseOffsetSeconds: Math.max(0, intFromEnv('WAVE_PHASE_OFFSET_SECONDS', 0)),
  metricsIntervalSeconds: Math.max(0, intFromEnv('METRICS_INTERVAL_SECONDS', 15)),
  testDurationSeconds: Math.max(0, intFromEnv('TEST_DURATION_SECONDS', 0)),
  stopOnDuration: boolFromEnv('STOP_ON_DURATION', true),
  maxActiveBots: Math.max(0, intFromEnv('MAX_ACTIVE_BOTS', 0)),
  verboseLogs: boolFromEnv('VERBOSE_LOGS', false)
};

if (config.waveMinBatchSize > config.waveMaxBatchSize) {
  const swap = config.waveMinBatchSize;
  config.waveMinBatchSize = config.waveMaxBatchSize;
  config.waveMaxBatchSize = swap;
}

if (config.waveMinIntervalMs > config.waveMaxIntervalMs) {
  const swap = config.waveMinIntervalMs;
  config.waveMinIntervalMs = config.waveMaxIntervalMs;
  config.waveMaxIntervalMs = swap;
}

const originalConsoleError = console.error.bind(console);

console.error = (...args) => {
  if (config.verboseLogs) {
    originalConsoleError(...args);
    return;
  }

  const text = args.map(formatLogArg).join(' ');
  if (/^\s+at\s/.test(text)) return;
  if (/^\s*(errno|code|syscall):/.test(text)) return;

  originalConsoleError(text);
};

const runners = [];
const launchQueue = createConnectQueue('launch');
const reconnectQueue = createConnectQueue('reconnect');
const metrics = createMetrics();

const fleetStartedAt = Date.now();
let allowLaunches = true;
let allowReconnects = true;
let isStopping = false;
let metricsTimer;

function main() {
  console.log(
    `[fleet] host=${config.host}:${config.port}; bots=${config.botCount}; profile=${config.stressProfile}; batch=${config.botBatchSize}; interval=${config.launchIntervalMs}ms; jitter=${config.botLaunchJitterMs}ms`
  );

  if (config.maxActiveBots > 0) {
    console.log(`[fleet] active bot cap=${config.maxActiveBots}`);
  }

  if (config.testDurationSeconds > 0) {
    console.log(`[fleet] test duration=${config.testDurationSeconds}s stopOnDuration=${config.stopOnDuration}`);
    setTimeout(() => {
      stopFleet(`test duration reached (${config.testDurationSeconds}s)`, config.stopOnDuration);
    }, config.testDurationSeconds * 1000);
  }

  startMetricsReporter();

  for (let index = 0; index < config.botCount; index += 1) {
    const runner = createBotRunner(index + 1);
    runners.push(runner);
    scheduleConnect(runner, 0, 'launch');
  }
}

function createMetrics() {
  return {
    launchScheduled: 0,
    reconnectScheduled: 0,
    connectAttempts: 0,
    spawnCount: 0,
    activeBots: 0,
    peakActiveBots: 0,
    authSuccess: 0,
    authFailures: 0,
    kicks: Object.create(null),
    errors: Object.create(null)
  };
}

function createConnectQueue(name) {
  return {
    name,
    nextAt: 0,
    usedInBatch: 0
  };
}

function scheduleConnect(runner, delayMs, queueName) {
  if (queueName === 'launch' && !allowLaunches) return null;
  if (queueName === 'reconnect' && !allowReconnects) return null;

  const now = Date.now();
  const earliest = now + Math.max(0, delayMs);
  const queue = queueName === 'reconnect' ? reconnectQueue : launchQueue;
  const schedule = getSchedulingProfile(queueName, now);

  if (queue.nextAt < now) {
    queue.nextAt = now;
    queue.usedInBatch = 0;
  }

  if (queue.nextAt < earliest) {
    queue.nextAt = earliest;
    queue.usedInBatch = 0;
  }

  const jitter = schedule.jitterMs > 0 ? randomInt(0, schedule.jitterMs) : 0;
  const scheduledAt = queue.nextAt + jitter;

  queue.usedInBatch += 1;
  if (queue.usedInBatch >= schedule.batchSize) {
    queue.nextAt += schedule.intervalMs;
    queue.usedInBatch = 0;
  }

  const timer = setTimeout(() => {
    runner.connect(queueName);
  }, Math.max(0, scheduledAt - now));

  runner.setPendingConnectTimer(timer);

  if (queueName === 'launch') {
    metrics.launchScheduled += 1;
  } else {
    metrics.reconnectScheduled += 1;
  }

  return {
    delaySeconds: Math.ceil((scheduledAt - now) / 1000),
    timer,
    batchSize: schedule.batchSize,
    intervalMs: schedule.intervalMs
  };
}

function getSchedulingProfile(queueName, now) {
  const jitterMs = config.botLaunchJitterMs;

  if (queueName === 'reconnect') {
    return {
      batchSize: Math.max(1, Math.floor(config.botBatchSize / 2)),
      intervalMs: Math.max(500, config.launchIntervalMs),
      jitterMs
    };
  }

  if (config.stressProfile === 'burst') {
    const elapsedSeconds = (now - fleetStartedAt) / 1000;
    const inBurstWindow = elapsedSeconds <= config.burstDurationSeconds;

    return {
      batchSize: inBurstWindow ? config.burstBatchSize : config.botBatchSize,
      intervalMs: inBurstWindow ? config.burstIntervalMs : config.launchIntervalMs,
      jitterMs
    };
  }

  if (config.stressProfile === 'wave') {
    const elapsedSeconds = (now - fleetStartedAt) / 1000;
    const phase = ((elapsedSeconds + config.wavePhaseOffsetSeconds) % config.waveCycleSeconds) / config.waveCycleSeconds;
    const level = (Math.sin(phase * Math.PI * 2) + 1) / 2;

    return {
      batchSize: Math.max(1, Math.round(lerp(config.waveMinBatchSize, config.waveMaxBatchSize, level))),
      intervalMs: Math.max(100, Math.round(lerp(config.waveMaxIntervalMs, config.waveMinIntervalMs, level))),
      jitterMs
    };
  }

  return {
    batchSize: config.botBatchSize,
    intervalMs: config.launchIntervalMs,
    jitterMs
  };
}

function stopFleet(reason, disconnectBots) {
  if (isStopping) return;

  isStopping = true;
  allowLaunches = false;
  allowReconnects = false;

  console.log(`[fleet] stopping: ${reason}`);

  for (const runner of runners) {
    runner.clearPendingConnectTimer();

    if (disconnectBots) {
      runner.stop();
    }
  }

  setTimeout(() => {
    logMetrics(true);
    if (disconnectBots) {
      process.exit(0);
    }
  }, 1500);
}

function startMetricsReporter() {
  if (config.metricsIntervalSeconds <= 0) return;

  metricsTimer = setInterval(() => {
    logMetrics(false);
  }, config.metricsIntervalSeconds * 1000);

  if (typeof metricsTimer.unref === 'function') {
    metricsTimer.unref();
  }
}

function logMetrics(isFinal) {
  const uptimeSeconds = Math.max(1, Math.floor((Date.now() - fleetStartedAt) / 1000));
  const attemptsPerSecond = (metrics.connectAttempts / uptimeSeconds).toFixed(2);
  const topKick = topStat(metrics.kicks);
  const topError = topStat(metrics.errors);
  const prefix = isFinal ? '[metrics final]' : '[metrics]';

  console.log(
    `${prefix} up=${uptimeSeconds}s active=${metrics.activeBots} peak=${metrics.peakActiveBots} attempts=${metrics.connectAttempts} aps=${attemptsPerSecond} spawned=${metrics.spawnCount} authOk=${metrics.authSuccess} authFail=${metrics.authFailures} launches=${metrics.launchScheduled} reconnects=${metrics.reconnectScheduled} kickTop=${topKick} errTop=${topError}`
  );
}

function topStat(table) {
  let bestKey = 'none';
  let bestValue = 0;

  for (const [key, value] of Object.entries(table)) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }

  return `${bestKey}:${bestValue}`;
}

function createBotRunner(slot) {
  const label = `bot-${slot}`;
  const username = makeBotUsername(slot);
  const botVersion = pickBotVersion(slot);

  let bot;
  let pendingConnectTimer;
  let commandReadyAt = 0;
  let authFallbackTimer;
  let reconnectTimer;
  let authSequenceTimers = [];

  const state = {
    registered: false,
    loginSent: false,
    registerSent: false,
    authenticated: false,
    mcmmoSent: false,
    isOnline: false,
    reconnectAttempts: 0
  };

  function connect(queueName = 'launch') {
    clearPendingConnectTimer();

    if (isStopping) return;

    if (config.maxActiveBots > 0 && metrics.activeBots >= config.maxActiveBots) {
      const retry = scheduleConnect(api, Math.max(500, config.launchIntervalMs), queueName);
      if (retry && config.verboseLogs) {
        console.log(`[${label}] delayed by active cap; retry ${retry.delaySeconds}s`);
      }
      return;
    }

    clearTimeout(reconnectTimer);
    resetState();
    metrics.connectAttempts += 1;

    console.log(`[${label}] connect ${username} ${botVersion}`);

    bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username,
      version: botVersion,
      auth: config.auth
    });

    bot.once('spawn', () => {
      state.reconnectAttempts = 0;
      state.isOnline = true;
      metrics.spawnCount += 1;
      metrics.activeBots += 1;
      metrics.peakActiveBots = Math.max(metrics.peakActiveBots, metrics.activeBots);

      console.log(`[${label}] spawned`);
      scheduleAuthSequence();
      scheduleAuthFallback();
    });

    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (!text.trim()) return;

      if (config.verboseLogs) {
        console.log(`[${label} chat] ${text}`);
      }

      handleChat(text);
    });

    bot.on('kicked', (reason) => {
      const kick = summarizeKick(stringifyReason(reason));
      incrementMetric(metrics.kicks, kick);
      console.log(`[${label}] kicked ${kick}`);
    });

    bot.on('error', (err) => {
      const error = summarizeError(err);
      incrementMetric(metrics.errors, error);
      console.log(`[${label}] error ${error}`);
    });

    bot.on('end', () => {
      clearTimeout(authFallbackTimer);
      clearAuthSequenceTimers();

      if (state.isOnline) {
        state.isOnline = false;
        metrics.activeBots = Math.max(0, metrics.activeBots - 1);
      }

      if (config.reconnect && allowReconnects) {
        const nextAttempt = state.reconnectAttempts + 1;
        const blockedByAttemptCap = config.reconnectMaxAttempts > 0 && nextAttempt > config.reconnectMaxAttempts;

        if (blockedByAttemptCap) {
          console.log(`[${label}] reconnect cap reached`);
          return;
        }

        state.reconnectAttempts = nextAttempt;
        const reconnectDelaySeconds = calculateReconnectDelaySeconds(nextAttempt);
        const scheduled = scheduleConnect(api, reconnectDelaySeconds * 1000, 'reconnect');

        if (scheduled) {
          reconnectTimer = scheduled.timer;
          console.log(`[${label}] reconnect ${scheduled.delaySeconds}s attempt=${nextAttempt}`);
        }
      } else {
        console.log(`[${label}] disconnected`);
      }
    });
  }

  function handleChat(rawText) {
    const text = normalize(rawText);

    if (isRegisterPrompt(text) && config.verboseLogs) {
      console.log(`[${label} auth] register prompt seen`);
      return;
    }

    if (isRegisteredNotice(text)) {
      state.registered = true;
      return;
    }

    if (isLoginPrompt(text) && config.verboseLogs) {
      console.log(`[${label} auth] login prompt seen`);
      return;
    }

    if (isAuthSuccess(text)) {
      markAuthenticated('server confirmed login');
      return;
    }

    if (isAuthFailure(text)) {
      metrics.authFailures += 1;
      console.log(`[${label}] auth failed`);
    }
  }

  function scheduleAuthSequence() {
    clearAuthSequenceTimers();

    const registerDelay = Math.max(0, config.joinRegisterDelayMs);
    const stepDelay = Math.max(0, config.authStepDelayMs);
    authSequenceTimers = [
      setTimeout(() => sendRegister('scheduled after joining'), registerDelay),
      setTimeout(() => sendLogin('scheduled after register wait'), registerDelay + stepDelay),
      setTimeout(() => sendMcmmo('scheduled after login wait'), registerDelay + stepDelay * 2)
    ];
  }

  function clearAuthSequenceTimers() {
    for (const timer of authSequenceTimers) {
      clearTimeout(timer);
    }

    authSequenceTimers = [];
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

  function sendMcmmo(reason) {
    if (!config.autoMcmmo || state.mcmmoSent) return;

    state.mcmmoSent = true;
    queueCommand('/mcmmo', '/mcmmo', reason);
  }

  function markAuthenticated(reason) {
    if (state.authenticated) return;

    clearTimeout(authFallbackTimer);
    state.authenticated = true;
    metrics.authSuccess += 1;
    console.log(`[${label}] authenticated: ${reason}`);
  }

  function queueCommand(command, redactedCommand, reason) {
    const delay = Math.max(0, commandReadyAt - Date.now());
    commandReadyAt = Date.now() + delay + COMMAND_DELAY_MS;

    if (config.verboseLogs) {
      console.log(`[${label} cmd] ${redactedCommand} queued: ${reason}`);
    }

    setTimeout(() => {
      if (!bot || typeof bot.chat !== 'function') {
        if (config.verboseLogs) {
          console.log(`[${label} cmd] ${redactedCommand} skipped`);
        }
        return;
      }

      try {
        bot.chat(command);
        if (config.verboseLogs) {
          console.log(`[${label} cmd] ${redactedCommand} sent`);
        }
      } catch {
        console.log(`[${label} cmd] ${redactedCommand} failed`);
      }
    }, delay);
  }

  function scheduleAuthFallback() {
    clearTimeout(authFallbackTimer);

    if (config.authFallbackSeconds <= 0) return;

    authFallbackTimer = setTimeout(() => {
      if (state.authenticated || state.loginSent || state.registerSent) return;

      if (config.verboseLogs) {
        console.log(`[${label} auth] login fallback`);
      }
      sendLogin('fallback after no prompt');
    }, config.authFallbackSeconds * 1000);
  }

  function clearPendingConnectTimer() {
    clearTimeout(pendingConnectTimer);
    pendingConnectTimer = undefined;
  }

  function setPendingConnectTimer(timer) {
    clearPendingConnectTimer();
    pendingConnectTimer = timer;
  }

  function stop() {
    clearPendingConnectTimer();
    clearTimeout(authFallbackTimer);
    clearTimeout(reconnectTimer);
    clearAuthSequenceTimers();

    if (!bot) return;

    try {
      if (typeof bot.quit === 'function') {
        bot.quit('stress test stop');
      }
    } catch {
      // no-op
    }

    try {
      if (typeof bot.end === 'function') {
        bot.end();
      }
    } catch {
      // no-op
    }
  }

  function resetState() {
    clearAuthSequenceTimers();
    commandReadyAt = 0;
    state.registered = false;
    state.loginSent = false;
    state.registerSent = false;
    state.authenticated = false;
    state.mcmmoSent = false;
  }

  const api = {
    connect,
    stop,
    setPendingConnectTimer,
    clearPendingConnectTimer
  };

  return api;
}

function calculateReconnectDelaySeconds(attempt) {
  const exponential = config.reconnectDelaySeconds * Math.pow(config.reconnectBackoffMultiplier, Math.max(0, attempt - 1));
  return Math.min(config.reconnectMaxDelaySeconds, Math.max(1, Math.round(exponential)));
}

function incrementMetric(table, key) {
  table[key] = (table[key] || 0) + 1;
}

function pickBotVersion(slot) {
  return config.versions[(slot - 1) % config.versions.length];
}

function makeBotUsername(slot) {
  if (config.username && config.botCount === 1) {
    return config.username;
  }

  if (config.username) {
    return makeIndexedUsername(config.username, slot);
  }

  if (config.usernamePrefix) {
    return makeIndexedUsername(config.usernamePrefix, slot);
  }

  return makeHumanUsername(slot);
}

function makeIndexedUsername(prefix, slot) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 9) || 'MCMmoBot';
  const slotText = slot.toString(36);
  const randomText = Math.random().toString(36).slice(2, 6);
  const suffix = `${slotText}${randomText}`;

  return `${cleanPrefix}${suffix}`.slice(0, 16);
}

function makeHumanUsername(slot) {
  const baseName = HUMAN_NAMES[(slot - 1) % HUMAN_NAMES.length];
  const slotText = slot.toString(36);
  const randomText = Math.random().toString(36).slice(2, 5);
  const number = randomInt(10, 99).toString();

  return `${baseName}${slotText}${number}${randomText}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
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

function versionsFromEnv() {
  const versions = listFromEnv('BOT_VERSIONS', DEFAULT_VERSIONS);
  return versions.length > 0 ? versions : DEFAULT_VERSIONS;
}

function stressProfileFromEnv() {
  const value = (process.env.STRESS_PROFILE || DEFAULT_STRESS_PROFILE).trim().toLowerCase();

  if (value === 'steady' || value === 'burst' || value === 'wave') {
    return value;
  }

  return DEFAULT_STRESS_PROFILE;
}

function listFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
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

function floatFromEnv(name, fallback) {
  const value = Number.parseFloat(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function randomInt(min, max) {
  if (max <= min) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function summarizeKick(reason) {
  if (/vpn|proxy/i.test(reason)) return 'vpn/proxy';
  if (/logging in too fast/i.test(reason)) return 'rate-limited';
  if (/server is full/i.test(reason)) return 'server-full';
  if (/ban|blacklist/i.test(reason)) return 'blocked';

  return normalize(reason).slice(0, 80) || 'unknown';
}

function summarizeError(err) {
  return err.code || err.message || String(err);
}

function formatLogArg(value) {
  if (value instanceof Error) {
    return value.code || value.message;
  }

  return String(value);
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
