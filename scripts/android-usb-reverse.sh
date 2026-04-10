#!/usr/bin/env bash
# À lancer après avoir branché le téléphone Android en USB (débogage USB activé).
# Puis : npm start
# Dans Expo Go : « Enter URL manually » → exp://127.0.0.1:8081
# (remplace 8081 si Metro utilise un autre port.)

set -e
PORT="${1:-8081}"
if ! command -v adb >/dev/null 2>&1; then
  echo "adb introuvable. Installe Android Studio / platform-tools ou ajoute adb au PATH."
  exit 1
fi
adb reverse "tcp:${PORT}" "tcp:${PORT}"
echo "OK : le port ${PORT} du téléphone est relié à ton Mac."
echo "Lance Metro (npm start), puis dans Expo Go ouvre : exp://127.0.0.1:${PORT}"
