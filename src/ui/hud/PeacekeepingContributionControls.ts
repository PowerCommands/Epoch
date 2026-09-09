export interface PeacekeepingContributionChoice {
  readonly committedUnitNames?: readonly string[];
  readonly contributionUnits?: ReadonlyArray<{ id: string; name: string }>;
  readonly contribute?: (unitIds: string[]) => boolean;
}

/** Shared post-vote and active-resolution choice. Nothing is pledged until Commit is clicked. */
export function buildPeacekeepingContributionControls(choice: PeacekeepingContributionChoice): HTMLElement {
  const root = document.createElement('div');
  const explanation = document.createElement('p');
  explanation.textContent = 'Voluntary peacekeeping: designate units to defend the protected nation for the remaining mandate. Units remain yours; no war is declared. Move your contingent into the protected territory. You may decline without affecting your vote.';
  root.appendChild(explanation);
  if (choice.committedUnitNames?.length) {
    const committed = document.createElement('p'); committed.textContent = `Your peacekeepers: ${choice.committedUnitNames.join(', ')}`; root.appendChild(committed);
  }
  const selected = new Set<string>();
  for (const unit of choice.contributionUnits ?? []) {
    const label = document.createElement('label'); label.style.display = 'block';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
    checkbox.onchange = () => { if (checkbox.checked) selected.add(unit.id); else selected.delete(unit.id); };
    label.append(checkbox, document.createTextNode(unit.name)); root.appendChild(label);
  }
  const commit = document.createElement('button'); commit.textContent = 'Contribute selected units';
  const decline = document.createElement('button'); decline.textContent = 'Decline for now';
  commit.onclick = () => {
    if (choice.contribute?.([...selected])) {
      root.replaceChildren(document.createTextNode('Units committed. Their mandate and temporary access end when the mission ends.'));
    }
  };
  decline.onclick = () => root.replaceChildren(document.createTextNode('No units committed. You can contribute later through active resolutions.'));
  root.append(commit, decline);
  return root;
}
