import Phaser from 'phaser';

const consumedNativePointerEvents = new WeakSet<object>();
const hudOwnedPointerIds = new Set<number>();

function isScrollFactorZero(object: Phaser.GameObjects.GameObject): boolean {
  const candidate = object as Phaser.GameObjects.GameObject & {
    scrollFactorX?: number;
    scrollFactorY?: number;
  };
  return candidate.scrollFactorX === 0 && candidate.scrollFactorY === 0;
}

export function isPointerOverScreenSpaceUi(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
): boolean {
  const hitObjects = scene.input.hitTestPointer(pointer);
  return hitObjects.some((object) => isScrollFactorZero(object) && object.input?.enabled === true);
}

export function consumePointerEvent(pointer: Phaser.Input.Pointer): void {
  consumedNativePointerEvents.add(pointer.event as object);
  hudOwnedPointerIds.add(pointer.id);
  pointer.event.stopPropagation();
  pointer.event.preventDefault?.();
}

export function isPointerEventConsumed(pointer: Phaser.Input.Pointer): boolean {
  const consumed = consumedNativePointerEvents.has(pointer.event as object)
    || hudOwnedPointerIds.has(pointer.id);

  if (consumed && isPointerReleaseEvent(pointer)) {
    queueMicrotask(() => {
      hudOwnedPointerIds.delete(pointer.id);
    });
  }

  return consumed;
}

function isPointerReleaseEvent(pointer: Phaser.Input.Pointer): boolean {
  const type = (pointer.event as Event | undefined)?.type ?? '';
  return type === 'pointerup' || type === 'mouseup' || type === 'touchend' || type === 'pointercancel';
}
