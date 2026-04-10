/**
 * Node 24+ : `util.isSpaceSeparator` peut être absent alors que Babel / @expo/json-file
 * s’y attend. Polyfill minimal (catégorie Unicode Zs) pour éviter les crash au démarrage.
 */
'use strict';

const util = require('node:util');

if (typeof util.isSpaceSeparator !== 'function') {
  function isSpaceSeparator(s) {
    if (typeof s !== 'string' || s.length === 0) return false;
    const cp = s.codePointAt(0);
    const len = cp > 0xffff ? 2 : 1;
    if (s.length !== len) return false;
    return (
      cp === 0x0020 ||
      cp === 0x00a0 ||
      cp === 0x1680 ||
      cp === 0x202f ||
      cp === 0x205f ||
      cp === 0x3000 ||
      (cp >= 0x2000 && cp <= 0x200a)
    );
  }

  util.isSpaceSeparator = isSpaceSeparator;
}
