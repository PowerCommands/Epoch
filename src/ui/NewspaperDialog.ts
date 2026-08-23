import type { NewspaperArticle, NewspaperIssue } from '../types/newspaper';

const MODAL_ID = 'epoch-newspaper-dialog';

/** Presentation-only newspaper front page. */
export class NewspaperDialog {
  show(issue: NewspaperIssue): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.tabIndex = -1;
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10020; display: flex;
      align-items: center; justify-content: center; padding: 18px;
      background: rgba(13, 11, 8, .82); color: #201d18;
      font-family: Georgia, 'Times New Roman', serif;
    `;
    for (const type of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }
    document.addEventListener('keydown', this.handleKeyDown, true);

    const paper = document.createElement('section');
    paper.setAttribute('aria-label', 'The Epoch Chronicle newspaper');
    paper.style.cssText = `
      width: min(1040px, 95vw); max-height: 94vh; overflow-y: auto;
      box-sizing: border-box; padding: clamp(18px, 3vw, 34px);
      border: 5px double #2d2922; background: #eee4c9;
      background-image: radial-gradient(circle at 30% 20%, rgba(255,255,255,.35), transparent 40%),
                        linear-gradient(90deg, rgba(81,62,33,.035), transparent 45%, rgba(81,62,33,.03));
      box-shadow: 0 24px 80px rgba(0,0,0,.65);
    `;

    const masthead = document.createElement('header');
    masthead.style.cssText = 'text-align:center; border-bottom:4px double #29251f; padding-bottom:10px; margin-bottom:14px;';
    masthead.append(
      element('div', 'THE EPOCH CHRONICLE', 'font-size:clamp(30px,5vw,58px);font-weight:900;letter-spacing:.05em;line-height:1;'),
      element('div', `${issue.dateLabel} · World Edition · Round ${issue.issueRound}`, 'font-size:13px;letter-spacing:.13em;text-transform:uppercase;margin-top:8px;'),
    );

    const main = document.createElement('article');
    main.style.cssText = 'border-bottom:3px solid #29251f;padding-bottom:18px;margin-bottom:16px;';
    main.appendChild(element('h1', issue.mainArticle.headline, 'font-size:clamp(25px,3.5vw,43px);line-height:1.02;text-align:center;margin:0 0 14px;font-weight:900;'));
    const mainGrid = document.createElement('div');
    mainGrid.style.cssText = 'display:grid;grid-template-columns:minmax(260px,1.2fr) minmax(220px,1fr);gap:20px;align-items:start;';
    if (issue.mainArticle.imagePath) {
      const image = document.createElement('img');
      image.src = issue.mainArticle.imagePath;
      image.alt = '';
      image.style.cssText = 'display:block;width:100%;aspect-ratio:10/7;object-fit:cover;border:1px solid #4d463b;filter:sepia(.13) contrast(1.04);';
      mainGrid.appendChild(image);
    }
    mainGrid.appendChild(this.articleCopy(issue.mainArticle, true));
    main.appendChild(mainGrid);

    const secondaryGrid = document.createElement('section');
    secondaryGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #4d463b;border-bottom:1px solid #4d463b;';
    issue.secondaryArticles.forEach((article, index) => {
      const column = document.createElement('article');
      column.style.cssText = `padding:4px ${index === 1 ? '18px' : '16px'};${index > 0 ? 'border-left:1px solid #6b6253;' : ''}`;
      column.appendChild(element('h2', article.headline, 'font-size:19px;line-height:1.08;margin:8px 0 10px;font-weight:900;text-transform:uppercase;'));
      column.appendChild(this.articleCopy(article, false));
      secondaryGrid.appendChild(column);
    });

    const footer = document.createElement('footer');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:18px;font-size:12px;';
    footer.appendChild(element('span', `Reporting events from rounds ${issue.coverageStartRound}–${issue.coverageEndRound}`, 'font-style:italic;color:#554d41;'));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue';
    button.style.cssText = 'font:700 15px Georgia,serif;padding:9px 28px;border:2px solid #29251f;background:#29251f;color:#f3ead2;cursor:pointer;letter-spacing:.05em;';
    button.addEventListener('click', () => this.close());
    footer.appendChild(button);

    paper.append(masthead, main, secondaryGrid, footer);
    overlay.appendChild(paper);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => button.focus());
  }

  close(): void {
    const overlay = document.getElementById(MODAL_ID);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    overlay?.remove();
  }

  isOpen(): boolean { return document.getElementById(MODAL_ID) !== null; }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  };

  private articleCopy(article: NewspaperArticle, main: boolean): HTMLDivElement {
    const copy = document.createElement('div');
    copy.style.cssText = `font-size:${main ? '17px' : '14px'};line-height:1.48;`;
    if (article.involvedNationNames.length > 0) {
      copy.appendChild(element('div', article.involvedNationNames.join(' · '), 'font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;margin-bottom:8px;'));
    }
    copy.appendChild(element('p', article.body, 'margin:0 0 10px;'));
    if (article.comment) copy.appendChild(element('p', article.comment, 'margin:0;font-style:italic;border-top:1px solid #8c806d;padding-top:8px;'));
    return copy;
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
  style: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.style.cssText = style;
  return node;
}
