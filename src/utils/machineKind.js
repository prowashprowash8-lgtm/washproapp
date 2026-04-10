/**
 * Type de machine : lave-linge vs sèche-linge.
 * Priorité à machine_kind (board Supabase), sinon déduction depuis type (legacy).
 */

/** @returns {'lavage'|'sechage'} */
export function getMachineKind(machine) {
  if (!machine) return 'lavage';
  const k = (machine.machine_kind || '').toLowerCase().trim();
  if (k === 'sechage') return 'sechage';
  if (k === 'lavage') return 'lavage';
  const t = (machine.type || '').toLowerCase();
  if (t.includes('sechage') || t.includes('dryer') || t.includes('sèche') || t.includes('seche')) {
    return 'sechage';
  }
  return 'lavage';
}

export function isDryerMachine(machine) {
  return getMachineKind(machine) === 'sechage';
}

/** Libellé court pour l’UI (passer t depuis i18n). */
export function getMachineKindLabel(machine, t) {
  const k = getMachineKind(machine);
  if (k === 'sechage') return t('machineKindDryer');
  return t('machineKindWasher');
}
