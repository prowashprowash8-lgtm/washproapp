/**
 * Répare des installations node_modules incomplètes (cache npm, iCloud Desktop, antivirus…)
 * en retéléchargeant les fichiers manquants depuis le registre npm (unpkg.com).
 *
 * Paquets pris en charge : metro-file-map, metro-transform-plugins, @expo/package-manager, @expo-google-fonts/poppins.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');

const root = path.join(__dirname, '..');
const fixtureDup = path.join(__dirname, 'fixtures', 'DuplicateHasteCandidatesError.js');

const MFM_FILES = [
  'src/crawlers/node/index.js',
  'src/crawlers/node/hasNativeFindSupport.js',
  'src/crawlers/watchman/index.js',
  'src/crawlers/watchman/planQuery.js',
];

/** Fichiers .js requis par metro-transform-plugins/src/index.js */
const MTP_FILES = [
  'src/addParamsToDefineCall.js',
  'src/constant-folding-plugin.js',
  'src/import-export-plugin.js',
  'src/inline-plugin.js',
  'src/inline-requires-plugin.js',
  'src/normalizePseudoGlobals.js',
  'src/utils/createInlinePlatformChecks.js',
];

const EXPO_PACKAGE_MANAGER_FILES = [
  'build/utils/nodeManagers.js',
  'build/utils/spawn.js',
  'build/utils/env.js',
  'build/utils/yarn.js',
];

/** Uniquement les graisses utilisées dans App.js (évite ~50 téléchargements unpkg au postinstall). */
const POPPINS_FILES = [
  'index.js',
  'useFonts.js',
  'metadata.json',
  '400Regular/index.js',
  '400Regular/Poppins_400Regular.ttf',
  '600SemiBold/index.js',
  '600SemiBold/Poppins_600SemiBold.ttf',
  '700Bold/index.js',
  '700Bold/Poppins_700Bold.ttf',
];

function fetchText(url, depth = 0) {
  if (depth > 12) {
    return Promise.reject(new Error('Trop de redirections'));
  }
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    lib
      .get(
        url,
        {
          headers: { 'User-Agent': 'washproapp-fix-metro-packages' },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = new URL(res.headers.location, url).href;
            res.resume();
            fetchText(next, depth + 1).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ${url}`));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        },
      )
      .on('error', reject);
  });
}

function fetchBinary(url, depth = 0) {
  if (depth > 12) {
    return Promise.reject(new Error('Trop de redirections'));
  }
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    lib
      .get(
        url,
        {
          headers: { 'User-Agent': 'washproapp-fix-metro-packages' },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = new URL(res.headers.location, url).href;
            res.resume();
            fetchBinary(next, depth + 1).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ${url}`));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        },
      )
      .on('error', reject);
  });
}

function needsRestore(pkgRoot, relPath) {
  const full = path.join(pkgRoot, relPath);
  if (!fs.existsSync(full)) {
    return true;
  }
  try {
    const st = fs.statSync(full);
    return st.size < 50;
  } catch {
    return true;
  }
}

async function restoreFromUnpkg(packageName, pkgRoot, relPaths, label) {
  const pkgJson = path.join(pkgRoot, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    return;
  }

  let version =
    packageName === '@expo/package-manager'
      ? '1.9.10'
      : '0.83.3';
  try {
    version = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version || version;
  } catch {
    /* défaut */
  }

  const missing = relPaths.filter((rel) => needsRestore(pkgRoot, rel));
  if (missing.length === 0) {
    return;
  }

  console.warn(
    `[washproapp] ${label} incomplet (${missing.length} fichier(s) manquant(s)). Restauration v${version} depuis npm…`,
  );

  await Promise.all(
    missing.map(async (rel) => {
      const dest = path.join(pkgRoot, rel);
      const url = `https://unpkg.com/${packageName}@${version}/${rel.replace(/\\/g, '/')}`;
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (rel.endsWith('.ttf') || rel.endsWith('.otf')) {
          const buf = await fetchBinary(url);
          fs.writeFileSync(dest, buf);
        } else {
          const body = await fetchText(url);
          fs.writeFileSync(dest, body, 'utf8');
        }
      } catch (e) {
        console.error(`[washproapp] Échec téléchargement ${packageName}/${rel}:`, e.message);
        throw e;
      }
    }),
  );
  console.warn(`[washproapp] ${label} : fichiers restaurés.`);
}

async function main() {
  const mfmRoot = path.join(root, 'node_modules', 'metro-file-map');
  const mfmPkg = path.join(mfmRoot, 'package.json');

  if (fs.existsSync(mfmPkg)) {
    await restoreFromUnpkg('metro-file-map', mfmRoot, MFM_FILES, 'metro-file-map');
  }

  const mtpRoot = path.join(root, 'node_modules', 'metro-transform-plugins');
  if (fs.existsSync(path.join(mtpRoot, 'package.json'))) {
    await restoreFromUnpkg('metro-transform-plugins', mtpRoot, MTP_FILES, 'metro-transform-plugins');
  }

  const expoPmRoot = path.join(root, 'node_modules', '@expo', 'package-manager');
  if (fs.existsSync(path.join(expoPmRoot, 'package.json'))) {
    await restoreFromUnpkg(
      '@expo/package-manager',
      expoPmRoot,
      EXPO_PACKAGE_MANAGER_FILES,
      '@expo/package-manager',
    );
  }

  const poppinsRoot = path.join(root, 'node_modules', '@expo-google-fonts', 'poppins');
  if (fs.existsSync(path.join(poppinsRoot, 'package.json'))) {
    await restoreFromUnpkg('@expo-google-fonts/poppins', poppinsRoot, POPPINS_FILES, '@expo-google-fonts/poppins');
  }

  const mfmDup = path.join(mfmRoot, 'src', 'plugins', 'haste', 'DuplicateHasteCandidatesError.js');
  if (
    fs.existsSync(mfmPkg) &&
    fs.existsSync(fixtureDup) &&
    needsRestore(mfmRoot, 'src/plugins/haste/DuplicateHasteCandidatesError.js')
  ) {
    fs.mkdirSync(path.dirname(mfmDup), { recursive: true });
    fs.copyFileSync(fixtureDup, mfmDup);
    console.warn('[washproapp] metro-file-map : DuplicateHasteCandidatesError.js restauré (fixture).');
  }
}

main().catch((err) => {
  console.error('[washproapp] fix-metro-file-map:', err.message);
  process.exitCode = 1;
});
