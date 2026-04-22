import Phaser from 'phaser';

const consumedNativePointerEvents = new WeakSet<object>();

export function isPointerOverScreenSpaceUi(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
): boolean {
  // Legacy fallback only. Broad hit-testing of all scrollFactor=0 objects
  // caused ghost HUD blocking, so world input should prefer explicit
  // WorldInputGate claims instead of using this helper.
  void scene;
  void pointer;
  return false;
}

export function consumePointerEvent(pointer: Phaser.Input.Pointer): void {
  consumedNativePointerEvents.add(pointer.event as object);
  pointer.event.stopPropagation();
  pointer.event.preventDefault?.();
}

export function isPointerEventConsumed(pointer: Phaser.Input.Pointer): boolean {
  return consumedNativePointerEvents.has(pointer.event as object);
}
