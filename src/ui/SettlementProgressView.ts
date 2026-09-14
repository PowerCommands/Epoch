import type { SettlementProgress } from '../systems/SettlementProgress';
import { getBuildingSpritePath, getCitySpritePath } from '../utils/assetPaths';

export function renderSettlementProgress(progress: SettlementProgress): HTMLElement {
  const root = document.createElement('section');
  root.className = 'settlement-progress';
  const text = (tag: string, content: string, parent: HTMLElement = root) => {
    const el = document.createElement(tag); el.textContent = content; parent.append(el); return el;
  };
  const style = document.createElement('style');
  style.textContent = `
    .settlement-progress { padding:12px 16px; color:#dfebef; font-size:14px; }
    .settlement-progress h2 { margin:0 0 6px; color:#e6bf73; font-size:20px; }
    .settlement-progress h3 { margin:8px 0 4px; font-size:15px; }
    .settlement-progress p { margin:4px 0; line-height:1.4; }
    .settlement-progress .development-map { position:relative; width:100%; max-width:360px; aspect-ratio:1.2; margin:8px auto; }
    .settlement-progress .development-tile { position:absolute; width:32%; height:35%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:#243b39; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); font-size:clamp(10px,1.2vw,12px); }
    .settlement-progress .development-tile.water { background:#173e56; }
    .settlement-progress .development-tile img { width:55%; height:50%; object-fit:contain; }
    .settlement-progress .development-tile .empty-space { width:42%; height:35%; border:2px dashed #879a9e; border-radius:8px; margin-bottom:5px; }
    .settlement-progress .development-tile strong { max-width:90%; }
    .settlement-progress .development-tile.complete { background:#2b5245; }
    .settlement-progress .development-tile.center { background:#4b4935; }
    .settlement-progress .development-warning { padding:12px; border:1px solid #d89567; border-radius:8px; color:#ffd0af; }
  `;
  root.append(style);
  text('h2', `${progress.from} → ${progress.to}`);
  if (progress.populationBonus) text('p', `Population capacity +${progress.populationBonus}${!progress.possible ? ' · Unavailable at this location' : progress.stage === progress.to ? ' · Bonus unlocked' : ' when development completes'}`);
  if (!progress.possible) {
    text('p', 'This Village cannot develop into a Town at this location. Its founding geography does not support the six required surrounding tiles. Mountains, ocean, or four or more water tiles prevent development. Research and construction cannot remove this restriction.').className = 'development-warning';
  } else {
    text('p', progress.stage === progress.to ? `${progress.to} development complete. ${progress.to} status is permanent, even if these buildings are later damaged or removed.` : `${progress.completed} / ${progress.slots.length} buildings complete. Your ${progress.from} becomes a ${progress.to} automatically when all required buildings are finished.`);
  }
  if (!progress.spatial) {
    text('p', 'Build these six requirements anywhere on normally valid tiles in this settlement’s territory. No arrangement or construction order is required.');
    text('p', progress.slots.map(slot => slot.complete ? '■' : '□').join(' ')).setAttribute('aria-label', `${progress.completed} of six requirements completed`);
    const slots = text('div', '', root); slots.className = 'development-requirements';
    slots.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:16px 0';
    for (const slot of progress.slots) {
      const el = text('div', `${slot.complete ? '■' : '□'} ${slot.name}`, slots);
      el.title = `${slot.name}: ${slot.complete ? slot.broken ? 'Complete (damaged)' : 'Complete' : 'Missing'}${slot.missingTech ? ` · Requires ${slot.missingTech}` : ''}`;
      el.setAttribute('aria-label', el.title);
      el.style.color = slot.complete ? '#b7dc9b' : '#a8b4bc';
    }
  } else {
    const map = document.createElement('div'); map.className = 'development-map'; root.append(map);
    const positions = [[17,0],[51,0],[68,30],[51,60],[17,60],[0,30]];
    const tile = (x: number, y: number, name: string, sprite: string | undefined, status: string, classes: string) => {
      const el = document.createElement('div'); el.className = `development-tile ${classes}`;
      el.style.left = `${x}%`; el.style.top = `${y}%`;
      if (sprite) { const img = document.createElement('img'); img.src = sprite; img.alt = ''; el.append(img); }
      else { const space = document.createElement('div'); space.className = 'empty-space'; el.append(space); }
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${name}: ${status}`);
      text('strong', name, el); map.append(el);
    };
    tile(34,30,progress.stage,getCitySpritePath('ancient'),'Settlement','center');
    progress.slots.forEach((slot,i) => tile(positions[i][0], positions[i][1], slot.name,
      slot.complete && slot.spriteId ? getBuildingSpritePath(slot.spriteId, slot.broken) : undefined,
      slot.complete ? '✓ Complete' : slot.buildingId ? 'Empty space' : 'Blocked', `${slot.water ? 'water' : ''} ${slot.complete ? 'complete' : ''}`));
  }
  if (progress.possible) {
    if (progress.stage !== progress.to) {
      text('h3', 'Research still needed');
      for (const slot of progress.slots) if (slot.alternativeTechs.length) {
        text('p', `${slot.name} research: ${slot.alternativeTechs.join(' OR ')}. Only one route is needed.`);
      }
      text('p', progress.missingTechs.length ? 'Missing technologies, including prerequisites: ' + progress.missingTechs.map(t => t.name).join(' · ') : progress.slots.some(slot => slot.alternativeTechs.length) ? 'Other required technologies have been researched.' : 'All required technologies have been researched.');
    }
  }
  return root;
}
