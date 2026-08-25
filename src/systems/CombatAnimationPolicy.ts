/** Camera impact effects are relevant only when the human nation is fighting. */
export function isHumanInvolvedInCombat(
  humanNationId: string | undefined,
  attackerNationId: string,
  defenderNationId: string,
): boolean {
  return humanNationId !== undefined
    && (attackerNationId === humanNationId || defenderNationId === humanNationId);
}
