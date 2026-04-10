/**
 * Service ESP32 - Vérification si l'ESP32 est en ligne
 * Utilise la RPC check_esp32_online (évite les problèmes de permissions sur la table)
 */

import { supabase } from '../lib/supabase';

function normalizeEsp32Id(value) {
  const raw = value == null ? '' : String(value);
  return raw.trim().toUpperCase();
}

/**
 * esp32_id de la ligne machine, sinon celui de l'emplacement (une box pour plusieurs machines).
 */
export function getEsp32IdForMachine(machine, emplacement) {
  const fromMachine = normalizeEsp32Id(machine?.esp32_id || machine?.esp32Id);
  if (fromMachine) return fromMachine;
  const fromEmp = normalizeEsp32Id(
    emplacement?.esp32_id || emplacement?.esp32 || emplacement?.esp32Id
  );
  if (fromEmp) return fromEmp;
  const env = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_ESP32_ID : '';
  return normalizeEsp32Id(env);
}

/**
 * Vérifie si l'ESP32 est en ligne via la RPC check_esp32_online
 * @param {string} esp32Id - ID de l'ESP32 (ex: WASH_PRO_001)
 * @returns {Promise<boolean>} true si last_seen < 15 secondes
 */
export async function checkEsp32Online(esp32Id) {
  const normalizedEsp32Id = normalizeEsp32Id(esp32Id);
  if (!supabase || !normalizedEsp32Id) return false;

  try {
    const { data, error } = await supabase.rpc('check_esp32_online', {
      p_esp32_id: normalizedEsp32Id,
    });

    if (error) {
      console.warn('[ESP32] RPC error:', error.message);
      return false;
    }

    return data === true;
  } catch (err) {
    console.warn('[ESP32] checkEsp32Online error:', err);
    return false;
  }
}
