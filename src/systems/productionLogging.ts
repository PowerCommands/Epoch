/** Canonical gameplay-log sentence for a successfully completed building. */
export function formatBuildingCompletionMessage(
  nationName: string,
  buildingName: string,
  cityName: string,
): string {
  return `${nationName} completed ${buildingName} in ${cityName}.`;
}
