import type { IntelReport } from './phaser/RightSidebarPanelDataProvider';

const MODAL_ID = 'intel-report-modal';
const ACCENT = '#6ec6ff';

/**
 * IntelReportDialog — read-only HTML/CSS overlay that presents a covert
 * intelligence report (a nation's cities and current production). Pure
 * presentation over already-computed game state; no gameplay logic.
 */
export class IntelReportDialog {
  show(report: IntelReport): void {
    this.close();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
    `;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.close();
    });

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid ${ACCENT};
      border-radius: 8px; padding: 24px 28px;
      color: #eee; font-family: sans-serif;
      min-width: 360px; max-width: 520px; max-height: 70vh;
      display: flex; flex-direction: column;
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = `Intelligence Report: ${report.nationName}`;
    titleEl.style.cssText = `font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: ${ACCENT}; margin-bottom: 16px;`;
    box.appendChild(titleEl);

    const list = document.createElement('div');
    list.style.cssText = 'overflow-y: auto; display: flex; flex-direction: column; gap: 12px;';

    if (report.cities.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No known cities.';
      empty.style.cssText = 'font-size: 15px; color: #aaa;';
      list.appendChild(empty);
    } else {
      for (const city of report.cities) {
        const row = document.createElement('div');
        row.style.cssText = 'border-bottom: 1px solid #33334e; padding-bottom: 8px;';

        const name = document.createElement('div');
        name.textContent = `${city.name}  (pop ${city.population})`;
        name.style.cssText = 'font-size: 17px; font-weight: bold; margin-bottom: 2px;';
        row.appendChild(name);

        const prod = document.createElement('div');
        prod.style.cssText = 'font-size: 14px; color: #cfe8ff;';
        if (city.production === null) {
          prod.textContent = 'Producing: nothing';
        } else if (city.turnsRemaining !== null) {
          const turns = city.turnsRemaining === 1 ? '1 turn remaining' : `${city.turnsRemaining} turns remaining`;
          prod.textContent = `Producing: ${city.production} (${turns})`;
        } else {
          prod.textContent = `Producing: ${city.production}`;
        }
        row.appendChild(prod);

        list.appendChild(row);
      }
    }
    box.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      margin-top: 20px; align-self: flex-end;
      padding: 8px 24px; font-size: 15px; cursor: pointer;
      border: 1px solid ${ACCENT}; border-radius: 4px;
      background: ${ACCENT}; color: #000;
    `;
    closeBtn.addEventListener('click', () => this.close());
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  close(): void {
    document.getElementById(MODAL_ID)?.remove();
  }
}
