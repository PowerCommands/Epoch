import type { ScenarioData } from '../types/scenario';
import type { MutualFoeAgreement } from '../types/mutualFoe';
import { mutualFoeLeaderOptions, newMutualFoeAgreement, removeMutualFoeAgreement, validateMutualFoeAgreements } from './mutualFoeEditorModel';

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); if (text) el.textContent = text; return el;
};
function button(text: string, action: () => void): HTMLButtonElement {
  const b = node('button', text); b.type = 'button'; b.onclick = action; return b;
}

function open(scenario: ScenarioData, onApply: () => void): void {
  // Invalid external definitions remain visible/removable, but cannot be applied.
  let drafts: MutualFoeAgreement[] = Array.isArray(scenario.mutualFoeAgreements)
    ? structuredClone(scenario.mutualFoeAgreements).filter(a => a && typeof a === 'object') : [];
  let selected = 0;
  const dialog = node('dialog'); dialog.className = 'mf-dialog'; dialog.setAttribute('aria-label', 'Mutual Foe Agreements');
  const style = node('style'); style.textContent = `
.mf-dialog{margin:auto;width:min(850px,92vw);max-height:88vh;overflow:auto;background:#222;color:#eee;border:1px solid #666;border-radius:6px;padding:24px;font:14px Arial,sans-serif}.mf-dialog::backdrop{background:#000a}.mf-dialog button,.mf-dialog input,.mf-dialog select{background:#333;color:#eee;border:1px solid #666;border-radius:3px;padding:8px;font:inherit}.mf-dialog button{cursor:pointer}.mf-dialog nav,.mf-actions{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.mf-dialog nav button[aria-current=true]{border-color:#a6d5b4;background:#32443a}.mf-dialog label{display:block;margin:14px 0}.mf-dialog label>input:not([type=checkbox]),.mf-dialog label>select{display:block;box-sizing:border-box;width:100%;margin-top:6px}.mf-dialog fieldset{max-height:280px;overflow:auto;border:1px solid #555}.mf-dialog fieldset label{margin:10px}.mf-dialog p{line-height:1.5;color:#bbb}.mf-errors{color:#ffb3a7;white-space:pre-wrap}.mf-dialog input[type=checkbox]{margin-right:10px}
`;
  const nav = node('nav'); nav.setAttribute('aria-label', 'Agreements');
  const main = node('div'); const errors = node('div'); errors.className = 'mf-errors'; errors.setAttribute('role', 'alert');
  const actions = node('div'); actions.className = 'mf-actions';
  actions.append(button('Cancel', () => dialog.close()), button('Apply to Scenario', () => {
    const result = validateMutualFoeAgreements(drafts, scenario.nations);
    errors.textContent = result.errors.join('\n');
    if (result.errors.length) return;
    scenario.mutualFoeAgreements = result.agreements;
    onApply(); dialog.close();
  }));
  dialog.append(style, node('h2', 'Mutual Foe Agreements'), node('p', 'Protect specific signatory governments against one antagonist nation. Members provide economic support; this agreement does not make them join the war.'), nav, main, errors, actions);
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();

  function render(): void {
    nav.replaceChildren(); main.replaceChildren(); errors.textContent = '';
    drafts.forEach((a, i) => {
      const b = button(a.name || a.id || `Agreement ${i + 1}`, () => { selected = i; render(); });
      b.setAttribute('aria-current', String(i === selected)); nav.append(b);
    });
    nav.append(button('Create Agreement', () => { drafts.push(newMutualFoeAgreement(drafts)); selected = drafts.length - 1; render(); }));
    const a = drafts[selected];
    if (!a) { main.append(node('p', 'No agreements defined. Create one to select its antagonist and signatory leaders.')); return; }
    const field = (title: string, control: HTMLElement): void => {
      const label = node('label', title); control.setAttribute('aria-label', title); label.append(control); main.append(label);
    };
    const id = node('input'); id.value = a.id ?? ''; id.readOnly = true; field('Agreement ID', id);
    const name = node('input'); name.value = a.name ?? ''; name.oninput = () => { a.name = name.value; }; field('Agreement name', name);
    const antagonist = node('select'); antagonist.append(new Option('Select antagonist nation…', ''));
    for (const n of scenario.nations) antagonist.append(new Option(n.name, n.id));
    antagonist.value = a.antagonistNationId ?? '';
    antagonist.onchange = () => {
      a.antagonistNationId = antagonist.value;
      const allowed = new Set(mutualFoeLeaderOptions(scenario.nations).filter(l => l.nationId !== a.antagonistNationId).map(l => l.id));
      a.memberLeaderIds = (Array.isArray(a.memberLeaderIds) ? a.memberLeaderIds : []).filter(id => allowed.has(id));
      render();
    }; field('Antagonist nation', antagonist);
    const percent = node('input'); percent.type = 'number'; percent.min = '0'; percent.max = '100'; percent.step = 'any'; percent.value = String(a.supportPercent ?? '');
    percent.oninput = () => { a.supportPercent = percent.valueAsNumber; }; field('Support (%)', percent);
    main.append(node('p', 'One shared percentage of each eligible supporter’s Gold reserve at activation and positive net Gold/turn thereafter.'));
    const members = node('fieldset'); members.append(node('legend', 'Member leaders — at least two, one per nation'));
    const options = mutualFoeLeaderOptions(scenario.nations).filter(l => l.nationId !== a.antagonistNationId);
    const selectedIds = Array.isArray(a.memberLeaderIds) ? a.memberLeaderIds : [];
    for (const l of options) {
      const row = node('label'); const check = node('input'); check.type = 'checkbox'; check.checked = selectedIds.includes(l.id);
      check.disabled = !check.checked && selectedIds.some(id => options.some(other => other.id === id && other.nationId === l.nationId));
      check.onchange = () => { a.memberLeaderIds = check.checked ? [...selectedIds, l.id] : selectedIds.filter(id => id !== l.id); render(); };
      row.append(check, document.createTextNode(l.label)); members.append(row);
    }
    for (const id of selectedIds.filter(id => !options.some(l => l.id === id))) {
      members.append(button(`Remove unavailable member: ${id}`, () => { a.memberLeaderIds = selectedIds.filter(value => value !== id); render(); }));
    }
    main.append(members, button('Remove Agreement', () => { drafts = removeMutualFoeAgreement(drafts, a.id); selected = Math.max(0, selected - 1); render(); }));
  }
  render();
}

declare global {
  interface Window {
    EpochMutualFoeEditor: {
      open: typeof open;
      validate: (scenario: ScenarioData) => string[];
    };
  }
}
window.EpochMutualFoeEditor = { open, validate: scenario => validateMutualFoeAgreements(scenario.mutualFoeAgreements, scenario.nations).errors };
