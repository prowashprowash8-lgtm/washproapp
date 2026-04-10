#!/usr/bin/env node
/**
 * Vérifie si Metro répond en local et affiche les IP à utiliser avec Expo Go.
 * Usage : lance Metro dans un autre terminal, puis : npm run check:expo
 */
'use strict';

const http = require('node:http');
const os = require('node:os');
const { execSync } = require('node:child_process');

const port = process.argv[2] || process.env.RCT_METRO_PORT || '8081';

function probe(path) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path, timeout: 3000 },
      (res) => {
        res.resume();
        /* 200–499 = un serveur répond (Metro peut renvoyer 404 sur certaines routes) */
        resolve({ ok: res.statusCode < 500, code: res.statusCode });
      },
    );
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

async function main() {
  console.log('\n[WashPro] Vérification connexion Expo / Metro (port ' + port + ')\n');

  const status = await probe('/status');
  const root = await probe('/');

  if (status.ok || root.ok) {
    console.log('✓ Un serveur répond sur ce Mac (http://127.0.0.1:' + port + ')\n');
  } else {
    console.log('✗ Aucun serveur Metro détecté sur le port ' + port + '.');
    console.log('  Lance dans un autre terminal : npm run start:clear\n');
    process.exitCode = 1;
    return;
  }

  console.log('Si Expo Go affiche « Could not connect » en Wi‑Fi :');
  console.log('  1) Pare-feu macOS : autoriser Node pour les connexions entrantes');
  console.log('  2) iPhone : Réglages → Expo Go → Réseau local : activé');
  console.log('  3) Désactiver VPN / iCloud Relais privé (Mac et iPhone) le temps du test');
  console.log('  4) Éviter le Wi‑Fi « invité » (isolation entre appareils)\n');
  console.log('Le plus fiable sans toucher au routeur :');
  console.log('  npm run start:go');
  console.log('  (tunnel → nouveau QR, plus lent mais contourne le LAN)\n');

  try {
    const ifs = os.networkInterfaces() || {};
    const ips = [];
    for (const n of Object.keys(ifs)) {
      for (const net of ifs[n] || []) {
        const v4 = net.family === 'IPv4' || net.family === 4;
        if (v4 && !net.internal) ips.push(net.address);
      }
    }
    if (ips.length) {
      console.log('IP(s) locale(s) de ce Mac : ' + ips.join(', '));
      console.log('L’URL dans l’erreur doit correspondre à l’une de ces IP (sinon : relance Metro pour un nouveau QR).\n');
    }
  } catch {
    /* ignore */
  }

  if (process.platform === 'darwin') {
    try {
      const en0 = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
      if (en0) console.log('Wi‑Fi (en0) : ' + en0 + '\n');
    } catch {
      /* ignore */
    }
  }
}

main();
