export interface ResourceChangedEvent {
  nationId: string;
}

export type ResourceListener = (e: ResourceChangedEvent) => void;
