import { orderScenarios, saveScenarioOrder } from '../shared/scenario-order.js';

export function createScenarioLibrary(panel, { getEntries, getCurrentKey, open }) {
  let draggedKey = null;
  let opening = false;
  const title = document.createElement('h2');
  title.textContent = 'Scenario Library';
  const hint = document.createElement('p');
  hint.textContent = 'Drag to set Game Setup order. Saved in this browser.';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const list = document.createElement('div');
  list.className = 'scenario-library-list';
  panel.append(title, hint, list, message);

  function move(key, targetIndex) {
    const entries = orderScenarios(getEntries());
    const index = entries.findIndex(entry => entry.key === key);
    if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return;
    const [entry] = entries.splice(index, 1);
    entries.splice(targetIndex, 0, entry);
    try {
      saveScenarioOrder(entries);
      message.textContent = 'Game Setup order saved.';
      refresh();
      list.querySelectorAll('button')[targetIndex]?.focus();
    } catch {
      message.textContent = 'Could not save order. Browser storage is unavailable or full.';
    }
  }

  function refresh() {
    list.replaceChildren();
    orderScenarios(getEntries()).forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.className = 'scenario-library-entry';
      button.textContent = `⠿ ${index + 1}. ${entry.label}`;
      button.title = `${entry.label} — click to open; drag or Alt + Arrow Up/Down to reorder`;
      button.setAttribute('aria-current', String(entry.key === getCurrentKey()));
      button.disabled = opening;
      button.addEventListener('click', async () => {
        if (opening) return;
        opening = true;
        list.setAttribute('aria-busy', 'true');
        list.querySelectorAll('button').forEach(el => { el.disabled = true; });
        try { await open(entry); }
        finally {
          opening = false;
          list.removeAttribute('aria-busy');
          refresh();
        }
      });
      button.addEventListener('keydown', event => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        move(entry.key, index + (event.key === 'ArrowUp' ? -1 : 1));
      });
      button.addEventListener('dragstart', event => {
        draggedKey = entry.key;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', entry.key);
      });
      button.addEventListener('dragover', event => {
        if (!draggedKey) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        button.classList.add('drop-target');
      });
      button.addEventListener('dragleave', () => button.classList.remove('drop-target'));
      button.addEventListener('drop', event => {
        event.preventDefault();
        button.classList.remove('drop-target');
        if (draggedKey) move(draggedKey, index);
        draggedKey = null;
      });
      button.addEventListener('dragend', () => {
        draggedKey = null;
        list.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
      });
      list.append(button);
    });
    if (!list.children.length) list.textContent = 'No saved scenarios available.';
  }
  window.addEventListener('storage', refresh);
  refresh();
  return { refresh };
}
