#!/usr/bin/env node
/**
 * Affiche les solutions quand `expo start --tunnel` échoue (ngrok intégré).
 */
'use strict';

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tunnel Expo : erreur « failed to start tunnel » / « session closed »
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Ce mode utilise les serveurs ngrok d’Expo. Ça peut échouer si :
  • panne ou surcharge côté ngrok (voir https://status.ngrok.com/)
  • pare-feu / réseau d’entreprise / VPN
  • limites temporaires du service gratuit

  Ce n’est PAS une erreur dans ton code WashPro.

──────────────────────────────────────────────────────────────
  Piste 1 — Wi‑Fi : forcer l’IP du Mac dans le QR code
──────────────────────────────────────────────────────────────
  npm run start:lan-ip

  Puis : Réglages Mac → Réseau → Pare-feu → autoriser « node »
  iPhone : Réglages → Expo Go → Réseau local : activé

──────────────────────────────────────────────────────────────
  Piste 2 — Ngrok avec TON compte (contourne le tunnel Expo)
──────────────────────────────────────────────────────────────
  1) Compte gratuit : https://dashboard.ngrok.com/get-started/your-authtoken
  2) brew install ngrok && ngrok config add-authtoken COLLE_TON_TOKEN
  3) Terminal A : npm start
  4) Terminal B : ngrok http 8081 --host-header=rewrite
  5) Suis l’URL / QR affichés par ngrok ; ou colle l’URL exp dans Expo Go
     (voir doc Expo : « custom ngrok tunnel » si besoin)

──────────────────────────────────────────────────────────────
  Piste 3 — Réessayer le tunnel Expo plus tard
──────────────────────────────────────────────────────────────
  npm run start:tunnel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
