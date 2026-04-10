/**
 * Lance le CLI Expo après le polyfill Node (util.isSpaceSeparator, etc.).
 * Évite npx / NODE_OPTIONS qui peuvent compliquer les sous-processus.
 */
'use strict';

require('./node-polyfill.cjs');

const path = require('node:path');
const { spawn } = require('node:child_process');

const fs = require('node:fs');

const root = path.join(__dirname, '..');
let cliPath;
try {
  const expoPkg = require.resolve('expo/package.json', { paths: [root] });
  const binDir = path.join(path.dirname(expoPkg), 'bin');
  const candidates = [path.join(binDir, 'cli'), path.join(binDir, 'cli.js')];
  cliPath = candidates.find((p) => fs.existsSync(p));
  if (!cliPath) {
    console.error('[washproapp] binaire Expo introuvable dans', binDir);
    process.exit(1);
  }
} catch {
  console.error(
    '[washproapp] Le paquet "expo" est introuvable. Lancez : npm install',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

child.on('error', (err) => {
  console.error('[washproapp]', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
