import { HISTORY_TIMELINE_STYLES } from './HistoryTimelineStyles';
import type { MapData } from '../types/map';
import type { HistoricalEvent } from '../types/historicalTimeline';
import type { NewspaperSystem } from '../systems/NewspaperSystem';
import { decodeOwnership, type SavedHistoricalMap } from '../systems/HistoricalMapRecorder';
import { TERRAIN_COLORS } from './minimapColors';

/** Every event round is a stop, even when no map was recorded on that round. */
export function historyMoments(history: SavedHistoricalMap, events: readonly HistoricalEvent[]): number[] {
  const first = history.snapshots[0]?.round;
  const last = history.snapshots[history.snapshots.length - 1]?.round;
  if (first === undefined || last === undefined) return [];
  return [...new Set([...history.snapshots.map(s => s.round), ...events.filter(e => e.round >= first && e.round <= last).map(e => e.round)])].sort((a, b) => a - b);
}
/** Last known map avoids revealing future conquests at an earlier event. */
export function mapAtRound(history: SavedHistoricalMap, round: number) {
  let result = history.snapshots[0];
  for (const snapshot of history.snapshots) { if (snapshot.round > round) break; result = snapshot; }
  return result;
}

export interface HistoryFrame { round: number; snapshotIndex: number; events: HistoricalEvent[] }
export function historyFrames(history: SavedHistoricalMap, events: readonly HistoricalEvent[]): HistoryFrame[] {
  const rounds = historyMoments(history, events);
  if (!rounds.length) return [];
  const entries: Array<{ round: number; cursor: number; snapshotIndex?: number; event?: HistoricalEvent }> = [
    ...history.snapshots.map((s, snapshotIndex) => ({ round: s.round, cursor: s.eventId ?? Number.MAX_SAFE_INTEGER, snapshotIndex })),
    ...events.filter(e => e.round >= rounds[0] && e.round <= rounds[rounds.length - 1])
      .map(event => ({ round: event.round, cursor: event.id, event })),
  ];
  entries.sort((a, b) => a.round - b.round || a.cursor - b.cursor || Number(!!a.event) - Number(!!b.event));
  let snapshotIndex = 0;
  const frames: HistoryFrame[] = [];
  entries.forEach((entry, i) => {
    if (entry.snapshotIndex !== undefined) {
      snapshotIndex = entry.snapshotIndex;
      // Merge a recorded transition and its corresponding headline into one stop.
      const next = entries[i + 1];
      if (next?.event && next.round === entry.round && next.cursor === entry.cursor) return;
    }
    frames.push({ round: entry.round, snapshotIndex, events: entry.event ? [entry.event] : [] });
  });
  return frames;
}

export class HistoryTimelineViewer {
  private overlay?: HTMLDivElement;
  private timer?: ReturnType<typeof setTimeout>;
  private release?: () => void;
  private previousFocus?: HTMLElement;
  private keyboard = (event: KeyboardEvent) => {
    if (!this.overlay) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    if (event.key === 'Tab') {
      const elements = [...this.overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input, select')];
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  isOpen(): boolean { return !!this.overlay; }
  close(): void {
    clearTimeout(this.timer); this.timer = undefined;
    this.overlay?.remove(); this.overlay = undefined;
    window.removeEventListener('keydown', this.keyboard, true);
    const release = this.release; this.release = undefined; release?.();
    this.previousFocus?.focus();
  }
  show(map: MapData, history: SavedHistoricalMap, events: readonly HistoricalEvent[], newspaper: NewspaperSystem, release: () => void): void {
    if (this.overlay) return;
    this.release = release;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const overlay = document.createElement('div'); this.overlay = overlay;
    overlay.id = 'epoch-history-viewer'; overlay.role = 'dialog'; overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Historical Timeline');

    for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'mousedown', 'mouseup']) overlay.addEventListener(type, e => e.stopPropagation());
    window.addEventListener('keydown', this.keyboard, true);
    const heading = document.createElement('header'); heading.className = 'ht-heading';
    const style = document.createElement('style'); style.textContent = HISTORY_TIMELINE_STYLES; overlay.append(style);
    const brand = document.createElement('img'); brand.className = 'ht-brand'; brand.src = '/assets/epoch-logo.jpg'; brand.alt = '';
    const title = document.createElement('div'); title.className = 'ht-title';
    title.innerHTML = '<span class="ht-kicker">Epochs of Time · World History</span><h1>The History of the World</h1><p class="ht-subtitle">Empires rise. Borders shift. History endures.</p>';
    const button = (label: string, action: () => void) => {
      const b = document.createElement('button'); b.textContent = label; b.onclick = action;
      return b;
    };
    const close = button('Close · Esc', () => this.close()); heading.append(brand, title, close);
    const body = document.createElement('div'); body.className = 'ht-body';
    const left = document.createElement('section'); left.className = 'ht-atlas';
    const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'Historical political map');

    const mapLabel = document.createElement('div'); mapLabel.className = 'ht-map-label';
    const legend = document.createElement('div'); legend.className = 'ht-legend';
    for (const nation of history.nations) {
      const entry = document.createElement('span'); const swatch = document.createElement('span'); swatch.textContent = '■ ';
      swatch.style.color = `#${nation.color.toString(16).padStart(6, '0')}`;
      entry.append(swatch, document.createTextNode(nation.name)); legend.append(entry);
    }
    const atlasHeading = document.createElement('div'); atlasHeading.className = 'ht-section-heading';
    atlasHeading.innerHTML = '<strong>The World Atlas</strong><small>Territories & Empires</small>';
    const mapStage = document.createElement('div'); mapStage.className = 'ht-map-stage'; mapStage.append(canvas);
    left.append(atlasHeading, mapStage, mapLabel, legend);
    const feed = document.createElement('section'); feed.setAttribute('aria-label', 'Historical newspaper');
    feed.className = 'ht-feed';
    body.append(left, feed);
    const controls = document.createElement('footer'); controls.className = 'ht-controls';
    const moments = historyFrames(history, events); let index = 0; let playing = false;
    const scrubber = document.createElement('input'); scrubber.type = 'range'; scrubber.min = '0'; scrubber.max = String(Math.max(0, moments.length - 1)); scrubber.step = '1';
    scrubber.setAttribute('aria-label', 'Historical moment');
    const date = document.createElement('span'); date.className = 'ht-date';
    const speed = document.createElement('select'); speed.setAttribute('aria-label', 'Playback speed');
    for (const [value, label] of [['1', 'Reading pace'], ['2', '2×'], ['4', '4×'], ['10', '10×'], ['20', '20×']]) {
      const o = document.createElement('option'); o.value = value; o.textContent = label; speed.append(o);
    }
    const pause = () => { playing = false; clearTimeout(this.timer); this.timer = undefined; play.textContent = 'Play'; };
    const jump = (next: number) => { pause(); index = Math.max(0, Math.min(moments.length - 1, next)); render(); };
    const previous = button('Previous', () => jump(index - 1));
    const next = button('Next', () => jump(index + 1));
    const play = button('Play', () => {
      if (playing) { pause(); return; }
      if (index === moments.length - 1) { index = 0; render(); }
      playing = true; play.textContent = 'Pause'; schedule();
    });
    play.className = 'ht-play';
    const schedule = () => {
      clearTimeout(this.timer);
      const words = feed.textContent?.split(/\s+/).length ?? 0;
      this.timer = setTimeout(() => {
        if (!playing) return;
        if (index >= moments.length - 1) { pause(); return; }
        index++; render(); schedule();
      }, Math.max(3500, words * 280) / Number(speed.value));
    };
    speed.onchange = () => { if (playing) schedule(); };
    scrubber.oninput = () => jump(Number(scrubber.value));
    const render = () => {
      previous.disabled = index <= 0; next.disabled = index >= moments.length - 1;
      play.disabled = moments.length < 2; scrubber.disabled = !moments.length;
      scrubber.value = String(index); feed.replaceChildren();
      for (const control of [previous, next, play]) control.style.opacity = control.disabled ? '0.45' : '1';
      const frame = moments[index]; const round = frame?.round; const snapshot = history.snapshots[frame?.snapshotIndex];
      if (!snapshot) { date.textContent = 'No recorded history yet'; return; }
      const period = [...frame.events];
      if (!period.length) {
        const recent = events.filter(e => e.round <= round && e.round >= Math.max(moments[0].round, round - 5)
          && (e.round < snapshot.round || e.id <= (snapshot.eventId ?? Number.MAX_SAFE_INTEGER)));
        if (recent.length) period.push(recent[recent.length - 1]);
      }
      const label = frame.events[0]?.dateLabel ?? snapshot.dateLabel;
      date.textContent = `Turn ${round} · ${label}`;
      scrubber.setAttribute('aria-valuetext', date.textContent);
      progress.textContent = `Moment ${index + 1} of ${moments.length}`;
      mapLabel.textContent = `Turn ${snapshot.round} · ${snapshot.dateLabel}  /  Unclaimed lands retain their terrain colors.`;
      const owners = decodeOwnership(snapshot);
      const cell = 6; canvas.width = map.width * cell + cell / 2; canvas.height = map.height * cell;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a557d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
          const tile = map.tiles[y]?.[x]; if (!tile) continue;
          const nation = history.nations[owners[y * map.width + x] - 1];
          ctx.fillStyle = `#${(nation?.color ?? TERRAIN_COLORS[tile.originalTerrain ?? tile.type]).toString(16).padStart(6, '0')}`;
          ctx.fillRect(x * cell + (y % 2 ? cell / 2 : 0), y * cell, cell, cell);
        }
      }
      const masthead = document.createElement('h2'); masthead.textContent = 'THE EPOCH CHRONICLE'; masthead.className = 'ht-masthead'; feed.append(masthead);
      if (!period.length) {
        const quiet = document.createElement('div'); quiet.className = 'ht-quiet';
        quiet.innerHTML = '<img src="/assets/sprites/news/world-eras.png" alt="Civilization through the ages"><h3>Between the Headlines</h3><p>Borders and settlements continue to take shape.<br>The next chapter of this world is waiting to be written.</p>';
        feed.append(quiet);
      }
      for (const event of [...period].sort((a, b) => (a.newsImportance ?? 5) - (b.newsImportance ?? 5) || a.id - b.id)) {
        const article = newspaper.articleForHistory(event); const section = document.createElement('article');

        const meta = document.createElement('small'); meta.textContent = `${event.dateLabel} · Turn ${event.round}${event.newsImportance === 0 ? ' · WORLD MILESTONE' : ['warDeclared', 'peace', 'capitalCaptured', 'nationEliminated', 'worldWarStarted', 'worldWarEnded', 'nuclearAttack', 'worldCouncilResolution'].includes(event.type) ? ' · TURNING POINT' : ''}`;
        const h = document.createElement('h3'); h.textContent = article.headline;
        section.append(meta, h);
        if (article.imagePath) { const img = document.createElement('img'); img.src = article.imagePath; img.alt = article.headline; img.loading = 'lazy';  section.append(img); }
        const p = document.createElement('p'); p.textContent = article.body;  section.append(p);
        if (article.comment) { const c = document.createElement('em'); c.textContent = article.comment; section.append(c); }
        feed.append(section);
      }
      if (index === moments.length - 1) {
        const victory = newspaper.getIssues().find(issue => issue.issueType === 'victory' && issue.issueRound === round);
        if (victory) {
          const h = document.createElement('h3'); h.textContent = victory.mainArticle.headline;
          const p = document.createElement('p'); p.textContent = victory.mainArticle.body;
          feed.append(h, p);
        }
      }
      feed.scrollTop = 0;
    };
    const progress = document.createElement('span'); progress.className = 'ht-progress';
    const transport = document.createElement('div'); transport.className = 'ht-transport'; transport.append(previous, play, next);
    const speedLabel = document.createElement('label'); speedLabel.className = 'ht-speed';
    const speedTitle = document.createElement('span'); speedTitle.textContent = 'Playback'; speedLabel.append(speedTitle, speed);
    const track = document.createElement('div'); track.className = 'ht-scrub';
    const start = document.createElement('span'); start.textContent = `Turn ${moments[0]?.round ?? '—'}`;
    const end = document.createElement('span'); end.textContent = `Turn ${moments[moments.length - 1]?.round ?? '—'}`;
    track.append(start, scrubber, end);
    controls.append(date, progress, track, transport, speedLabel);
    overlay.append(heading, body, controls);
    document.body.append(overlay); render(); close.focus();
  }
}
