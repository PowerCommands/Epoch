// Generic array-backed binary min-heap. Extracted to replace the O(n) linear
// scan that previously served as the A* open set in PathfindingSystem, giving
// O(log n) push/pop for the hot pathfinding loop.

export class MinHeap<T> {
  private readonly heap: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap.length = 0;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    const heap = this.heap;
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    const heap = this.heap;
    const item = heap[index];
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(item, heap[parent]) >= 0) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = item;
  }

  private siftDown(index: number): void {
    const heap = this.heap;
    const length = heap.length;
    const item = heap[index];
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      let smallestItem = item;
      if (left < length && this.compare(heap[left], smallestItem) < 0) {
        smallest = left;
        smallestItem = heap[left];
      }
      if (right < length && this.compare(heap[right], smallestItem) < 0) {
        smallest = right;
        smallestItem = heap[right];
      }
      if (smallest === index) break;
      heap[index] = heap[smallest];
      index = smallest;
    }
    heap[index] = item;
  }
}
