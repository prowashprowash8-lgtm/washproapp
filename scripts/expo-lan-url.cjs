#!/usr/bin/env node
/**
 * Affiche ton IP locale et l’URL exp:// à saisir manuellement dans Expo Go
 * si le scan du QR code ne fonctionne pas (pare-feu, Wi‑Fi invité, etc.).
 */
'use strict';

const os = require('node:os');
const { execSync } = require('node:child_process');

const port = process.argv[2] || '8081';

const ips = [];
let interfaces = {};
try {
  interfaces = os.networkInterfaces() || {};
} catch {
  interfaces = {};
}
for (const name of Object.keys(interfaces)) {
  for (const net of interfaces[name] || []) {
    const fam = net.family;
    const isV4 = fam === 'IPv4' || fam === 4;
    if (isV4 && !net.internal) {
      ips.push({ name, address: net.address });
    }
  }
}

if (ips.length === 0 && process.platform === 'darwin') {
  try {
    const out = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    if (out && /^\d+\.\d+\.\d+\.\d+$/.test(out)) {
      ips.push({ name: 'en0', address: out });
    }
  } catch {
    /* ignore */
  }
}

console.log('\n[WashPro] Adresses sur le réseau local :\n');
if (ips.length === 0) {
  console.log('  (aucune IPv4 trouvée — vérifie le Wi‑Fi)\n');
  process.exit(1);
}

for (const { name, address } of ips) {
  console.log(`  ${name.padEnd(12)} ${address}`);
  console.log(`               → exp://${address}:${port}\n`);
}

console.log(
  'Dans Expo Go : onglet « Projects » → « Enter URL manually » (ou équivalent)\n' +
    'et colle une URL exp:// ci-dessus (même port que dans le terminal Metro).\n',
);
