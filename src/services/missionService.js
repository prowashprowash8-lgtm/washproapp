import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { getSavedLaundry } from '../utils/laundryStorage';

function base64ToUint8Array(base64) {
  let clean = base64.replace(/^data:image\/\w+;base64,/, '').replace(/[\n\r\s]/g, '');
  const decode = typeof atob !== 'undefined' ? atob : (s) => {
    throw new Error('atob non disponible');
  };
  const binaryString = decode(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Récupère le nombre de missions disponibles pour la laverie sauvegardée (pour le badge).
 * Compte uniquement les missions que l'utilisateur peut encore réaliser.
 */
export async function getMissionsCount(userId = null) {
  const saved = await getSavedLaundry(userId);
  if (!saved?.emplacement?.id) return 0;
  const { data: missions, completedByUserIds } = await getMissionsByEmplacement(saved.emplacement.id, userId);
  if (!missions?.length) return 0;
  return missions.filter((m) => !completedByUserIds.has(m.id)).length;
}

/**
 * Récupère les missions pour une laverie (emplacement).
 * - Missions disponibles : pas encore réalisées par personne.
 * - Historique : missions réalisées par l'utilisateur connecté (userId).
 * Exclut les missions réalisées par d'autres utilisateurs.
 */
export async function getMissionsByEmplacement(emplacementId, userId = null) {
  if (!supabase || !emplacementId) return { data: [], completedByUserIds: new Set(), error: null };

  const { data: links, error: linkErr } = await supabase
    .from('mission_emplacements')
    .select('mission_id')
    .eq('emplacement_id', emplacementId);

  if (linkErr) return { data: [], completedByUserIds: new Set(), error: linkErr };
  const missionIds = (links || []).map((l) => l.mission_id);
  if (missionIds.length === 0) return { data: [], completedByUserIds: new Set(), error: null };

  // Toutes les soumissions pour cet emplacement (mission_id, user_id)
  const { data: takenSubs, error: takenErr } = await supabase
    .from('mission_submissions')
    .select('mission_id, user_id')
    .eq('emplacement_id', emplacementId)
    .in('mission_id', missionIds);

  if (takenErr) return { data: [], completedByUserIds: new Set(), error: takenErr };

  const takenByOther = new Set();
  const completedByUserIds = new Set();
  for (const s of takenSubs || []) {
    if (s.user_id === userId) {
      completedByUserIds.add(s.mission_id);
    } else {
      takenByOther.add(s.mission_id);
    }
  }

  // Afficher : disponibles (personne n'a fait) OU réalisées par l'utilisateur (historique)
  const showMissionIds = missionIds.filter(
    (id) => !takenByOther.has(id)
  );
  if (showMissionIds.length === 0) return { data: [], completedByUserIds, error: null };

  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, titre, description, recompense, created_at')
    .in('id', showMissionIds)
    .order('created_at', { ascending: false });

  return { data: missions || [], completedByUserIds, error };
}

/**
 * Récupère la soumission de l'utilisateur pour une mission (si déjà complétée)
 */
export async function getMySubmissionForMission(missionId, userId) {
  if (!supabase || !missionId) return { data: null, error: null };
  if (!userId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('mission_submissions')
    .select('id, status, photo_urls, completed_at')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  return { data, error };
}

/**
 * Soumet une mission avec photos (upload + insert)
 * photoData: array de base64 strings OU de file URIs
 */
export async function submitMissionWithPhotos(missionId, emplacementId, userId, photoData) {
  if (!supabase || !missionId || !emplacementId || !photoData?.length) {
    return { error: new Error('Données manquantes') };
  }

  // Vérifier que la mission n'a pas déjà été réalisée (par n'importe quel utilisateur)
  const { data: existing } = await supabase
    .from('mission_submissions')
    .select('id')
    .eq('mission_id', missionId)
    .eq('emplacement_id', emplacementId)
    .limit(1);
  if (existing?.length > 0) {
    const err = new Error('Mission déjà réalisée');
    err.code = 'MISSION_ALREADY_TAKEN';
    return { error: err };
  }

  const photoUrls = [];
  const bucket = 'mission-photos';
  const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let i = 0; i < photoData.length; i++) {
    const item = photoData[i];
    const isBase64 = typeof item === 'string' && !item.startsWith('file://') && !item.startsWith('content://') && item.length > 100;
    const path = `${submissionId}/${Date.now()}_${i}.jpg`;

    let uint8Array;
    if (isBase64) {
      try {
        uint8Array = base64ToUint8Array(item);
      } catch (err) {
        return { error: new Error('Format image invalide: ' + (err?.message || 'base64')), photoUrls: null };
      }
    } else {
      try {
        const base64 = await FileSystem.readAsStringAsync(item, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uint8Array = base64ToUint8Array(base64);
      } catch (err) {
        return { error: err || new Error('Impossible de lire la photo'), photoUrls: null };
      }
    }

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, uint8Array, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (uploadErr) {
      return { error: new Error(uploadErr.message || 'Erreur upload: ' + JSON.stringify(uploadErr)), photoUrls: null };
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    photoUrls.push(urlData?.publicUrl || '');
  }

  const { error: insertErr } = await supabase.from('mission_submissions').insert({
    mission_id: missionId,
    user_id: userId || null,
    emplacement_id: emplacementId,
    status: 'completed',
    photo_urls: photoUrls,
    completed_at: new Date().toISOString(),
  });

  if (insertErr) return { error: new Error(insertErr.message || 'Erreur enregistrement'), photoUrls: null };
  return { error: null, photoUrls };
}
