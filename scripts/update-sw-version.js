/**
 * Auto-update Service Worker BUILD_TIME before each build
 * This ensures cache is invalidated on every deploy
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '../public/sw.js');

// Generate timestamp: YYYYMMDD-HHmmss
const now = new Date();
const buildTime = now.toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 14); // YYYYMMDDHHMMSS

console.log(`[SW Version] Updating BUILD_TIME to: ${buildTime}`);

// Read current sw.js
let content = fs.readFileSync(SW_PATH, 'utf8');

// Replace BUILD_TIME
content = content.replace(
  /const BUILD_TIME = '[^']+'/,
  `const BUILD_TIME = '${buildTime}'`
);

// Write back
fs.writeFileSync(SW_PATH, content, 'utf8');

console.log(`[SW Version] Updated public/sw.js`);
