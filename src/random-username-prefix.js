'use strict';

const crypto = require('crypto');

// Default the fleet to generated human-ish username prefixes for private test runs.
// src/index.js still appends the bot slot plus random base-36 characters, so the
// final names look like human-style names with extra letters/numbers instead of
// pulling from the fixed HUMAN_NAMES list.
if (!process.env.BOT_USERNAME && !process.env.BOT_USERNAME_PREFIX) {
  process.env.BOT_USERNAME_PREFIX = process.env.RANDOM_USERNAME_PREFIX || makeHumanishPrefix();
}

function makeHumanishPrefix() {
  const starts = [
    'Aar', 'Ad', 'Ari', 'Ash', 'Aven', 'Ben', 'Bra', 'Bry', 'Cal', 'Cam',
    'Car', 'Cas', 'Cole', 'Dan', 'Dev', 'East', 'Eli', 'Fin', 'Gar', 'Gray',
    'Ian', 'Jay', 'Kai', 'Ken', 'Leo', 'Liam', 'Log', 'Luc', 'Max', 'Mic',
    'Noa', 'Oli', 'Owen', 'Pax', 'Rav', 'Ree', 'Ren', 'Row', 'Sam', 'Tay',
    'Theo', 'Ty', 'Wes', 'Zay'
  ];

  const middles = [
    'a', 'e', 'i', 'o', 'u', 'an', 'en', 'in', 'on', 'ar',
    'er', 'or', 'el', 'al', 'la', 'le', 'li', 'lo', 'ra', 're',
    'ri', 'ro', 'den', 'len', 'mar', 'son', 'ton', 'ven'
  ];

  const endings = [
    'n', 'r', 's', 'x', 'y', 'en', 'an', 'on', 'er', 'el',
    'ey', 'ie', 'io', 'us', 'as', 'is', 'or', 'ton', 'son', 'den',
    'lan', 'ley', 'ford', 'well'
  ];

  const extras = ['', '', '', 'a', 'e', 'i', 'o', 'y', 'x', 'z'];
  const base = `${pick(starts)}${pick(middles)}${pick(endings)}${pick(extras)}`;

  return base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 9) || 'Aiden';
}

function pick(items) {
  return items[crypto.randomInt(0, items.length)];
}
