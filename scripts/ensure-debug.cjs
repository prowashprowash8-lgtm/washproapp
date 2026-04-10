/**
 * Sur certaines machines (sync cloud, FS), `node_modules/debug/src/index.js` peut être vide :
 * Expo plante avec "enabled is not a function". On réinstalle uniquement `debug` si besoin.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const debugIndex = path.join(root, 'node_modules', 'debug', 'src', 'index.js');

function main() {
  if (!fs.existsSync(debugIndex)) return;
  let content = '';
  try {
    content = fs.readFileSync(debugIndex, 'utf8');
  } catch {
    return;
  }
  if (content.trim().length > 0) return;
  console.warn('[washproapp] Paquet npm "debug" corrompu (fichier vide). Réinstallation…');
  execSync('npm install debug@4.4.3 --no-audit --no-fund', {
    cwd: root,
    stdio: 'inherit',
  });
}

main();
