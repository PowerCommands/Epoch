import * as model from './leaderEditorModel';
import { label, parameterHelp } from './leaderParameterHelp';
import type { LeaderConfiguration, LeaderOverride } from '../data/leaderConfiguration';
import type { ScenarioData } from '../types/scenario';
import type { Era } from '../data/technologies';

type Kind = model.ProfileKind;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e;
};
function button(text: string, action: () => void) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
function select(options: { id: string; name: string }[], value: string, change: (v: string) => void) {
  const s = node('select');
  if (value && !options.some(o => o.id === value)) options = [{ id: value, name: `Unknown: ${value}` }, ...options];
  for (const o of options) { const option = node('option', o.name); option.value = o.id; s.append(option); }
  s.value = value; s.onchange = () => change(s.value); return s;
}
function open(scenario: ScenarioData, onApply: () => void) {
  let config: LeaderConfiguration = clone(scenario.leaderConfiguration ?? { version: 1 });
  const nations = clone(scenario.nations);
  let kind: 'leaders' | Kind = 'leaders';
  let selected = model.catalog.leaders[0].id;
  let query = '';
  let era: Era = 'ancient';
  const expanded = new Set(['Personality', 'Strategic Identity']);
  const dialog = node('dialog', undefined, 'le-dialog');
  const style = node('style'); style.textContent = `
.le-dialog{margin:auto;color:#ddd;background:#202020;border:1px solid #666;border-radius:6px;width:min(1250px,94vw);height:90vh;padding:0;font:13px Arial,sans-serif}.le-dialog::backdrop{background:#000a}.le-shell{display:flex;flex-direction:column;height:100%}.le-head,.le-foot{padding:14px;display:flex;gap:12px;align-items:center;background:#292929;flex-wrap:wrap}.le-head strong{font-size:18px}.le-body{display:flex;flex:1;min-height:0}.le-side{width:240px;flex-shrink:0;overflow:auto;padding:12px;border-right:1px solid #444}.le-side>button{display:block;width:100%;text-align:left;margin:4px 0}.le-main{flex:1;overflow:auto;padding:20px;min-width:0}.le-dialog button,.le-dialog select,.le-dialog input,.le-dialog textarea{background:#303030;color:#eee;border:1px solid #555;border-radius:3px;padding:7px;font:inherit}.le-dialog button{cursor:pointer}.le-dialog button:hover,.le-dialog button[aria-current=true]{border-color:#93b9a0;background:#32443a}.le-dialog input:not([type=checkbox]),.le-dialog textarea{box-sizing:border-box;width:100%}.le-dialog select{max-width:100%}.le-dialog textarea{min-height:65px;resize:vertical}.le-field{display:grid;grid-template-columns:minmax(150px,1fr) minmax(150px,1.6fr) auto;gap:8px;padding:10px 0;border-bottom:1px solid #353535;align-items:start}.le-field small{display:block;color:#aaa;margin-top:5px;line-height:1.4}.le-help{color:#aaa;line-height:1.6}.le-dialog details{border:1px solid #444;border-radius:4px;padding:12px;margin:12px 0}.le-dialog summary{cursor:pointer;font-size:15px;color:#eee}.le-errors{color:#ffb3a7;max-height:130px;overflow:auto;white-space:pre-wrap;flex:1}.le-badge{color:#b7d9bb;font-size:11px}.le-summary{padding:12px;background:#29372e;line-height:1.7}.le-links{display:flex;gap:6px;flex-wrap:wrap}.le-portrait{width:80px;height:80px;object-fit:cover;float:right}.le-foot{border-top:1px solid #444}.le-side input{margin-bottom:8px}@media(max-width:750px){.le-side{width:150px}.le-field{grid-template-columns:1fr}.le-main{padding:10px}}
`;
  const shell = node('div', undefined, 'le-shell');
  const head = node('div', undefined, 'le-head');
  head.append(node('strong', 'Leaders & AI'), node('span', 'Scenario overrides · built-in defaults stay shared', 'le-help'));
  const tabs = select([{ id: 'leaders', name: 'Leaders' }, ...Object.keys(model.catalog.profiles).map(id => ({ id, name: id === 'strategies' ? 'Base AI Strategies' : label(id) }))], kind, v => { kind = v as typeof kind; selected = kind === 'leaders' ? model.catalog.leaders[0].id : model.profiles(config, kind)[0].id; query = ''; render(); });
  head.append(tabs);
  const body = node('div', undefined, 'le-body'); const side = node('aside', undefined, 'le-side'); const main = node('main', undefined, 'le-main'); body.append(side, main);
  const foot = node('div', undefined, 'le-foot'); const errors = node('div', undefined, 'le-errors'); errors.setAttribute('role', 'status');
  foot.append(errors, button('Discard / Close', () => dialog.close()), button('Apply to Scenario', () => {
    const issues = model.validateConfiguration(config, nations);
    if (issues.length) { errors.textContent = issues.join('\n'); return; }
    scenario.leaderConfiguration = clone(config);
    // Preserve unrelated map/editor nation changes; only copy leader-specific settings.
    for (const target of scenario.nations) {
      const edited = nations.find(n => n.id === target.id); if (!edited) continue;
      for (const field of ['leaderId', 'leaderName', 'leaderDescription', 'aiNationalAgendaId', 'covertPersonalityId', 'aiStrategyId'] as const) {
        if (edited[field] === undefined) delete target[field]; else (target as any)[field] = edited[field];
      }
    }
    onApply(); dialog.close();
  }));
  shell.append(head, body, foot); dialog.append(style, shell); document.body.append(dialog);
  dialog.onclose = () => dialog.remove(); dialog.showModal();
  function jump(k: typeof kind, id: string) { kind = k; selected = id; query = ''; tabs.value = k; render(); }
  function section(title: string, help?: string) {
    const d = node('details'); d.dataset.section = title; d.open = expanded.has(title); d.ontoggle = () => { if (!d.isConnected) return; if (d.open) expanded.add(title); else expanded.delete(title); };
    d.append(node('summary', title)); if (help) d.append(node('p', help, 'le-help')); main.append(d); return d;
  }
  function field(parent: HTMLElement, title: string, input: HTMLElement, help = '', source = '', reset?: () => void) {
    const row = node('div', undefined, 'le-field'); const text = node('label', title); const controlId = `le-${Math.random().toString(36).slice(2)}`; input.id = controlId; input.setAttribute('aria-label', title); text.htmlFor = controlId;
    if (help) text.append(node('small', help)); const control = node('div'); control.append(input); if (source) control.append(node('small', source, 'le-badge')); row.append(text, control); if (reset) row.append(button('Reset', reset)); parent.append(row);
  }
  function textInput(value: string, change: (v: string) => void, multiline = false) {
    const input = multiline ? node('textarea') : node('input'); input.value = value; input.onchange = () => change(input.value); return input;
  }
  function patchLeader(path: string[], value: any, reset = false) {
    config.leaders ??= {}; config.leaders[selected] ??= {};
    let target: any = config.leaders[selected];
    for (const key of path.slice(0, -1)) target = target[key] ??= {};
    if (reset) delete target[path[path.length - 1]]; else target[path[path.length - 1]] = value;
    render();
  }
  function render() {
    for (const details of main.querySelectorAll<HTMLDetailsElement>('details[data-section]')) {
      if (details.open) expanded.add(details.dataset.section!); else expanded.delete(details.dataset.section!);
    }
    errors.textContent = model.validateConfiguration(config, nations).join('\n');
    side.replaceChildren(); main.replaceChildren();
    const search = node('input'); search.placeholder = 'Search names, nations, profiles…'; search.value = query; search.setAttribute('aria-label', 'Search leaders or profiles');
    search.oninput = () => { query = search.value; renderList(); }; side.append(search);
    const list = node('div'); side.append(list);
    function renderList() {
      list.replaceChildren();
      const items = kind === 'leaders' ? model.catalog.leaders.map(l => model.effectiveLeader(config, l.id)) : model.profiles(config, kind);
      for (const item of items) {
        if (!JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) continue;
        const b = button(item.name, () => { selected = item.id; render(); }); b.setAttribute('aria-current', String(selected === item.id)); b.style.cssText = 'display:block;width:100%;text-align:left;margin:5px 0'; list.append(b);
      }
    }
    renderList();
    if (kind === 'leaders') renderLeader(); else renderProfile(kind);
  }
  function renderLeader() {
    const base = model.catalog.leaders.find(l => l.id === selected)!;
    const leader = model.effectiveLeader(config, selected);
    const patch = config.leaders?.[selected];
    const { id: _id, nationId: _nation, isDefault: _default, ...defaultPatch } = base;
    const defaultIssues = model.validateConfiguration({ version: 1, leaders: { [selected]: defaultPatch } });
    if (defaultIssues.length) main.append(node('p', `Built-in diagnostic: ${defaultIssues.join('; ')}`, 'le-errors'));
    const image = node('img', undefined, 'le-portrait'); image.src = leader.image; image.alt = leader.name; main.append(image, node('h2', leader.name));
    main.append(node('p', `${model.catalog.nations.find(n => n.id === leader.nationId)?.name ?? leader.nationId} · ${base.isDefault ? 'Default leader' : 'Alternative leader'} · ${selected}`, 'le-help'));
    main.append(button('Reset all leader overrides', () => { delete config.leaders?.[selected]; delete config.eraAssignments?.[selected]; delete config.warDeclarations?.[selected]; render(); }));
    const source = (key: keyof LeaderOverride) => patch?.[key] !== undefined ? 'Scenario Override' : base[key] !== undefined ? 'Explicit · Built-in Default' : 'Inherited · Runtime Default';
    const p = leader.aiPersonality;
    const traits = [p.aggressionBias > 0 ? 'Aggressive' : p.aggressionBias < 0 ? 'Defensive' : 'Neutral aggression', p.expansionBias > 0 ? 'Expansionist' : '', p.cultureBias > 0 ? 'Culture-minded' : '', p.economyBias > 0 ? 'Economy-minded' : ''].filter(Boolean);
    const eraInfo = model.effectiveEra(config, selected, era);
    const profileName = (k: Kind, id: string) => model.profiles(config, k).find(p => p.id === id)?.name ?? `Unknown: ${id}`;
    const activeNation = nations.find(n => n.id === leader.nationId && (n.leaderId ?? model.catalog.leaders.find(l => l.nationId === n.id && l.isDefault)?.id) === selected);
    const summaryCovert = activeNation?.covertPersonalityId ?? leader.covertPersonalityId;
    const summaryAgenda = activeNation?.aiNationalAgendaId ?? leader.aiNationalAgendaId;
    const summary = node('div', undefined, 'le-summary');
    summary.append(node('div', `Strategic character: ${traits.join(' / ')}`), node('div', `Diplomacy: ${p.diplomacyBias < 0 ? 'Low' : p.diplomacyBias > 0 ? 'High' : 'Neutral'} cooperation · ${p.warTolerance >= 60 ? 'High' : p.warTolerance <= 40 ? 'Low' : 'Moderate'} war tolerance`), node('div', `Military: ${profileName('doctrines', leader.aiMilitaryDoctrineId)} · Covert: ${profileName('covert', summaryCovert)} · Ideology: ${profileName('ideologies', leader.ideologyId)}`), node('div', `Era strategy: ${profileName('eraStrategies', eraInfo.id)} · ${eraInfo.source}`));
    summary.append(node('div', `Agenda: ${profileName('agendas', summaryAgenda)}${activeNation?.aiNationalAgendaId ? ' · Scenario Nation Override' : ''}`));
    if (activeNation?.covertPersonalityId) summary.append(node('div', 'Covert source: Scenario Nation Override'));
    summary.append(select(model.catalog.eras.map(e => ({ id: e.era, name: label(e.era) })), era, v => { era = v as Era; render(); })); main.append(summary);
    const identity = section('Identity', 'Names and descriptions in the older Nation Details panel take precedence for the selected scenario nation. Nation membership and built-in default status remain canonical.');
    for (const key of ['name', 'title', 'description', 'image'] as const) field(identity, key === 'image' ? 'Portrait URL' : label(key), textInput(leader[key] ?? '', v => patchLeader([key], v), key === 'description'), '', source(key), () => patchLeader([key], undefined, true));
    const personality = section('Personality', 'Biases are additive scores, not percentages. Neutral bias is 0. Editor bias bounds are −100 to 100; gameplay previously imposed no bounds on these scores.');
    for (const [key, spec] of Object.entries(model.personalityFields)) {
      const [min, max, step, title, help] = spec; const value = p[key as keyof typeof p] ?? 1;
      const input = node('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      input.onchange = () => patchLeader(['aiPersonality', key], input.value === '' ? NaN : Number(input.value));
      const interpretation = key.endsWith('Bias') ? (value >= 20 ? 'Strong preference' : value > 0 ? 'Positive preference' : value < 0 ? 'Discouraged' : 'Neutral') : key === 'casualtyToleranceRatio' ? `${Math.round(value * 100)}% of starting strength` : '';
      field(personality, title, input, `${help} Range: ${min}–${max}. ${interpretation}`, patch?.aiPersonality?.[key as keyof typeof p] !== undefined ? 'Scenario Override' : base.aiPersonality?.[key as keyof typeof p] !== undefined ? 'Explicit · Built-in Default' : 'Inherited · Runtime Default', () => patchLeader(['aiPersonality', key], undefined, true));
    }
    const strategic = section('Strategic Identity');
    for (const [k, key] of Object.entries(model.profileLeaderFields) as [keyof typeof model.profileLeaderFields, typeof model.profileLeaderFields[keyof typeof model.profileLeaderFields]][]) {
      const options = model.profiles(config, k); const value = leader[key]; const def = options.find(p => p.id === value);
      field(strategic, label(k), select(options, value, v => patchLeader([key], v)), def?.description ?? 'Unknown reference', source(key) + (key === 'covertPersonalityId' && !base[key] && !patch?.[key] ? ' · Leader-specific covert mapping, then pragmatist' : ''), () => patchLeader([key], undefined, true));
      strategic.append(button(`Inspect ${def?.name ?? value} · Used by ${model.profileUsers(config, k, value, nations).length}`, () => jump(k, value)));
    }
    const cityLimit = node('input'); cityLimit.type = 'number'; cityLimit.min = '1'; cityLimit.step = '1'; cityLimit.value = leader.maxPreferredCities?.toString() ?? ''; cityLimit.placeholder = 'No leader cap'; cityLimit.onchange = () => patchLeader(['maxPreferredCities'], Number(cityLimit.value), !cityLimit.value);
    field(strategic, 'Voluntary City Limit', cityLimit, 'Caps settlers and overseas expansion. Conquest, treaties, gifts and events can exceed the cap.', source('maxPreferredCities'), () => patchLeader(['maxPreferredCities'], undefined, true));
    strategic.append(button('Remove leader city cap', () => patchLeader(['maxPreferredCities'], null)));
    const timeline = section('Era Strategy', 'Assignments remain active until replaced by a later era. Remove an assignment to inherit from the nearest earlier era; without one, Balanced Growth applies. Eras follow the nation’s researched technology progression, not a fixed scenario date.');
    timeline.append(button('Reset timeline to built-in', () => { delete config.eraAssignments?.[selected]; render(); }));
    const map = model.assignments(config, selected);
    for (const e of model.catalog.eras) {
      const effective = model.effectiveEra(config, selected, e.era);
      field(timeline, label(e.era), select([{ id: '', name: 'Inherit earlier / default' }, ...model.profiles(config, 'eraStrategies')], map[e.era] ?? '', v => {
        config.eraAssignments ??= {}; config.eraAssignments[selected] ??= clone(map);
        if (v) (config.eraAssignments[selected] as any)[e.era] = v; else delete config.eraAssignments[selected][e.era]; render();
      }), `${profileName('eraStrategies', effective.id)} · ${effective.source}`, config.eraAssignments?.[selected] ? 'Scenario timeline' : 'Built-in timeline');
      timeline.append(button(`Inspect ${profileName('eraStrategies', effective.id)}`, () => jump('eraStrategies', effective.id)));
    }
    const culture = section('Culture Priorities', 'Preferred nodes receive a culture selection bonus; their list order does not change the bonus. These do not grant culture nodes at scenario start.');
    const priorities = leader.culturePriorities ?? [];
    priorities.forEach((id, i) => {
      const n = model.catalog.cultures.find(n => n.id === id); const row = node('div', undefined, 'le-links'); row.append(node('p', `${i + 1}. ${n?.name ?? `Unknown: ${id}`} · ${n?.era ?? ''}`), button('Remove', () => patchLeader(['culturePriorities'], priorities.filter((_, j) => j !== i))));
      if (i > 0) row.append(button('Move up', () => { const values = [...priorities]; [values[i - 1], values[i]] = [values[i], values[i - 1]]; patchLeader(['culturePriorities'], values); })); culture.append(row);
    });
    const cultureSearch = node('input'); cultureSearch.placeholder = 'Filter culture nodes…'; cultureSearch.setAttribute('aria-label', 'Filter culture priorities'); const culturePicker = node('div');
    const updateCultures = () => { culturePicker.replaceChildren(select([{ id: '', name: 'Add culture priority…' }, ...model.catalog.cultures.filter(n => !priorities.includes(n.id) && `${n.name} ${n.era}`.toLowerCase().includes(cultureSearch.value.toLowerCase())).map(n => ({ id: n.id, name: `${n.name} · ${label(n.era)}` }))], '', v => { if (v) patchLeader(['culturePriorities'], [...priorities, v]); })); }; cultureSearch.oninput = updateCultures; updateCultures(); culture.append(cultureSearch, culturePicker, button('Reset culture priorities', () => patchLeader(['culturePriorities'], undefined, true)));
    const sports = section('Games of Nations', 'Favorite sports influence Games preferences and gossip. Categories use the canonical sport definitions.');
    for (const [key, category] of [['traditionalFavourite', 'traditional'], ['additionalFavourite', 'additional']] as const) field(sports, `${label(category)} Favorite`, select(model.catalog.sports.filter(s => s.category === category), leader.gamesOfNationsPreferences[key], v => patchLeader(['gamesOfNationsPreferences'], { ...leader.gamesOfNationsPreferences, [key]: v })), '', source('gamesOfNationsPreferences'));
    sports.append(button('Reset sports', () => patchLeader(['gamesOfNationsPreferences'], undefined, true)));
    const flavor = section('Diplomacy Flavor', 'These seven metadata lines are currently descriptive only. Actual AI war announcements use the reason-specific phrase library below, after the AI has already decided to declare war.');
    for (const key of ['greeting', 'friendly', 'neutral', 'hostile', 'warDeclaration', 'victory', 'defeat'] as const) field(flavor, label(key), textInput(leader.diplomacyFlavor?.[key] ?? '', v => patchLeader(['diplomacyFlavor'], { ...leader.diplomacyFlavor, [key]: v }), true));
    flavor.append(button('Reset diplomacy flavor', () => patchLeader(['diplomacyFlavor'], undefined, true)));
    const war = section('War Declaration Phrases', 'Two deterministic alternatives per reason. These lines flavor a completed war decision and do not alter war willingness.');
    const phrases = model.warPhrases(config, selected);
    for (const [reason, lines] of Object.entries(phrases)) lines.forEach((line, i) => field(war, `${label(reason)} ${i + 1}`, textInput(line, v => { config.warDeclarations ??= {}; const updated: any = clone(phrases); updated[reason][i] = v; config.warDeclarations[selected] = updated; render(); }, true), '', model.warPhraseSource(config, selected)));
    war.append(button('Reset war phrases', () => { delete config.warDeclarations?.[selected]; render(); }));
    const national = section('Scenario Nation & Inherited Rules', 'Nation-specific starting settings are independent of a leader. Base strategies can be reselected during play. Unit availability, nation metadata, starting technology/culture, ideology compatibility, gossip rules, and global diplomacy thresholds remain in their existing systems.');
    const nation = nations.find(n => n.id === leader.nationId);
    if (!nation) national.append(node('p', 'This nation is not present in the scenario. Leader tuning is retained and applies if the nation/leader is added or selected later.'));
    else {
      const active = nation.leaderId ?? model.catalog.leaders.find(l => l.nationId === nation.id && l.isDefault)!.id;
      national.append(node('p', `Scenario selection: ${model.effectiveLeader(config, active).name}`));
      national.append(button('Use this leader for this nation', () => { if (base.isDefault) delete nation.leaderId; else nation.leaderId = selected; render(); }));
      for (const [key, k] of [['aiNationalAgendaId', 'agendas'], ['covertPersonalityId', 'covert'], ['aiStrategyId', 'strategies']] as const) field(national, label(key.replace('ai', '')), select([{ id: '', name: key === 'aiStrategyId' ? 'Default: Baseline (runtime can reselect)' : 'Use selected leader' }, ...model.profiles(config, k)], nation[key] ?? '', v => { if (v) (nation as any)[key] = v; else delete nation[key]; render(); }), 'A nation override takes precedence over the selected leader.', nation[key] ? 'Scenario Nation Override' : 'Inherited');
      for (const key of ['leaderName', 'leaderDescription'] as const) field(national, label(key), textInput(nation[key] ?? '', v => { if (v.trim()) nation[key] = v; else delete nation[key]; render(); }, key === 'leaderDescription'), 'Legacy nation override; blank uses the selected leader.');
      if (active === selected && (nation.aiNationalAgendaId || nation.covertPersonalityId || nation.leaderName || nation.leaderDescription)) main.prepend(node('p', 'Scenario nation overrides are active. Open “Scenario Nation & Inherited Rules” to inspect the values taking precedence.', 'le-summary'));
    }
  }
  function renderProfile(k: Kind) {
    const profile = model.profiles(config, k).find(p => p.id === selected);
    if (!profile) { main.append(node('p', `Unknown profile ${selected}. Choose a valid definition from the list.`)); return; }
    main.append(node('h2', profile.name), node('p', `${selected} · ${config.profiles?.[k]?.some(p => p.id === selected) ? 'Scenario Override / Variant' : 'Built-in Default'}`, 'le-badge'));
    const users = model.profileUsers(config, k, selected, nations);
    main.append(node('p', `This shared definition is used by ${users.length} leaders${k === 'strategies' ? ' as a potential runtime choice' : ''}. Changes affect all users in this scenario.`, 'le-summary'));
    const used = section('Used by'); used.open = true; used.style.maxHeight = '240px'; used.style.overflow = 'auto';
    for (const user of users) { const row = node('div'); row.append(button(user.leader.name, () => jump('leaders', user.leader.id)), node('small', ` ${user.detail}`, 'le-help')); used.append(row); }
    const actions = node('div', undefined, 'le-links'); main.append(actions);
    actions.append(button('Reset / Remove scenario definition', () => { if (config.profiles?.[k]) (config.profiles as any)[k] = config.profiles[k]!.filter(p => p.id !== selected); render(); }));
    if (k !== 'ideologies' && k !== 'strategies') {
      const idInput = node('input'); idInput.placeholder = 'New variant ID'; idInput.setAttribute('aria-label', 'New variant ID');
      actions.append(idInput, button('Duplicate / Create Variant', () => {
        const id = idInput.value.trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(id) || model.profiles(config, k).some(p => p.id === id)) { errors.textContent = 'Enter a unique ID using letters, numbers, underscores or hyphens.'; return; }
        config.profiles ??= {}; (config.profiles as any)[k] ??= []; (config.profiles[k] as any[]).push({ ...clone(profile), id, name: `${profile.name} Variant` }); selected = id; render();
      }));
      main.append(node('p', 'Create a variant, then select it in a leader’s Strategic Identity or Era Strategy. Existing users retain the original.', 'le-help'));
    } else main.append(node('p', k === 'strategies' ? 'Base strategy IDs are fixed by runtime selection. Edit their parameters and behavior weights here; new selectable strategy kinds require code support.' : 'Ideology IDs are fixed by the diplomacy compatibility matrix. Edit existing ideology effects here; new ideology kinds require compatibility rules.', 'le-help'));
    function saveProfile(value: any) { config.profiles ??= {}; const list = (config.profiles[k] ?? []) as any[]; (config.profiles as any)[k] = [...list.filter(p => p.id !== selected), value]; render(); }
    if (k === 'ideologies') {
      const compatibility = section('Ideology Compatibility', 'Inherited global relationship scores. Higher scores indicate greater affinity. This matrix remains global and is separate from editable ideology biases.');
      for (const other of model.ideologyRelationships(selected)) compatibility.append(node('p', `${other.name}: ${other.score}`));
    }
    const params = section('Parameters'); params.open = true;
    function fields(parent: HTMLElement, obj: any, path: string[], update: (path: string[], value: any) => void) {
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'id') continue;
        if (k === 'doctrines' && path.length === 0 && ['modernizationBias', 'quantityBias', 'qualityBias'].includes(key)) continue;
        const next = [...path, key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const group = node('details'); const groupId = next.join('.'); group.dataset.section = groupId; group.open = expanded.has(groupId); group.ontoggle = () => { if (!group.isConnected) return; if (group.open) expanded.add(groupId); else expanded.delete(groupId); }; group.append(node('summary', label(key)), node('p', parameterHelp(next.join('.')), 'le-help')); parent.append(group); fields(group, value, next, update); continue;
        }
        let input: HTMLElement;
        if (typeof value === 'boolean') { const check = node('input'); check.type = 'checkbox'; check.checked = value; check.onchange = () => update(next, check.checked); input = check; }
        else if (typeof value === 'number') { const number = node('input'); number.type = 'number'; number.step = 'any'; number.value = String(value); number.onchange = () => update(next, number.value === '' ? NaN : Number(number.value)); input = number; }
        else if (key === 'primaryCityFocus') input = select(['balanced', 'cultural', 'military', 'economic', 'naval', 'scientific'].map(id => ({ id, name: label(id) })), String(value), v => update(next, v));
        else input = textInput(String(value), v => update(next, v), key === 'description');
        field(parent, label(key), input, ['name', 'description'].includes(key) ? '' : parameterHelp(next.join('.')));
      }
      const optional = new Map<string, unknown>();
      for (const example of model.catalog.profiles[k]) {
        let values: any = example;
        for (const segment of path) values = values?.[segment];
        for (const [key, value] of Object.entries(values ?? {})) if (!(key in obj)) optional.set(key, value);
      }
      if (optional.size) parent.append(select([{ id: '', name: 'Add parameter from canonical example…' }, ...[...optional.keys()].map(id => ({ id, name: label(id) }))], '', key => { if (key) update([...path, key], clone(optional.get(key))); }));
    }
    fields(params, k === 'strategies' ? { description: '', ...profile } : profile, [], (path, value) => {
      const updated: any = clone(profile); let cursor = updated;
      for (const key of path.slice(0, -1)) cursor = cursor[key]; cursor[path[path.length - 1]] = value;
      if (k === 'doctrines') for (const key of ['modernizationBias', 'quantityBias', 'qualityBias']) updated[key] = updated.productionBehavior[key];
      saveProfile(updated);
    });
    if (k === 'strategies') {
      const weights = section('Strategy Behavior Weights', 'A separate layer controls exploration, diplomacy, trade, aggression and defense while this base strategy is active.'); weights.open = true;
      const values = model.behaviorWeights(config, selected);
      fields(weights, values, [], (path, value) => { config.behaviorWeights ??= {}; config.behaviorWeights[selected] = { ...values, [path[0]]: value }; render(); });
      weights.append(button('Reset behavior weights', () => { delete config.behaviorWeights?.[selected]; render(); }));
    }
  }
  try { render(); } catch {
    const issues = model.validateConfiguration(config, nations);
    errors.textContent = issues.join('\n') || 'The imported leader configuration has an invalid structure.';
    main.replaceChildren(node('p', 'This imported configuration cannot be displayed. Discard to preserve it, or reset the leader configuration to start from canonical defaults.'), button('Reset invalid leader configuration', () => { config = { version: 1 }; render(); }));
  }
}
(window as any).EpochLeaderEditor = { open, validate: (scenario: ScenarioData) => model.validateConfiguration(scenario.leaderConfiguration ?? { version: 1 }, scenario.nations) };
