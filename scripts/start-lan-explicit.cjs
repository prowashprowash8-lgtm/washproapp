/**
 * Démarre Expo en LAN en forçant l’IP affichée dans le QR code (évite une mauvaise interface réseau).
 * Usage : npm run start:lan-ip
 */
'use strict';

const os = require('node:os');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

function pickLanIPv4() {
  /** Préfère en0 (Wi‑Fi typique sur Mac). */
  const ifs = os.networkInterfaces() || {};
  const candidates = [];
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name] || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4 && !net.internal) {
        candidates.push({ name, address: net.address });
      }
    }
  }
  const en0 = candidates.find((c) => c.name === 'en0');
  if (en0) return en0.address;
  const en = candidates.find((c) => c.name.startsWith('en'));
  if (en) return en.address;
  return candidates[0]?.address || null;
}

let ip = pickLanIPv4();
if (!ip && process.platform === 'darwin') {
  try {
    ip = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim() || null;
  } catch {
    /* ignore */
  }
}

if (!ip) {
  console.error(
    '[washproapp] Aucune IPv4 locale trouvée. Vérifie le Wi‑Fi, puis réessaie ou utilise : npm run start:tunnel',
  );
  process.exit(1);
}

console.log('[washproapp] QR / bundle utilisera l’IP :', ip, '\n');

const root = path.join(__dirname, '..');
const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: ip,
  EXPO_PACKAGER_HOSTNAME: ip,
};

const child = spawn(
  process.execPath,
  [path.join(__dirname, 'expo-with-polyfill.cjs'), 'start', '--lan', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    cwd: root,
    env,
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
