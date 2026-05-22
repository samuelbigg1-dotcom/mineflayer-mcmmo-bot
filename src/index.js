require('dotenv').config();

const http = require('http');
const net = require('net');
const mineflayer = require('mineflayer');

const DEFAULT_PASSWORD = '12345!';
const COMMAND_DELAY_MS = 1600;
const DEFAULT_VERSIONS = ['1.8.9', '1.9', '1.9.1', '1.9.2', '1.9.3', '1.9.4'];
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
  botCount: intFromEnv('BOT_COUNT', 10800),
  botBatchSize: Math.max(1, intFromEnv('BOT_BATCH_SIZE', 5)),
  launchIntervalMs: intFromEnv('BOT_LAUNCH_INTERVAL_MS', 500),
  joinRegisterDelayMs: intFromEnv('JOIN_REGISTER_DELAY_MS', 5000),
  authStepDelayMs: intFromEnv('AUTH_STEP_DELAY_MS', 3000),
  autoMcmmo: boolFromEnv('AUTO_MCMMO', boolFromEnv('AUTO_MCMO', true)),
  authFallbackSeconds: intFromEnv('AUTH_FALLBACK_SECONDS', 10),
  reconnect: boolFromEnv('RECONNECT', true),
  reconnectDelaySeconds: intFromEnv('RECONNECT_DELAY_SECONDS', 15),
  proxies: proxiesFromEnv(),
  proxyConnectTimeoutMs: Math.max(1000, intFromEnv('PROXY_CONNECT_TIMEOUT_MS', 15000)),
  verboseLogs: boolFromEnv('VERBOSE_LOGS', false)
};

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
const launchQueue = createConnectQueue();
const reconnectQueue = createConnectQueue();

function main() {
  const botCount = Math.max(1, config.botCount);
  const proxySummary = config.proxies.length > 0 ? `; proxies=${config.proxies.length}` : '';

  console.log(
    `[fleet] starting ${botCount} bots; batch=${config.botBatchSize}; interval=${config.launchIntervalMs}ms; registerDelay=${config.joinRegisterDelayMs}ms; versions=${config.versions.join(',')}${proxySummary}`
  );

  if (config.proxies.length > 0 && config.proxies.length < botCount) {
    console.log('[fleet] proxy list is shorter than bot count; proxies will rotate');
  }

  for (let index = 0; index < botCount; index += 1) {
    const runner = createBotRunner(index + 1);
    runners.push(runner);
    scheduleConnect(runner, 0, 'launch');
  }
}

function createConnectQueue() {
  return {
    nextAt: 0,
    usedInBatch: 0
  };
}

function scheduleConnect(runner, delayMs, queueName) {
  const now = Date.now();
  const earliest = now + Math.max(0, delayMs);
  const queue = queueName === 'reconnect' ? reconnectQueue : launchQueue;

  if (queue.nextAt < now) {
    queue.nextAt = now;
    queue.usedInBatch = 0;
  }

  if (queue.nextAt < earliest) {
    queue.nextAt = earliest;
    queue.usedInBatch = 0;
  }

  const scheduledAt = queue.nextAt;
  queue.usedInBatch += 1;

  if (queue.usedInBatch >= config.botBatchSize) {
    queue.nextAt = scheduledAt + Math.max(0, config.launchIntervalMs);
    queue.usedInBatch = 0;
  }

  const timer = setTimeout(runner.connect, scheduledAt - now);

  return {
    delaySeconds: Math.ceil((scheduledAt - now) / 1000),
    timer
  };
}

function createBotRunner(slot) {
  const label = `bot-${slot}`;
  const username = makeBotUsername(slot);
  const botVersion = pickBotVersion(slot);
  const proxy = pickProxy(slot);

  let bot;
  let commandReadyAt = 0;
  let authFallbackTimer;
  let reconnectTimer;
  let lastKickReason = '';
  let authSequenceTimers = [];

  const state = {
    registered: false,
    loginSent: false,
    registerSent: false,
    authenticated: false,
    mcmmoSent: false
  };

  function connect() {
    clearTimeout(reconnectTimer);
    resetState();

    const proxyLabel = proxy ? ` via ${formatProxyForLog(proxy)}` : '';
    console.log(`[${label}] connect ${username} ${botVersion}${proxyLabel}`);

    const botOptions = {
      host: config.host,
      port: config.port,
      username,
      version: botVersion,
      auth: config.auth
    };

    if (proxy) {
      botOptions.connect = (client) => connectViaProxy(client, proxy);
    }

    bot = mineflayer.createBot(botOptions);

    bot.once('spawn', () => {
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
      lastKickReason = stringifyReason(reason);
      console.log(`[${label}] kicked ${summarizeKick(lastKickReason)}`);
    });

    bot.on('error', (err) => {
      console.log(`[${label}] error ${summarizeError(err)}`);
    });

    bot.on('end', () => {
      clearTimeout(authFallbackTimer);
      clearAuthSequenceTimers();

      if (config.reconnect) {
        const scheduled = scheduleConnect(api, config.reconnectDelaySeconds * 1000, 'reconnect');
        reconnectTimer = scheduled.timer;
        console.log(`[${label}] reconnect ${scheduled.delaySeconds}s`);
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
      } catch (err) {
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

  function resetState() {
    clearAuthSequenceTimers();
    commandReadyAt = 0;
    lastKickReason = '';
    state.registered = false;
    state.loginSent = false;
    state.registerSent = false;
    state.authenticated = false;
    state.mcmmoSent = false;
  }

  const api = {
    connect
  };

  return api;
}

function pickBotVersion(slot) {
  return config.versions[(slot - 1) % config.versions.length];
}

function pickProxy(slot) {
  if (config.proxies.length === 0) return null;

  return config.proxies[(slot - 1) % config.proxies.length];
}

function connectViaProxy(client, proxy) {
  if (proxy.protocol === 'http') {
    connectViaHttpProxy(client, proxy);
    return;
  }

  connectViaSocksProxy(client, proxy);
}

function connectViaHttpProxy(client, proxy) {
  const requestOptions = {
    host: proxy.host,
    port: proxy.port,
    method: 'CONNECT',
    path: `${config.host}:${config.port}`,
    headers: proxyAuthHeaders(proxy)
  };

  const request = http.request(requestOptions);

  request.setTimeout(config.proxyConnectTimeoutMs, () => {
    request.destroy(new Error(`proxy timeout ${formatProxyForLog(proxy)}`));
  });

  request.on('connect', (response, socket) => {
    if (response.statusCode !== 200) {
      socket.destroy();
      client.emit('error', new Error(`proxy CONNECT ${response.statusCode} ${formatProxyForLog(proxy)}`));
      return;
    }

    client.setSocket(socket);
    client.emit('connect');
  });

  request.on('response', (response) => {
    response.resume();
    client.emit('error', new Error(`proxy response ${response.statusCode} ${formatProxyForLog(proxy)}`));
  });

  request.on('error', (err) => {
    client.emit('error', err);
  });

  request.end();
}

function connectViaSocksProxy(client, proxy) {
  const socket = net.connect(proxy.port, proxy.host);
  let settled = false;

  function fail(err) {
    if (settled) return;

    settled = true;
    socket.destroy();
    client.emit('error', err);
  }

  socket.setTimeout(config.proxyConnectTimeoutMs, () => {
    fail(new Error(`proxy timeout ${formatProxyForLog(proxy)}`));
  });

  socket.once('error', fail);

  socket.once('connect', async () => {
    try {
      await completeSocks5Handshake(socket, proxy);
      settled = true;
      socket.setTimeout(0);
      socket.removeListener('error', fail);
      client.setSocket(socket);
      client.emit('connect');
    } catch (err) {
      fail(new Error(`proxy ${formatProxyForLog(proxy)} ${err.message}`));
    }
  });
}

async function completeSocks5Handshake(socket, proxy) {
  const hasAuth = Boolean(proxy.username || proxy.password);
  const methods = hasAuth ? [0x00, 0x02] : [0x00];

  socket.write(Buffer.from([0x05, methods.length, ...methods]));

  const methodResponse = await readSocketBytes(socket, 2);
  if (methodResponse[0] !== 0x05 || methodResponse[1] === 0xff) {
    throw new Error('SOCKS5 auth method rejected');
  }

  if (methodResponse[1] === 0x02) {
    await authenticateSocks5(socket, proxy);
  } else if (methodResponse[1] !== 0x00) {
    throw new Error(`unsupported SOCKS5 auth method ${methodResponse[1]}`);
  }

  socket.write(createSocks5ConnectRequest(config.host, config.port));

  const replyHeader = await readSocketBytes(socket, 4);
  if (replyHeader[0] !== 0x05) {
    throw new Error('invalid SOCKS5 reply');
  }

  if (replyHeader[1] !== 0x00) {
    throw new Error(`SOCKS5 connect failed ${replyHeader[1]}`);
  }

  if (replyHeader[3] === 0x01) {
    await readSocketBytes(socket, 6);
    return;
  }

  if (replyHeader[3] === 0x03) {
    const length = (await readSocketBytes(socket, 1))[0];
    await readSocketBytes(socket, length + 2);
    return;
  }

  if (replyHeader[3] === 0x04) {
    await readSocketBytes(socket, 18);
    return;
  }

  throw new Error(`unsupported SOCKS5 address type ${replyHeader[3]}`);
}

async function authenticateSocks5(socket, proxy) {
  const username = Buffer.from(proxy.username);
  const password = Buffer.from(proxy.password);

  if (username.length > 255 || password.length > 255) {
    throw new Error('SOCKS5 username/password too long');
  }

  socket.write(Buffer.concat([
    Buffer.from([0x01, username.length]),
    username,
    Buffer.from([password.length]),
    password
  ]));

  const response = await readSocketBytes(socket, 2);
  if (response[0] !== 0x01 || response[1] !== 0x00) {
    throw new Error('SOCKS5 username/password rejected');
  }
}

function createSocks5ConnectRequest(host, port) {
  const hostBuffer = Buffer.from(host);
  if (hostBuffer.length > 255) {
    throw new Error('SOCKS5 destination host too long');
  }

  const request = Buffer.alloc(7 + hostBuffer.length);
  request[0] = 0x05;
  request[1] = 0x01;
  request[2] = 0x00;
  request[3] = 0x03;
  request[4] = hostBuffer.length;
  hostBuffer.copy(request, 5);
  request.writeUInt16BE(port, 5 + hostBuffer.length);

  return request;
}

function readSocketBytes(socket, size) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;

    function cleanup() {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      socket.removeListener('end', onEnd);
    }

    function onData(chunk) {
      chunks.push(chunk);
      length += chunk.length;

      if (length < size) return;

      cleanup();
      const buffer = Buffer.concat(chunks, length);
      const remaining = buffer.subarray(size);
      if (remaining.length > 0) {
        socket.unshift(remaining);
      }
      resolve(buffer.subarray(0, size));
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function onEnd() {
      cleanup();
      reject(new Error('proxy socket closed'));
    }

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('end', onEnd);
  });
}

function proxyAuthHeaders(proxy) {
  if (!proxy.username && !proxy.password) return undefined;

  const token = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');

  return {
    'Proxy-Authorization': `Basic ${token}`
  };
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

function proxiesFromEnv() {
  const value = process.env.BOT_PROXIES;
  if (!value) return [];

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseProxy);
}

function parseProxy(value) {
  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  const url = new URL(hasProtocol ? value : `socks5://${value}`);
  const protocol = url.protocol.replace(':', '').toLowerCase();
  const port = Number.parseInt(url.port, 10);

  if (!['http', 'socks5'].includes(protocol)) {
    throw new Error(`Unsupported proxy protocol: ${protocol}`);
  }

  if (!url.hostname || !Number.isFinite(port)) {
    throw new Error(`Invalid proxy entry: ${value}`);
  }

  return {
    protocol,
    host: url.hostname,
    port,
    username: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || '')
  };
}

function formatProxyForLog(proxy) {
  const auth = proxy.username ? `${proxy.username}:***@` : '';

  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
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

function randomInt(min, max) {
  if (max <= min) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
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
