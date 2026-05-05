import { supabase } from '../lib/supabase';

/**
 * Démarre une occupation de machine
 * @param {Object} params - Paramètres de l'occupation
 * @param {string} params.machineId - ID de la machine
 * @param {string} params.userId - ID de l'utilisateur
 * @param {string} params.transactionId - ID de la transaction
 * @param {string} params.emplacementId - ID de l'emplacement
 * @param {number} params.durationMinutes - Durée en minutes
 * @returns {Promise<{success: boolean, occupancyId?: string, error?: string}>}
 */
export async function startOccupancy({ machineId, userId, transactionId, emplacementId, durationMinutes }) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase.rpc('start_machine_occupancy', {
      p_machine_id: machineId,
      p_user_id: userId,
      p_transaction_id: transactionId,
      p_emplacement_id: emplacementId,
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      console.error('[Occupancy] startOccupancy error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Réponse invalide du serveur' };
    }

    const result = data[0];
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur inconnue' };
    }

    return { 
      success: true, 
      occupancyId: result.occupancy_id 
    };
  } catch (err) {
    console.error('[Occupancy] startOccupancy exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}

/**
 * Termine une occupation de machine
 * @param {string} occupancyId - ID de l'occupation
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function endOccupancy(occupancyId, userId) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase.rpc('end_machine_occupancy', {
      p_occupancy_id: occupancyId,
      p_user_id: userId,
    });

    if (error) {
      console.error('[Occupancy] endOccupancy error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Réponse invalide du serveur' };
    }

    const result = data[0];
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur inconnue' };
    }

    return { success: true };
  } catch (err) {
    console.error('[Occupancy] endOccupancy exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}

/**
 * Récupère les machines actives (occupées) pour un emplacement
 * @param {string} emplacementId - ID de l'emplacement
 * @returns {Promise<{success: boolean, machines?: Array, error?: string}>}
 */
export async function getActiveMachines(emplacementId) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase.rpc('get_active_machines', {
      p_emplacement_id: emplacementId,
    });

    if (error) {
      console.error('[Occupancy] getActiveMachines error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      machines: data || [] 
    };
  } catch (err) {
    console.error('[Occupancy] getActiveMachines exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}

/**
 * Envoie une notification de rappel à l'utilisateur d'une machine
 * @param {string} occupancyId - ID de l'occupation
 * @param {string} senderUserId - ID de l'utilisateur qui envoie le rappel
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendReminderNotification(occupancyId, senderUserId) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase.rpc('send_occupancy_reminder', {
      p_occupancy_id: occupancyId,
      p_sender_user_id: senderUserId,
    });

    if (error) {
      console.error('[Occupancy] sendReminderNotification error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Réponse invalide du serveur' };
    }

    const result = data[0];
    if (!result.success) {
      return { success: false, error: result.error || 'Erreur inconnue' };
    }

    // TODO: Envoyer la notification push réelle ici
    // Pour l'instant, on considère que c'est un succès
    
    return { success: true };
  } catch (err) {
    console.error('[Occupancy] sendReminderNotification exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}

/**
 * Récupère l'occupation active d'une machine
 * @param {string} machineId - ID de la machine
 * @returns {Promise<{success: boolean, occupancy?: Object, error?: string}>}
 */
export async function getActiveOccupancy(machineId) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase
      .from('machine_occupancy')
      .select(`
        *,
        machines(name),
        profiles(first_name, email),
        emplacements(name)
      `)
      .eq('machine_id', machineId)
      .in('status', ['active', 'overdue'])
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Occupancy] getActiveOccupancy error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      occupancy: data || null 
    };
  } catch (err) {
    console.error('[Occupancy] getActiveOccupancy exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}

/**
 * Récupère les occupations actives d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, occupancies?: Array, error?: string}>}
 */
export async function getUserActiveOccupancies(userId) {
  if (!supabase) {
    return { success: false, error: 'Supabase non configuré' };
  }

  try {
    const { data, error } = await supabase
      .from('machine_occupancy')
      .select(`
        *,
        machines(name),
        emplacements(name)
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'overdue'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Occupancy] getUserActiveOccupancies error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      occupancies: data || [] 
    };
  } catch (err) {
    console.error('[Occupancy] getUserActiveOccupancies exception:', err);
    return { success: false, error: 'Erreur technique' };
  }
}
