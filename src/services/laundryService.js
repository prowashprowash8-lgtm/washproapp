import { supabase } from '../lib/supabase';

/**
 * Recherche un emplacement (laverie) par nom dans la table emplacements
 * Recherche partielle, insensible à la casse
 */
export async function findEmplacementByName(searchTerm) {
  if (!supabase || !searchTerm?.trim()) return { data: null, error: null };

  const term = searchTerm.trim();
  const { data, error } = await supabase
    .from('emplacements')
    .select('*')
    .ilike('name', `%${term}%`)
    .limit(1)
    .maybeSingle();

  return { data, error };
}

/**
 * Récupère les machines d'un emplacement
 */
export async function getMachinesByEmplacement(emplacementId) {
  if (!supabase || !emplacementId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('emplacement_id', emplacementId)
    .order('id');

  return { data: data || [], error };
}

export async function setMachineAvailableById(machineId) {
  if (!supabase || !machineId) return { ok: false, error: 'missing' };
  const { data, error } = await supabase.rpc('set_machine_available_by_id', {
    p_machine_id: machineId,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: 'release_rejected' };
  return { ok: true };
}
