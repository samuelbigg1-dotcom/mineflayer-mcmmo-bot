'use strict';

// Default the fleet to random-looking alphanumeric usernames for private test runs.
// This prevents src/index.js from falling back to the HUMAN_NAMES list when no
// BOT_USERNAME or BOT_USERNAME_PREFIX is provided.
if (!process.env.BOT_USERNAME && !process.env.BOT_USERNAME_PREFIX) {
  process.env.BOT_USERNAME_PREFIX = process.env.RANDOM_USERNAME_PREFIX || 'b';
}
