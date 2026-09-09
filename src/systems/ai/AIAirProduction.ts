export interface AirProductionPriority {
  kind: 'unit' | 'building';
  id: string;
  desired: number;
  score: number;
}

/** Candidate hints only; existing technology, resource, upkeep and doctrine gates remain authoritative. */
export function planAirProduction(context: {
  capacity: number;
  used: number;
  cityCount: number;
  enemyAir: boolean;
  unitUnlocked: (id: string) => boolean;
}): AirProductionPriority[] {
  const result: AirProductionPriority[] = [];
  if (!context.unitUnlocked('triplane')) return result;
  if (context.capacity === 0) result.push({ kind: 'building', id: 'airfield', desired: 1, score: 90 });
  else if (context.capacity < 4 && context.used >= context.capacity) {
    result.push({ kind: 'building', id: 'air_base', desired: 1, score: 85 });
  }
  if (context.capacity > context.used) {
    const fighter = ['jet_fighter', 'fighter', 'triplane'].find(context.unitUnlocked);
    const bomber = ['stealth_bomber', 'bomber', 'great_war_bomber'].find(context.unitUnlocked);
    if (fighter) result.push({ kind: 'unit', id: fighter, desired: context.cityCount, score: context.enemyAir ? 105 : 80 });
    if (bomber) result.push({ kind: 'unit', id: bomber, desired: context.cityCount, score: 90 });
  }
  if (context.enemyAir) {
    const defense = ['mobile_sam', 'anti_aircraft_gun'].find(context.unitUnlocked);
    if (defense) result.push({ kind: 'unit', id: defense, desired: context.cityCount, score: 100 });
  }
  return result;
}
