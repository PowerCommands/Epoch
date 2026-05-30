import type {
  AllianceProposalType,
  CouncilDialogView,
  CouncilHeaderView,
  CouncilTargetOption,
} from '../types/allianceCouncil';

const ACCENT = '#c9a227';
const PROPOSAL_LABELS: Record<AllianceProposalType, string> = {
  inviteNation: 'Invite Nation',
  tradeEmbargo: 'Trade Embargo',
  startWar: 'Start War',
};

/**
 * HTML/CSS overlay for the Alliance Council — a transient modal (same family as
 * the diplomacy confirmation modal). It only renders the {@link CouncilDialogView}
 * the council manager pushes and forwards the human's clicks back through the
 * view callbacks. It owns no council logic or AI scoring.
 */
export class AllianceCouncilDialog {
  private overlay: HTMLDivElement | null = null;

  show(view: CouncilDialogView): void {
    this.hide();
    const overlay = document.createElement('div');
    overlay.id = 'alliance-council-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: #15151f; border: 2px solid ${ACCENT}; border-radius: 10px;
      padding: 24px 28px; width: 440px; max-width: 92vw; max-height: 88vh; overflow-y: auto;
      color: #eee; font-family: sans-serif;
    `;
    box.appendChild(this.buildHeader(view.header));
    box.appendChild(this.buildBody(view));

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private buildHeader(header: CouncilHeaderView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom: 18px; border-bottom: 1px solid #333; padding-bottom: 14px;';

    const title = document.createElement('div');
    title.textContent = 'Alliance Council';
    title.style.cssText = `font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: ${ACCENT};`;
    wrap.appendChild(title);

    const name = document.createElement('div');
    name.textContent = header.allianceName;
    name.style.cssText = 'font-size: 22px; font-weight: bold; margin: 4px 0 2px;';
    wrap.appendChild(name);

    const meta = document.createElement('div');
    meta.textContent = `Council turn ${header.councilTurn} · ${this.phaseLabel(header.phase)}`;
    meta.style.cssText = 'font-size: 13px; color: #9aa6b5;';
    wrap.appendChild(meta);

    const members = document.createElement('div');
    members.style.cssText = 'margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;';
    for (const member of header.members) {
      const chip = document.createElement('span');
      chip.textContent = member.isYou ? `${member.name} (you)` : member.name;
      chip.style.cssText = `
        font-size: 12px; padding: 3px 9px; border-radius: 11px;
        background: ${member.isYou ? 'rgba(201,162,39,0.22)' : '#222'};
        border: 1px solid ${member.isYou ? ACCENT : '#3a3a3a'};
      `;
      members.appendChild(chip);
    }
    wrap.appendChild(members);
    return wrap;
  }

  private buildBody(view: CouncilDialogView): HTMLElement {
    switch (view.phase) {
      case 'leaveStay':
        return this.buildLeaveStay(view.onRemain, view.onLeave);
      case 'proposalSubmission':
        return this.buildProposal(view.options, view.onSubmit, view.onSkip);
      case 'voting':
        return this.buildVote(view);
      case 'resolution':
        return this.buildResult(view.summary, view.onClose);
    }
  }

  private buildLeaveStay(onRemain: () => void, onLeave: () => void): HTMLElement {
    const body = document.createElement('div');
    const text = document.createElement('div');
    text.textContent = 'The council is convening. Will you remain in the alliance?';
    text.style.cssText = 'font-size: 16px; margin-bottom: 18px;';
    body.appendChild(text);
    body.appendChild(this.buttonRow([
      this.button('Remain in Alliance', true, () => { this.hide(); onRemain(); }),
      this.button('Leave Alliance', false, () => { this.hide(); onLeave(); }),
    ]));
    return body;
  }

  private buildProposal(
    options: { inviteNation: CouncilTargetOption[]; tradeEmbargo: CouncilTargetOption[]; startWar: CouncilTargetOption[] },
    onSubmit: (type: AllianceProposalType, targetId: string) => void,
    onSkip: () => void,
  ): HTMLElement {
    const body = document.createElement('div');
    const text = document.createElement('div');
    text.textContent = 'You may submit one proposal to the council, or none.';
    text.style.cssText = 'font-size: 15px; margin-bottom: 14px;';
    body.appendChild(text);

    let selectedType: AllianceProposalType | null = null;
    const targetSelect = document.createElement('select');
    targetSelect.style.cssText = `
      width: 100%; padding: 8px; margin-bottom: 16px; border-radius: 6px;
      background: #0f0f17; color: #eee; border: 1px solid #3a3a3a; display: none;
    `;

    const submitBtn = this.button('Submit Proposal', true, () => {
      if (!selectedType || !targetSelect.value) return;
      this.hide();
      onSubmit(selectedType, targetSelect.value);
    });
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';

    const typeRow = document.createElement('div');
    typeRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;';
    const typeButtons: HTMLButtonElement[] = [];
    const typesWithOptions: AllianceProposalType[] = (['inviteNation', 'tradeEmbargo', 'startWar'] as const)
      .filter((type) => options[type].length > 0);

    const selectType = (type: AllianceProposalType) => {
      selectedType = type;
      for (const btn of typeButtons) {
        const active = btn.dataset.type === type;
        btn.style.background = active ? ACCENT : 'transparent';
        btn.style.color = active ? '#000' : '#ccc';
      }
      targetSelect.innerHTML = '';
      for (const option of options[type]) {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.name;
        targetSelect.appendChild(opt);
      }
      targetSelect.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    };

    for (const type of typesWithOptions) {
      const btn = document.createElement('button');
      btn.textContent = PROPOSAL_LABELS[type];
      btn.dataset.type = type;
      btn.style.cssText = `
        padding: 7px 14px; font-size: 14px; cursor: pointer; border-radius: 6px;
        border: 1px solid ${ACCENT}; background: transparent; color: #ccc;
      `;
      btn.addEventListener('click', () => selectType(type));
      typeButtons.push(btn);
      typeRow.appendChild(btn);
    }

    if (typesWithOptions.length === 0) {
      const none = document.createElement('div');
      none.textContent = 'No valid proposals are available this council.';
      none.style.cssText = 'font-size: 13px; color: #9aa6b5; margin-bottom: 14px;';
      typeRow.appendChild(none);
    }

    body.appendChild(typeRow);
    body.appendChild(targetSelect);
    body.appendChild(this.buttonRow([
      submitBtn,
      this.button('No Proposal', false, () => { this.hide(); onSkip(); }),
    ]));
    return body;
  }

  private buildVote(view: Extract<CouncilDialogView, { phase: 'voting' }>): HTMLElement {
    const body = document.createElement('div');
    const lines = [
      `Proposer: ${view.proposerName}`,
      `Proposal: ${PROPOSAL_LABELS[view.proposalType]}`,
      `Target: ${view.targetName}`,
      `Likely consequence: ${view.consequence}`,
    ];
    for (const line of lines) {
      const el = document.createElement('div');
      el.textContent = line;
      el.style.cssText = 'font-size: 15px; margin-bottom: 6px;';
      body.appendChild(el);
    }
    const prompt = document.createElement('div');
    prompt.textContent = 'Do you approve?';
    prompt.style.cssText = 'font-size: 15px; margin: 12px 0 18px; font-weight: bold;';
    body.appendChild(prompt);
    body.appendChild(this.buttonRow([
      this.button('Approve', true, () => { this.hide(); view.onApprove(); }),
      this.button('Reject', false, () => { this.hide(); view.onReject(); }),
    ]));
    return body;
  }

  private buildResult(summary: string[], onClose: () => void): HTMLElement {
    const body = document.createElement('div');
    const heading = document.createElement('div');
    heading.textContent = 'Council Results';
    heading.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 12px;';
    body.appendChild(heading);

    const list = document.createElement('div');
    list.style.cssText = 'font-size: 14px; line-height: 1.5; margin-bottom: 18px;';
    for (const line of summary.length > 0 ? summary : ['The council concluded without changes.']) {
      const el = document.createElement('div');
      el.textContent = `• ${line}`;
      list.appendChild(el);
    }
    body.appendChild(list);
    body.appendChild(this.buttonRow([this.button('Close', true, () => { this.hide(); onClose(); })]));
    return body;
  }

  private phaseLabel(phase: CouncilHeaderView['phase']): string {
    switch (phase) {
      case 'leaveStay': return 'Stay or leave';
      case 'proposalSubmission': return 'Proposals';
      case 'voting': return 'Voting';
      case 'resolution': return 'Results';
      case 'complete': return 'Concluded';
    }
  }

  private buttonRow(buttons: HTMLButtonElement[]): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 14px; justify-content: center; margin-top: 8px;';
    for (const btn of buttons) row.appendChild(btn);
    return row;
  }

  private button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 8px 22px; font-size: 15px; cursor: pointer; border-radius: 5px;
      border: 1px solid ${primary ? ACCENT : '#666'};
      background: ${primary ? ACCENT : 'transparent'};
      color: ${primary ? '#000' : '#ccc'};
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
