import type { Unit } from '../entities/Unit';
import type { City } from '../entities/City';
import { CITY_BASE_DEFENSE } from '../data/cities';

export interface CombatResult {
  attackerDamageTaken: number;
  defenderDamageTaken: number;
  attackerDied: boolean;
  defenderDied: boolean;
}

export interface CityCombatResult {
  attackerDamageTaken: number;
  cityDamageTaken: number;
  attackerDied: boolean;
  cityFell: boolean;
}

/**
 * Ren funktion: beräknar stridsutfall deterministiskt.
 * Inga sidoeffekter — mutation sker i CombatSystem.
 *
 * Formel:
 * - Attackerarens skada = baseStrength * (currentHP / baseHealth)
 * - Försvararens motskada = baseStrength * 0.6 * (currentHP / baseHealth)
 *   (försvararen slår tillbaka mjukare)
 */
export function resolveCombat(attacker: Unit, defender: Unit): CombatResult {
  const attackerHpRatio = attacker.health / attacker.unitType.baseHealth;
  const defenderHpRatio = defender.health / defender.unitType.baseHealth;

  const damageToDefender = Math.round(attacker.unitType.baseStrength * attackerHpRatio);
  const damageToAttacker = Math.round(defender.unitType.baseStrength * 0.6 * defenderHpRatio);

  const newAttackerHp = Math.max(0, attacker.health - damageToAttacker);
  const newDefenderHp = Math.max(0, defender.health - damageToDefender);

  return {
    attackerDamageTaken: damageToAttacker,
    defenderDamageTaken: damageToDefender,
    attackerDied: newAttackerHp <= 0,
    defenderDied: newDefenderHp <= 0,
  };
}

/**
 * Ranged unit vs unit: attacker deals damage, no counter-attack.
 */
export function resolveRangedCombat(attacker: Unit, defender: Unit): CombatResult {
  const attackerHpRatio = attacker.health / attacker.unitType.baseHealth;
  const damageToDefender = Math.round(attacker.unitType.baseStrength * attackerHpRatio);
  const newDefenderHp = Math.max(0, defender.health - damageToDefender);

  return {
    attackerDamageTaken: 0,
    defenderDamageTaken: damageToDefender,
    attackerDied: false,
    defenderDied: newDefenderHp <= 0,
  };
}

/**
 * Ranged unit vs city: attacker deals damage, no counter-attack.
 */
export function resolveRangedVsCity(attacker: Unit, city: City): CityCombatResult {
  const attackerHpRatio = attacker.health / attacker.unitType.baseHealth;
  const damageToCity = Math.round(attacker.unitType.baseStrength * attackerHpRatio);
  const newCityHp = Math.max(0, city.health - damageToCity);

  return {
    attackerDamageTaken: 0,
    cityDamageTaken: damageToCity,
    attackerDied: false,
    cityFell: newCityHp <= 0,
  };
}

/**
 * Ren funktion: beräknar strid mellan enhet och stad.
 *
 * Staden slår tillbaka med fast defense oavsett HP.
 * Multiplikator 0.5 gör stadsattacker mindre dödliga för attackeraren.
 */
export function resolveUnitVsCity(attacker: Unit, city: City): CityCombatResult {
  const attackerHpRatio = attacker.health / attacker.unitType.baseHealth;

  const damageToCity = Math.round(attacker.unitType.baseStrength * attackerHpRatio);
  const damageToAttacker = Math.round(CITY_BASE_DEFENSE * 0.5);

  const newCityHp = Math.max(0, city.health - damageToCity);
  const newAttackerHp = Math.max(0, attacker.health - damageToAttacker);

  return {
    attackerDamageTaken: damageToAttacker,
    cityDamageTaken: damageToCity,
    attackerDied: newAttackerHp <= 0,
    cityFell: newCityHp <= 0,
  };
}
