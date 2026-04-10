#!/usr/bin/env node
/**
 * À lancer pendant que Metro tourne (npm run start:lan-ip).
 * Indique si le port 8081 écoute sur toutes les interfaces ou seulement en local.
 */
'use strict';

const { execSync } = require('node:child_process');

console.log('\n[WashPro] Diagnostic LAN (Metro doit être démarré)\n');

try {
  const out = execSync('lsof -nP -iTCP:8081 -sTCP:LISTEN 2>/dev/null', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (!out.trim()) {
    console.log('Aucun processus en écoute sur 8081 → lance npm run start:lan-ip dans un autre terminal.\n');
    process.exit(1);
    return;
  }
  console.log(out);
  const line = out.split('\n').find((l) => l.includes('LISTEN'));
  if (line && (line.includes('*:8081') || line.includes('0.0.0.0:8081'))) {
    console.log('→ Metro écoute bien sur toutes les interfaces : le blocage vient du réseau (routeur / isolation), pas du Mac.\n');
  } else if (line && line.includes('127.0.0.1:8081')) {
    console.log('→ Metro n’écoute que sur localhost : anormal en mode LAN. Signale-le ou essaie : npx expo start --host lan\n');
  } else {
    console.log('→ Vérifie la colonne NAME ci-dessus.\n');
  }
} catch {
  console.log('Impossible de lire lsof (Metro arrêté ?).\n');
  process.exit(1);
}

console.log('Test rapide sur le Mac (copie-colle) :');
console.log('  curl -s -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:8081/status');
console.log('  curl -s -o /dev/null -w "%{http_code}\\n" http://<IP_DU_MAC>:8081/status');
console.log('(remplace <IP_DU_MAC> par l’IP affichée au démarrage, ex. 192.168.1.64)\n');
console.log('Si le 1er OK et le 2e échoue → pare-feu / interface réseau.');
console.log('Si les deux OK sur le Mac mais pas sur le téléphone → isolation Wi‑Fi ou pas le même réseau.\n');
