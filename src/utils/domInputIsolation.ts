/**
 * Phaser listens for mouse/touch events on window even when their target is a
 * DOM dialog. Keep DOM interactions in the DOM, including dialogs removed by
 * their own click handlers. Document-level dragging still receives the events;
 * native controls keep their default behavior, and canvas input is untouched.
 */
export function installDomInputIsolation(getGameCanvas: () => HTMLCanvasElement | undefined): () => void {
  const events = ['mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel',
    'click', 'dblclick', 'contextmenu', 'wheel'] as const;
  const isolate = (event: Event): void => {
    const target = event.composedPath()[0];
    if (!(target instanceof Element) || target === getGameCanvas()) return;
    event.stopPropagation();
  };
  for (const type of events) document.addEventListener(type, isolate);
  return () => {
    for (const type of events) document.removeEventListener(type, isolate);
  };
}
